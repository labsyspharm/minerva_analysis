from sklearn.neighbors import BallTree
import numpy as np
import pandas as pd
from skimage import color
import requests
import json
import os
from pathlib import Path
import pyvips
from skimage.io import imread

import time
import pickle
import tifffile as tf
from PIL import Image
import re

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
    index_col = None
    if 'idField' in config[datasource]['featureData'][0]:
        idField = config[datasource]['featureData'][0]['idField']
        if idField != 'none' and idField is not None:
            index_col = idField
    database = pd.read_csv(csvPath, index_col=index_col)
    database['id'] = database.index
    database = database.replace(-np.Inf, 0)
    source = datasource
    seg = pyvips.Image.new_from_file(config[datasource]['segmentation'], n=-1)
    n_channels = config[datasource]['num_channels']
    channels = pyvips.Image.new_from_file(config[datasource]['channels'], n=n_channels)


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


def generate_png(datasource, channel, level, tile):
    global database
    global source
    global config
    global seg
    global channels
    if config is None:
        load_db(datasource)
    segmentation = False
    channel_num = 0
    start = time.time()
    try:
        channel_num = int(re.match(r".*(\d+)_files", channel).groups()[0])
    except AttributeError:
        segmentation = True

    format_to_dtype = {
        'uchar': np.uint8,
        'char': np.int8,
        'ushort': np.uint16,
        'short': np.int16,
        'uint': np.uint32,
        'int': np.int32,
        'float': np.float32,
        'double': np.float64,
        'complex': np.complex64,
        'dpcomplex': np.complex128,
    }
    dtype_to_format = {
        'uint8': 'uchar',
        'int8': 'char',
        'uint16': 'ushort',
        'int16': 'short',
        'uint32': 'uint',
        'int32': 'int',
        'float32': 'float',
        'float64': 'double',
        'complex64': 'complex',
        'complex128': 'dpcomplex',
    }
    print('1', time.time() - start)
    start = time.time()
    height = config[datasource]['height']
    width = config[datasource]['width']

    max_level = int(np.ceil(np.log2(np.max([width, height]))))
    [col, row] = tile.replace('.png', '').split('_')
    tile_region = 128 * 2 ** (max_level - int(level))
    padding = 2 ** (max_level - int(level) + 1)
    # padding = 2
    tile_range_row = [max([int(row) * tile_region - padding, 0]), min([(int(row) + 1) * tile_region + padding, height])]
    tile_range_col = [max([int(col) * tile_region - padding, 0]), min([(int(col) + 1) * tile_region + padding, width])]
    if segmentation is True:
        img = seg
    else:
        img = channels
    start = time.time()
    # region = pyvips.Region.new(img)

    crop_height = tile_range_row[1] - tile_range_row[0]
    crop_width = tile_range_col[1] - tile_range_col[0]
    print('2', time.time() - start)
    start = time.time()

    image_buffer = img.crop(tile_range_col[0], channel_num * height + tile_range_row[0], crop_width, crop_height)
    # print('3', time.time() - start)
    # start = time.time()
    # image = np.ndarray(buffer=image_buffer, dtype=format_to_dtype[img.format], shape=[crop_height, crop_width])
    # print('4', time.time() - start)
    # start = time.time()
    #
    # def numpy2vips(a):
    #     h, w = a.shape
    #     linear = a.reshape(w * h)
    #     vi = pyvips.Image.new_from_memory(linear.data, w, h, 1,
    #                                       dtype_to_format[str(a.dtype)])
    #     return vi
    #
    shrink = image_buffer
    # print('5', time.time() - start)
    # start = time.time()
    scale_factor = 2 ** (max_level - int(level))
    # If I'm resizing
    print('6', time.time() - start)
    start = time.time()
    if scale_factor != 1:
        if segmentation:
            shrink = shrink.reduce(scale_factor, scale_factor, kernel="nearest")
        else:
            shrink = shrink.reduce(scale_factor, scale_factor, kernel="linear")

    image = np.ndarray(buffer=shrink.write_to_memory(),
                       dtype=format_to_dtype[shrink.format],
                       shape=[shrink.height, shrink.width])

    # compare = imread('static/data/' + datasource + '/' + channel + '/' + level + '/' + tile)
    # compare_raw = compare[:, :, 0] * 65536 + compare[:, :, 1] * 256 + compare[:, :, 2]
    # equals = np.array_equal(compare_raw, np.array(image))
    # test = np.abs(compare_raw - image)
    print('7', time.time() - start)
    start = time.time()
    imgR = ((image >> 16) % 256).astype('uint8')
    imgG = ((image >> 8) % 256).astype('uint8')  # high bits
    imgB = (image % 256).astype('uint8')  # low bits
    channel_img = np.dstack((imgR, imgG, imgB))
    print('8', time.time() - start)
    return channel_img


def get_dzi_xml(datasource):
    global config
    if config is None:
        load_config()
    xml = '''<?xml version="1.0" encoding="UTF-8"?>
                <Image xmlns="http://schemas.microsoft.com/deepzoom/2008"
                  Format="png"
                  Overlap="2"
                  TileSize="128"
                  >
                  <Size 
                    Height="{height}"
                    Width="{width}"
                  />
                </Image>
                '''.format(height=config[datasource]['height'], width=config[datasource]['width'])
    return xml
