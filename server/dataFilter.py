from sklearn.neighbors import BallTree
import numpy as np
import pandas as pd
from skimage import color
import requests
import json
import os
from pathlib import Path
from skimage.io import imread

import time
import pickle
import tifffile as tf
from PIL import Image
import re
import zarr

ball_tree = None
database = None
source = None
config = None
seg = None
channels = None


def init(datasource):
    load_ball_tree(datasource)


def load_db(datasource, reload=False):
    global database
    global source
    global config
    global seg
    global channels

    if source is datasource and database is not None and reload is False:
        return
    load_config()
    if reload:
        load_ball_tree(datasource, reload=reload)
    csvPath = "." + config[datasource]['featureData'][0]['src']
    database = pd.read_csv(csvPath)
    database['id'] = database.index
    database = database.replace(-np.Inf, 0)
    source = datasource
    seg = zarr.load(config[datasource]['segmentation'])
    channel_io = tf.TiffFile(config[datasource]['channelFile'], is_ome=False)
    channels = zarr.open(channel_io.series[0].aszarr())


def load_config():
    config_json_path = Path("static/data") / "config.json"
    global config
    with open(config_json_path, "r+") as configJson:
        config = json.load(configJson)


def load_ball_tree(datasource, reload=False):
    global ball_tree
    global database
    global config
    if datasource != source:
        load_db(datasource)
    pickled_kd_tree_path = str(Path(os.path.join(os.getcwd())) / "static" / "data" / datasource / "ball_tree.pickle")
    if os.path.isfile(pickled_kd_tree_path) and reload is False:
        print("Pickled KD Tree Exists, Loading")
        ball_tree = pickle.load(open(pickled_kd_tree_path, "rb"))
    else:
        print("Creating KD Tree")
        xCoordinate = config[datasource]['featureData'][0]['xCoordinate']
        print('X', xCoordinate)
        yCoordinate = config[datasource]['featureData'][0]['yCoordinate']
        csvPath = "." + config[datasource]['featureData'][0]['src']
        raw_data = pd.read_csv(csvPath)
        points = pd.DataFrame({'x': raw_data[xCoordinate], 'y': raw_data[yCoordinate]})
        ball_tree = BallTree(points, metric='euclidean')
        pickle.dump(ball_tree, open(pickled_kd_tree_path, 'wb'))


def query_for_closest_cell(x, y, datasource):
    global database
    global source
    global ball_tree
    if datasource != source:
        load_ball_tree(datasource)
    distance, index = ball_tree.query([[x, y]], k=1)
    if distance == np.inf:
        return {}
    #         Nothing found
    else:
        try:
            row = database.iloc[index[0]]
            obj = row.to_dict(orient='records')[0]
            obj['id'] = str(index[0][0])
            if 'phenotype' not in obj:
                obj['phenotype'] = ''
            return obj
        except:
            return {}


def get_row(row, datasource):
    global database
    global source
    global ball_tree
    if datasource != source:
        load_ball_tree(datasource)
    obj = database.loc[[row]].to_dict(orient='records')[0]
    obj['id'] = row
    return obj


def get_channel_names(datasource, shortnames=True):
    global database
    global source
    if datasource != source:
        load_ball_tree(datasource)
    if shortnames:
        channel_names = [channel['name'] for channel in config[datasource]['imageData'][1:]]
    else:
        channel_names = [channel['fullname'] for channel in config[datasource]['imageData'][1:]]
    return channel_names


def get_phenotypes(datasource):
    global database
    global source
    global config
    try:
        phenotype_field = config[datasource]['featureData'][0]['phenotype']
    except KeyError:
        phenotype_field = 'phenotype'
    except TypeError:
        phenotype_field = 'phenotype'

    if datasource != source:
        load_ball_tree(datasource)
    if phenotype_field in database.columns:
        return database[phenotype_field].unique().tolist()
    else:
        return ['']


def get_neighborhood(x, y, datasource, r=100, fields=None):
    global database
    global source
    global ball_tree
    if datasource != source:
        load_ball_tree(datasource)
    index = ball_tree.query_radius([[x, y]], r=r)
    neighbors = index[0]
    try:
        if fields and len(fields) > 0:
            fields.append('id') if 'id' not in fields else fields
            if len(fields) > 1:
                neighborhood = database.iloc[neighbors][fields].to_dict(orient='records')
            else:
                neighborhood = database.iloc[neighbors][fields].to_dict()
        else:
            neighborhood = database.iloc[neighbors].to_dict(orient='records')
        # for neighbor in neighbors:
        #     row = database.iloc[[neighbor]]
        #     obj = row.to_dict(orient='records')[0]
        #     # obj['id'] = str(neighbor)

        return neighborhood
    except:
        return {}


def get_number_of_cells_in_circle(x, y, datasource, r):
    global source
    global ball_tree
    if datasource != source:
        load_ball_tree(datasource)
    index = ball_tree.query_radius([[x, y]], r=r)
    try:
        return len(index[0])
    except:
        return 0


def get_color_scheme(datasource, refresh):
    color_scheme_path = str(
        Path(os.path.join(os.getcwd())) / "static" / "data" / datasource / "color_scheme.pickle")
    if refresh == False:
        if os.path.isfile(color_scheme_path):
            print("Color Scheme Exists, Loading")
            color_scheme = pickle.load(open(color_scheme_path, "rb"))
            return color_scheme
    phenotypes = get_phenotypes(datasource)
    payload = {
        'hueFilters': [],
        'lightnessRange': ["25", "85"],
        'startPalette': [[75, 25, 75]],
        'weights': {'ciede2000': 1, 'nameDifference': 0, 'nameUniqueness': 0, 'pairPreference': 0},
        'paletteSize': len(phenotypes)
    }
    now = time.time()
    r = requests.post("http://vrl.cs.brown.edu/color/makePalette",
                      data=json.dumps(payload), allow_redirects=True)
    print((now - time.time()), 'seconds to fetch')
    palette = r.json()['palette']
    rgb_palette = [
        np.array(color.lab2rgb(np.reshape(elem, (1, 1, 3)).astype(float)) * 255, dtype=int).flatten().tolist() for
        elem in palette]
    color_scheme = {}
    for i in range(len(rgb_palette)):
        color_scheme[phenotypes[i]] = {}
        color_scheme[phenotypes[i]]['rgb'] = rgb_palette[i]
        color_scheme[phenotypes[i]]['hex'] = '%02x%02x%02x' % tuple(rgb_palette[i])

    pickle.dump(color_scheme, open(color_scheme_path, 'wb'))
    return color_scheme


def get_rect_cells(datasource, rect, channels):
    global database
    global source
    global ball_tree

    # Load if not loaded
    if datasource != source:
        load_ball_tree(datasource)

    # Query
    index = ball_tree.query_radius([[rect[0], rect[1]]], r=rect[2])
    print('Query size:', len(index[0]))
    neighbors = index[0]
    try:
        neighborhood = []
        for neighbor in neighbors:
            row = database.iloc[[neighbor]]
            obj = row.to_dict(orient='records')[0]
            obj['id'] = str(neighbor)
            if 'phenotype' not in obj:
                obj['phenotype'] = ''
            neighborhood.append(obj)
        return neighborhood
    except:
        return {}


def get_gated_cells(datasource, gates):
    global database
    global source
    global ball_tree

    # Load if not loaded
    if datasource != source:
        load_ball_tree(datasource)

    query_string = ''
    for key, value in gates.items():
        if query_string != '':
            query_string += ' and '
        query_string += str(value[0]) + ' < ' + key + ' < ' + str(value[1])
    if query_string == None or query_string == "":
        return []
    query = database.query(query_string)[['id']].to_dict(orient='records')
    return query


def download_gating_csv(datasource, gates, channels):
    global database
    global source
    global ball_tree

    # Load if not loaded
    if datasource != source:
        load_ball_tree(datasource)

    query_string = ''
    columns = []
    for key, value in gates.items():
        columns.append(key)
        if query_string != '':
            query_string += ' and '
        query_string += str(value[0]) + ' < ' + key + ' < ' + str(value[1])
    ids = database.query(query_string)[['id']].to_numpy().flatten()
    if 'idField' in config[datasource]['featureData'][0]:
        idField = config[datasource]['featureData'][0]['idField']
    else:
        idField = "CellID"
    columns.append(idField)

    csv = database.copy()

    csv[idField] = database['id']
    for channel in channels:
        if channel in gates:
            csv.loc[csv[idField].isin(ids), key] = 1
            csv.loc[~csv[idField].isin(ids), key] = 0
        else:
            csv[channel] = 0

    return csv


def download_gates(datasource, gates, channels):
    global database
    global source
    global ball_tree

    # Load if not loaded
    if datasource != source:
        load_ball_tree(datasource)
    arr = []
    for key, value in channels.items():
        arr.append([key, value[0], value[1]])
    csv = pd.DataFrame(arr)
    csv.columns = ['channel', 'gate_start', 'gate_end']
    csv['gate_active'] = False
    for channel in gates:
        csv.loc[csv['channel'] == channel, 'gate_active'] = True
        csv.loc[csv['channel'] == channel, 'gate_start'] = gates[channel][0]
        csv.loc[csv['channel'] == channel, 'gate_end'] = gates[channel][1]
    return csv


def get_database_description(datasource):
    global database
    global source
    global ball_tree

    # Load if not loaded
    if datasource != source:
        load_ball_tree(datasource)
    description = database.describe().to_dict()
    for column in description:
        [hist, bin_edges] = np.histogram(database[column].to_numpy(), bins=50, density=True)
        midpoints = (bin_edges[1:] + bin_edges[:-1]) / 2
        description[column]['histogram'] = {}
        dat = []
        for i in range(len(hist)):
            obj = {}
            obj['x'] = midpoints[i]
            obj['y'] = hist[i]
            dat.append(obj)
        description[column]['histogram'] = dat
    return description


def generate_zarr_png(datasource, channel, level, tile):
    if config is None:
        load_db(datasource)
    global segmentation_data
    global channels
    global seg
    [tx, ty] = tile.replace('.png', '').split('_')
    tx = int(tx)
    ty = int(ty)
    level = int(level)
    tilesize = 1024
    ix = tx * tilesize
    iy = ty * tilesize
    segmentation = False
    try:
        channel_num = int(re.match(r".*(\d+)", channel).groups()[0])
    except AttributeError:
        segmentation = True

    if segmentation:
        tile = seg[level][iy:iy + tilesize, ix:ix + tilesize]
    else:
        if isinstance(channels, zarr.Array):
            tile = channels[channel_num, iy:iy + tilesize, ix:ix + tilesize]
        else:
            tile = channels[level][channel_num, iy:iy + tilesize, ix:ix + tilesize]

    imgR = ((tile >> 16) % 256).astype('uint8')
    imgG = ((tile >> 8) % 256).astype('uint8')  # high bits
    imgB = (tile % 256).astype('uint8')  # low bits∂
    channel_img = np.dstack((imgR, imgG, imgB))
    return channel_img


def convertOmeTiff(filePath, channelFilePath=None, dataDirectory=None, isLabelImg=False):
    channel_info = {}
    channelNames = []
    if isLabelImg == False:
        channel_io = tf.TiffFile(str(filePath), is_ome=False)
        channels = zarr.open(channel_io.series[0].aszarr())
        if isinstance(channels, zarr.Array):
            channel_info['maxLevel'] = 1
            shape = channels.shape
        else:
            channel_info['maxLevel'] = len(channels)
            shape = channels[0].shape
        channel_info['height'] = shape[1]
        channel_info['width'] = shape[2]
        channel_info['num_channels'] = shape[0]
        for i in range(shape[0]):
            channelName = re.sub(r'\.ome|\.tiff|\.tif|\.png', '', filePath.name) + "_" + str(i)
            channelNames.append(channelName)
        channel_info['channel_names'] = channelNames
        return channel_info
    else:
        channel_io = tf.TiffFile(str(channelFilePath), is_ome=False)
        channels = zarr.open(channel_io.series[0].aszarr())
        seg = tf.imread(filePath, is_ome=False)
        directory = Path(dataDirectory + "/" + filePath.name + ".zarr")
        store = zarr.DirectoryStore(directory)
        g = zarr.group(store=store, overwrite=True)
        if isinstance(channels, zarr.Array):
            data = zarr.array(seg)
            chunks = channels.chunks
            chunks = (chunks[-2], chunks[-1])
            g.create_dataset('0', data=data, shape=seg.shape, chunks=chunks, dtype=seg.dtype)
        else:
            for i in range(len(channels)):
                shape = channels[i].shape
                shape = (shape[-2], shape[-1])
                chunks = channels[i].chunks
                chunks = (chunks[-2], chunks[-1])
                data = seg
                print(shape)
                data = np.array(Image.fromarray(data).resize((shape[-1], shape[-2]), Image.NEAREST))
                print(np.shape(data))
                data = zarr.array(data)
                g.create_dataset(str(i), data=data, shape=shape, chunks=chunks, dtype=seg.dtype)
        return {'segmentation': str(directory)}
