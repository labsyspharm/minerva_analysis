from sklearn.neighbors import BallTree
import numpy as np
import pandas as pd
from PIL import ImageColor
import json
import os
import io
from pathlib import Path
from pathlib import PurePath
from ome_types import from_xml
from minerva_analysis import config_json_path, data_path, cwd_path
from minerva_analysis.server.utils import pyramid_assemble
from minerva_analysis.server.models import database_model
import dateutil.parser
import time
import pickle
import tifffile as tf
import re
import zarr
import cv2
from sklearn.mixture import GaussianMixture
from scipy.stats import norm
from skimage.measure import block_reduce

ball_tree = None
database = None
source = None
config = None
seg = None
zarray = None
channels = None
metadata = None


def init(datasource_name):
    load_ball_tree(datasource_name)


def load_datasource(datasource_name, reload=False):
    global datasource
    global source
    global config
    global seg
    global zarray
    global channels
    global metadata
    if source is datasource_name and datasource is not None and reload is False:
        return
    load_config(datasource_name)
    if reload:
        load_ball_tree(datasource_name, reload=reload)
    csvPath = Path(config[datasource_name]['featureData'][0]['src'])
    print("Loading csv data.. (this can take some time)")
    datasource = pd.read_csv(csvPath)
    datasource['id'] = datasource.index
    datasource = datasource.replace(-np.Inf, 0)
    source = datasource_name
    print("Loading segmentation.")
    if config[datasource_name]['segmentation'].endswith('.zarr'):
        seg = zarr.load(config[datasource_name]['segmentation'])
    else:
        seg_io = tf.TiffFile(config[datasource_name]['segmentation'], is_ome=False)
        seg = zarr.open(seg_io.series[0].aszarr())
    channel_io = tf.TiffFile(config[datasource_name]['channelFile'], is_ome=False)
    print("Loading image descriptions.")
    try:
        xml = channel_io.pages[0].tags['ImageDescription'].value
        metadata = from_xml(xml).images[0].pixels
    except:
        metadata = {}
    channels = zarr.open(channel_io.series[0].aszarr())

    level_series = next(
        level for level in reversed(channel_io.series[0].levels)
        if all(d >= 200 for d in level.shape[1:])
    )
    zarray = zarr.open(level_series.aszarr())
    if zarray.shape[1] > 400 or zarray.shape[2] > 400:
        x_reduce = zarray.shape[1] // 200
        y_reduce = zarray.shape[2] // 200
        reduce = np.min([x_reduce, y_reduce])
        zarray = block_reduce(zarray, (1, reduce, reduce), np.mean)

    print("Data loading done.")


def load_config(datasource_name):
    global config

    with open(config_json_path, "r+") as configJson:
        config = json.load(configJson)
        updated = False
        # Update Feature SRC
        original = config[datasource_name]['featureData'][0]['src']
        config[datasource_name]['featureData'][0]['src'] = original.replace('static/data', 'minerva_analysis/data')
        csvPath = config[datasource_name]['featureData'][0]['src']
        if Path(csvPath).exists() is False:
            if Path('.' + csvPath).exists():
                csvPath = '.' + csvPath
        config[datasource_name]['featureData'][0]['src'] = str(Path(csvPath))
        if original != config[datasource_name]['featureData'][0]['src']:
            updated = True

        try:
            original = config[datasource_name]['segmentation']
            config[datasource_name]['segmentation'] = original.replace('static/data', 'minerva_analysis/data')
            if original != config[datasource_name]['segmentation']:
                updated = True

        except KeyError:
            print(datasource_name, 'is  missing segmentation')

        if updated:
            configJson.seek(0)  # <--- should reset file position to the beginning.
            json.dump(config, configJson, indent=4)
            configJson.truncate()


def load_ball_tree(datasource_name_name, reload=False):
    global ball_tree
    global datasource
    global config
    if datasource_name_name != source:
        load_datasource(datasource_name_name)

    # old with os.path
    # pickled_kd_tree_path = str(
    #     Path(
    #         os.path.join(os.getcwd())) / data_path / datasource_name_name / "ball_tree.pickle")

    #using pathlib now:
    pickled_kd_tree_path = str(
        PurePath(cwd_path, data_path, datasource_name_name, "ball_tree.pickle"))

    #old os.path way:  if os.path.isfile(pickled_kd_tree_path) and reload is False:
    if Path(pickled_kd_tree_path).is_file() and reload is False:

        print("Pickled KD Tree Exists, Loading")
        ball_tree = pickle.load(open(pickled_kd_tree_path, "rb"))
        print("Pickled KD Tree Loaded.")
    else:
        print("Creating KD Tree.")
        xCoordinate = config[datasource_name_name]['featureData'][0]['xCoordinate']
        yCoordinate = config[datasource_name_name]['featureData'][0]['yCoordinate']
        csvPath = Path(config[datasource_name_name]['featureData'][0]['src'])
        raw_data = pd.read_csv(csvPath)
        points = pd.DataFrame({'x': raw_data[xCoordinate], 'y': raw_data[yCoordinate]})
        ball_tree = BallTree(points, metric='euclidean')
        pickle.dump(ball_tree, open(pickled_kd_tree_path, 'wb'))
        print('Creating KD Tree done.')


def query_for_closest_cell(x, y, datasource_name):
    global datasource
    global source
    global ball_tree
    if datasource_name != source:
        load_ball_tree(datasource_name)
    distance, index = ball_tree.query([[x, y]], k=1)
    if distance == np.inf:
        return {}
    #         Nothing found
    else:
        try:
            row = datasource.iloc[index[0]]
            obj = row.to_dict(orient='records')[0]
            if 'celltype' not in obj:
                obj['celltype'] = ''
            return obj
        except:
            return {}


def get_row(row, datasource_name):
    global database
    global source
    global ball_tree
    if datasource_name != source:
        load_ball_tree(datasource_name)
    obj = database.loc[[row]].to_dict(orient='records')[0]
    obj['id'] = row
    return obj


def get_channel_names(datasource_name, shortnames=True):
    global datasource
    global source
    if datasource_name != source:
        load_ball_tree(datasource_name)
    if shortnames:
        channel_names = [channel['name'] for channel in config[datasource_name]['imageData'][1:]]
    else:
        channel_names = [channel['fullname'] for channel in config[datasource_name]['imageData'][1:]]
    return channel_names


def get_channel_cells(datasource_name, channels):
    global datasource
    global source
    global ball_tree

    range = [0, 65536]

    # Load if not loaded
    if datasource_name != source:
        load_ball_tree(datasource_name)

    query_string = ''
    for c in channels:
        if query_string != '':
            query_string += ' and '
        query_string += str(range[0]) + ' < `' + c + '` < ' + str(range[1])
    if query_string == None or query_string == "":
        return []
    query = datasource.query(query_string)[['id']].to_dict(orient='records')
    return query


def get_phenotype_description(datasource):
    try:
        data = ''
        csvPath = config[datasource]['featureData'][0]['celltypeData']
        if Path(csvPath).is_file():
        #old os.path usage: if os.path.isfile(csvPath):
            data = pd.read_csv(csvPath)
            data = data.to_numpy().tolist()
            # data = data.to_json(orient='records', lines=True)
        return data;
    except KeyError:
        return ''
    except TypeError:
        return ''


def get_phenotype_column_name(datasource):
    try:
        return config[datasource]['featureData'][0]['celltype']
    except KeyError:
        return ''
    except TypeError:
        return ''


def get_cells_phenotype(datasource_name):
    global datasource
    global source
    global ball_tree

    range = [0, 65536]

    # Load if not loaded
    if datasource_name != source:
        load_ball_tree(datasource_name)

    try:
        phenotype_field = config[datasource_name]['featureData'][0]['celltype']
    except KeyError:
        phenotype_field = 'celltype'
    except TypeError:
        phenotype_field = 'celltype'

    query = datasource[['id', phenotype_field]].to_dict(orient='records')
    return query


def get_phenotypes(datasource_name):
    global datasource
    global source
    global config
    try:
        phenotype_field = config[datasource_name]['featureData'][0]['celltype']
    except KeyError:
        phenotype_field = 'celltype'
    except TypeError:
        phenotype_field = 'celltype'

    if datasource_name != source:
        load_ball_tree(datasource_name)
    if phenotype_field in datasource.columns:
        return sorted(datasource[phenotype_field].unique().tolist())
    else:
        return ['']


def get_neighborhood(x, y, datasource_name, r=100, fields=None):
    global database
    global source
    global ball_tree
    if datasource_name != source:
        load_ball_tree(datasource_name)
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

        return neighborhood
    except:
        return {}


def get_number_of_cells_in_circle(x, y, datasource_name, r):
    global source
    global ball_tree
    if datasource_name != source:
        load_ball_tree(datasource_name)
    index = ball_tree.query_radius([[x, y]], r=r)
    try:
        return len(index[0])
    except:
        return 0


def get_color_scheme(datasource_name, refresh, label_field='celltype'):

    # old os.path way:
    # color_scheme_path = str(
    #     Path(os.path.join(os.getcwd())) / data_path / datasource_name / str(
    #         label_field + "_color_scheme.pickle"))

    color_scheme_path = str(PurePath(cwd_path, data_path, datasource_name, str(
            label_field + "_color_scheme.pickle")) )

    if refresh == False:
        #old os.path way:  if os.path.isfile(color_scheme_path):
        if Path(color_scheme_path).is_file():
            print("Color Scheme Exists, Loading")
            color_scheme = pickle.load(open(color_scheme_path, "rb"))
            return color_scheme
    if label_field == 'celltype':
        labels = get_phenotypes(datasource_name)
        print(labels)
    labels.append('SelectedCluster')
    color_scheme = {}
    colors = ["#e41a1c", "#377eb8", "#4daf4a", "#984ea3", "#ff7f00", "#a65628", "#f781bf", "#808080", "#7A4900",
              "#0000A6", "#63FFAC", "#B79762", "#004D43", "#8FB0FF", "#997D87", "#5A0007", "#809693", "#FEFFE6",
              "#1B4400", "#4FC601", "#3B5DFF", "#4A3B53", "#FF2F80", "#61615A", "#BA0900", "#6B7900", "#00C2A0",
              "#FFAA92", "#FF90C9", "#B903AA", "#D16100", "#DDEFFF", "#000035", "#7B4F4B", "#A1C299", "#300018",
              "#0AA6D8", "#013349", "#00846F", "#372101", "#FFB500", "#C2FFED", "#A079BF", "#CC0744", "#C0B9B2",
              "#C2FF99", "#001E09", "#00489C", "#6F0062", "#0CBD66", "#EEC3FF", "#456D75", "#B77B68", "#7A87A1",
              "#788D66", "#885578", "#FAD09F", "#FF8A9A", "#D157A0", "#BEC459", "#456648", "#0086ED", "#886F4C",
              "#34362D", "#B4A8BD", "#00A6AA", "#452C2C", "#636375", "#A3C8C9", "#FF913F", "#938A81", "#575329",
              "#00FECF", "#B05B6F", "#8CD0FF", "#3B9700", "#04F757", "#C8A1A1", "#1E6E00", "#7900D7", "#A77500",
              "#6367A9", "#A05837", "#6B002C", "#772600", "#D790FF", "#9B9700", "#549E79", "#FFF69F", "#201625",
              "#72418F", "#BC23FF", "#99ADC0", "#3A2465", "#922329", "#5B4534", "#FDE8DC", "#404E55", "#0089A3",
              "#CB7E98", "#A4E804", "#324E72", "#6A3A4C", "#83AB58", "#001C1E", "#D1F7CE", "#004B28", "#C8D0F6",
              "#A3A489", "#806C66", "#222800", "#BF5650", "#E83000", "#66796D", "#DA007C", "#FF1A59", "#8ADBB4",
              "#1E0200", "#5B4E51", "#C895C5", "#320033", "#FF6832", "#66E1D3", "#CFCDAC", "#D0AC94", "#7ED379",
              "#012C58", "#7A7BFF", "#D68E01", "#353339", "#78AFA1", "#FEB2C6", "#75797C", "#837393", "#943A4D",
              "#B5F4FF", "#D2DCD5", "#9556BD", "#6A714A", "#001325", "#02525F", "#0AA3F7", "#E98176", "#DBD5DD",
              "#5EBCD1", "#3D4F44", "#7E6405", "#02684E", "#962B75", "#8D8546", "#9695C5", "#E773CE", "#D86A78",
              "#3E89BE", "#CA834E", "#518A87", "#5B113C", "#55813B", "#E704C4", "#00005F", "#A97399", "#4B8160",
              "#59738A", "#FF5DA7", "#F7C9BF", "#643127", "#513A01", "#6B94AA", "#51A058", "#A45B02", "#1D1702",
              "#E20027", "#E7AB63", "#4C6001", "#9C6966", "#64547B", "#97979E", "#006A66", "#391406", "#F4D749",
              "#0045D2", "#006C31", "#DDB6D0", "#7C6571", "#9FB2A4", "#00D891", "#15A08A", "#BC65E9", "#FFFFFE",
              "#C6DC99", "#203B3C", "#671190", "#6B3A64", "#F5E1FF", "#FFA0F2", "#CCAA35", "#374527", "#8BB400",
              "#797868", "#C6005A", "#3B000A", "#C86240", "#29607C", "#402334", "#7D5A44", "#CCB87C", "#B88183",
              "#AA5199", "#B5D6C3", "#A38469", "#9F94F0", "#A74571", "#B894A6", "#71BB8C", "#00B433", "#789EC9",
              "#6D80BA", "#953F00", "#5EFF03", "#E4FFFC", "#1BE177", "#BCB1E5", "#76912F", "#003109", "#0060CD",
              "#D20096", "#895563", "#29201D", "#5B3213", "#A76F42", "#89412E", "#1A3A2A", "#494B5A", "#A88C85",
              "#F4ABAA", "#A3F3AB", "#00C6C8", "#EA8B66", "#958A9F", "#BDC9D2", "#9FA064", "#BE4700", "#658188",
              "#83A485", "#453C23", "#47675D", "#3A3F00", "#061203", "#DFFB71", "#868E7E", "#98D058", "#6C8F7D",
              "#D7BFC2", "#3C3E6E", "#D83D66", "#2F5D9B", "#6C5E46", "#D25B88", "#5B656C", "#00B57F", "#545C46",
              "#866097", "#365D25", "#252F99", "#00CCFF", "#674E60", "#FC009C", "#92896B"]
    for i in range(len(labels)):
        color_scheme[str(labels[i])] = {}
        color_scheme[str(labels[i])]['rgb'] = list(ImageColor.getcolor(colors[i], "RGB"))
        color_scheme[str(labels[i])]['hex'] = colors[i]

    pickle.dump(color_scheme, open(color_scheme_path, 'wb'))
    return color_scheme


def get_rect_cells(datasource_name, rect, channels):
    global datasource
    global source
    global ball_tree

    # Load if not loaded
    if datasource_name != source:
        load_ball_tree(datasource_name)

    # Query
    index = ball_tree.query_radius([[rect[0], rect[1]]], r=rect[2])
    print('Query size:', len(index[0]))
    neighbors = index[0]
    try:
        neighborhood = []
        for neighbor in neighbors:
            row = datasource.iloc[[neighbor]]
            obj = row.to_dict(orient='records')[0]
            if 'celltype' not in obj:
                obj['celltype'] = ''
            neighborhood.append(obj)
        return neighborhood
    except:
        return {}


def get_gated_cells(datasource_name, gates, start_keys):
    global datasource
    global source
    global ball_tree

    # Load if not loaded
    if datasource_name != source:
        load_ball_tree(datasource_name)

    query_string = ''
    query_keys = start_keys
    for key, value in gates.items():
        if query_string != '':
            query_string += ' and '
        query_string += str(value[0]) + ' < `' + key + '` < ' + str(value[1])
        query_keys.append(key)
    if query_string is None or query_string == "":
        return []
    # query_keys[0] is the ID]
    query = datasource.query(query_string)[[query_keys[0]]].to_dict(orient='records')
    return query


def get_gated_cells_custom(datasource_name, gates, start_keys):
    global datasource
    global source
    global ball_tree

    # Load if not loaded
    if datasource_name != source:
        load_ball_tree(datasource_name)

    # Query
    query_string = ''
    query_keys = start_keys
    for key, value in gates.items():
        if query_string != '':
            query_string += ' or '
        query_string += str(value[0]) + ' < `' + key + '` < ' + str(value[1])
        query_keys.append(key)
    if query_string is None or query_string == "":
        return []
    query = datasource.query(query_string)[query_keys].to_dict(orient='records')

    # TODO - likely lighter / less costly
    # query = database.query(query_string)[query_keys].to_dict('split')
    # del query['index']

    return query


def get_all_cells(datasource_name, start_keys, data_type=float):
    global datasource
    global source

    # Load if not loaded
    if datasource_name != source:
        load_ball_tree(datasource_name)

    query = datasource[start_keys].values.flatten('C');
    if np.issubdtype(data_type, int):
        return query.astype(np.uint32)
    return query.astype(np.float32)


def download_gating_csv(datasource_name, gates, channels, encoding):
    global datasource
    global source
    global ball_tree

    # Load if not loaded
    if datasource_name != source:
        load_ball_tree(datasource_name)

    query_string = ''
    columns = []
    for key, value in gates.items():
        columns.append(key)
        if query_string != '':
            query_string += ' and '
        query_string += str(value[0]) + ' < `' + key + '` < ' + str(value[1])
    ids = datasource.query(query_string)[['id']].to_numpy().flatten()
    if 'idField' in config[datasource_name]['featureData'][0]:
        idField = config[datasource_name]['featureData'][0]['idField']
    else:
        idField = "CellID"
    columns.append(idField)

    csv = datasource.copy()

    csv[idField] = datasource['id']
    for channel in channels:
        if channel in gates:
            if encoding == 'binary':
                csv.loc[csv[idField].isin(ids), channel] = 1
            csv.loc[~csv[idField].isin(ids), channel] = 0
        else:
            csv[channel] = 0

    return csv


def download_gates(datasource_name, gates, channels):
    global datasource
    global source
    global ball_tree

    # Load if not loaded
    if datasource_name != source:
        load_ball_tree(datasource_name)
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


def save_gating_list(datasource_name, gates, channels):
    global datasource
    global source
    global ball_tree

    # Load if not loaded
    if datasource_name != source:
        load_ball_tree(datasource_name)
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

    temp = csv.to_dict(orient='records')
    f = pickle.dumps(temp, protocol=4)
    database_model.save_list(database_model.GatingList, datasource=datasource_name, cells=f)


def get_saved_gating_list(datasource_name):
    gating_list = database_model.get(database_model.GatingList, datasource=datasource_name)
    return pickle.loads(gating_list.cells)


def download_channels(datasource_name, map_channels, active_channels, list_colors, list_ranges, list_channels):
    global datasource
    global source
    global ball_tree

    # Load if not loaded
    if datasource_name != source:
        load_ball_tree(datasource_name)
    arr = []
    for channel in map_channels:
        channel_name = map_channels[channel]
        arr.append([channel_name, list_channels[channel_name][0], list_channels[channel_name][1], 255, 255, 255, 1, False])
    csv = pd.DataFrame(arr)
    csv.columns = ['channel', 'start', 'end', 'r', 'g', 'b', 'opacity', 'channel_active']

    for channel in list_colors:
        csv.loc[csv['channel'] == map_channels[channel], 'r'] = list_colors[channel]['color']['r']
        csv.loc[csv['channel'] == map_channels[channel], 'g'] = list_colors[channel]['color']['g']
        csv.loc[csv['channel'] == map_channels[channel], 'b'] = list_colors[channel]['color']['b']
        csv.loc[csv['channel'] == map_channels[channel], 'opacity'] = list_colors[channel]['color']['opacity']
    for channel in active_channels:
        csv.loc[csv['channel'] == map_channels[channel], 'channel_active'] = True

    return csv


def save_channel_list(datasource_name, map_channels, active_channels, list_colors, list_ranges, list_channels):
    global datasource
    global source
    global ball_tree

    # Load if not loaded
    if datasource_name != source:
        load_ball_tree(datasource_name)
    arr = []
    for channel in map_channels:
        channel_name = map_channels[channel]
        arr.append([channel_name, list_channels[channel_name][0], list_channels[channel_name][1], 255, 255, 255, 1, False])
    csv = pd.DataFrame(arr)
    csv.columns = ['channel', 'start', 'end', 'r', 'g', 'b', 'opacity', 'channel_active']

    for channel in list_colors:
        csv.loc[csv['channel'] == map_channels[channel], 'r'] = list_colors[channel]['color']['r']
        csv.loc[csv['channel'] == map_channels[channel], 'g'] = list_colors[channel]['color']['g']
        csv.loc[csv['channel'] == map_channels[channel], 'b'] = list_colors[channel]['color']['b']
        csv.loc[csv['channel'] == map_channels[channel], 'opacity'] = list_colors[channel]['color']['opacity']
    for channel in active_channels:
        csv.loc[csv['channel'] == map_channels[channel], 'channel_active'] = True

    temp = csv.to_dict(orient='records')
    f = pickle.dumps(temp, protocol=4)
    database_model.save_list(database_model.ChannelList, datasource=datasource_name, cells=f)


def get_saved_channel_list(datasource_name):
    channel_list = database_model.get(database_model.ChannelList, datasource=datasource_name)
    return pickle.loads(channel_list.cells)


def get_datasource_description(datasource_name):
    global datasource
    global source
    global ball_tree
    global config

    # Load if not loaded
    if datasource_name != source:
        load_ball_tree(datasource_name)
    description = datasource.describe().to_dict()
    for column in description:
        column_data = datasource[column].to_numpy()
        [hist, bin_edges] = np.histogram(column_data[~np.isnan(column_data)], bins=50, density=True)
        midpoints = (bin_edges[1:] + bin_edges[:-1]) / 2
        description[column]['histogram'] = {}
        dat = []
        for i in range(len(hist)):
            obj = {}
            obj['x'] = midpoints[i]
            obj['y'] = hist[i]
            dat.append(obj)
        description[column]['histogram'] = dat

    list_channels = config[datasource_name]['imageData']
    image_layer = 0
    for channel in list_channels:
        if channel['name'] != 'Area':
            fullName = channel['fullname']

            image_data = zarray[image_layer]
            img_log = np.log(image_data[image_data > 0])
            [hist, bin_edges] = np.histogram(img_log.flatten(), bins=50, density=True)
            midpoints = (bin_edges[1:] + bin_edges[:-1]) / 2
            description[fullName]['image_histogram'] = {}

            dat = []
            for i in range(len(hist)):
                obj = {}
                obj['x'] = midpoints[i]
                obj['y'] = hist[i]
                dat.append(obj)

            description[fullName]['image_histogram'] = dat
            description[fullName]['image_min'] = np.ceil(np.exp(np.min(img_log)))
            description[fullName]['image_max'] = np.ceil(np.exp(np.max(img_log)))

            image_layer += 1
        else:
            continue

    return description


def get_channel_gmm(channel_name, datasource_name):
    global datasource
    global source
    global ball_tree
    global config

    packet_gmm = {}

    # Load if not loaded
    if datasource_name != source:
        load_ball_tree(datasource_name)

    image_channelIdx = next(
        index for (index, d) in enumerate(config[datasource_name]['imageData']) if d["fullname"] == channel_name) - 1
    image_data = zarray[image_channelIdx]
    img_log = np.log(image_data[image_data > 0])
    gmm = GaussianMixture(3, max_iter=1000, tol=1e-6)
    gmm.fit(img_log.reshape((-1, 1)))

    means = gmm.means_[:, 0]
    i0, i1, i2 = np.argsort(means)
    mean1, mean2 = means[[i1, i2]]
    std1, std2 = gmm.covariances_[[i1, i2], 0, 0] ** 0.5

    x = np.linspace(mean1, mean2, 50)
    y1 = norm(mean1, std1).pdf(x) * gmm.weights_[i1]
    y2 = norm(mean2, std2).pdf(x) * gmm.weights_[i2]

    lmax = mean2 + 2 * std2
    lmin = x[np.argmin(np.abs(y1 - y2))]
    if lmin >= mean2:
        lmin = mean2 - 2 * std2
    vmin = max(np.exp(lmin), image_data.min(), 0)
    vmax = min(np.exp(lmax), image_data.max())

    packet_gmm['vmin'] = np.rint(vmin)
    packet_gmm['vmax'] = np.rint(vmax)

    [hist, bin_edges] = np.histogram(img_log.flatten(), bins=50, density=True)
    midpoints = (bin_edges[1:] + bin_edges[:-1]) / 2

    covars = gmm.covariances_[:, 0, 0]
    weights = gmm.weights_
    pdf_gmm1 = weights[i0] * norm.pdf(midpoints, means[i0], np.sqrt(covars[i0]))
    pdf_gmm2 = weights[i1] * norm.pdf(midpoints, means[i1], np.sqrt(covars[i1]))
    pdf_gmm3 = weights[i2] * norm.pdf(midpoints, means[i2], np.sqrt(covars[i2]))

    dat_gmm1 = []
    dat_gmm2 = []
    dat_gmm3 = []
    for i in range(len(hist)):
        obj1 = {}
        obj1['x'] = midpoints[i]
        obj1['y'] = pdf_gmm1[i]
        dat_gmm1.append(obj1)

        obj2 = {}
        obj2['x'] = midpoints[i]
        obj2['y'] = pdf_gmm2[i]
        dat_gmm2.append(obj2)

        obj3 = {}
        obj3['x'] = midpoints[i]
        obj3['y'] = pdf_gmm3[i]
        dat_gmm3.append(obj3)

    packet_gmm['image_gmm_1'] = dat_gmm1
    packet_gmm['image_gmm_2'] = dat_gmm2
    packet_gmm['image_gmm_3'] = dat_gmm3

    return packet_gmm


def get_gating_gmm(channel_name, datasource_name):
    global datasource
    global source
    global ball_tree
    global config

    packet_gmm = {}

    # Load if not loaded
    if datasource_name != source:
        load_ball_tree(datasource_name)
    description = datasource.describe().to_dict()

    column_data = datasource[channel_name].to_numpy()
    [hist, bin_edges] = np.histogram(column_data[~np.isnan(column_data)], bins=50, density=True)
    midpoints = (bin_edges[1:] + bin_edges[:-1]) / 2

    gmm = GaussianMixture(n_components=2)
    gmm.fit(column_data.reshape((-1, 1)))
    i0, i1 = np.argsort(gmm.means_[:, 0])
    packet_gmm['gate'] = np.mean(gmm.means_)

    pdf_gmm1 = [gmm.weights_[i0] * norm.pdf(midpoints, gmm.means_[i0], np.sqrt(gmm.covariances_[i0]))][0][0]
    pdf_gmm2 = [gmm.weights_[i1] * norm.pdf(midpoints, gmm.means_[i1], np.sqrt(gmm.covariances_[i1]))][0][0]

    dat_gmm1 = []
    dat_gmm2 = []
    for i in range(len(hist)):
        obj1 = {}
        obj1['x'] = midpoints[i]
        obj1['y'] = pdf_gmm1[i]
        dat_gmm1.append(obj1)

        obj2 = {}
        obj2['x'] = midpoints[i]
        obj2['y'] = pdf_gmm2[i]
        dat_gmm2.append(obj2)

    packet_gmm['gmm_1'] = dat_gmm1
    packet_gmm['gmm_2'] = dat_gmm2

    return packet_gmm


def generate_zarr_png(datasource_name, channel, level, tile):
    if config is None:
        load_datasource(datasource_name)
    global channels
    global seg
    [tx, ty] = tile.replace('.png', '').split('_')
    tx = int(tx)
    ty = int(ty)
    level = int(level)
    tile_width = config[datasource_name]['tileWidth']
    tile_height = config[datasource_name]['tileHeight']
    ix = tx * tile_width
    iy = ty * tile_height
    segmentation = False
    try:
        channel_num = int(re.match(r".*_(\d*)$", channel).groups()[0])
    except AttributeError:
        segmentation = True
    if segmentation:
        tile = seg[level][iy:iy + tile_height, ix:ix + tile_width]
        if tile.dtype.itemsize != 4:
            tile = tile.astype(np.uint32)
        tile = tile.view('uint8').reshape(tile.shape + (-1,))[..., [0, 1, 2]]
        tile = np.append(tile, np.zeros((tile.shape[0], tile.shape[1], 1), dtype='uint8'), axis=2)
    else:
        if isinstance(channels, zarr.Array):
            tile = channels[channel_num, iy:iy + tile_height, ix:ix + tile_width]
        else:
            tile = channels[level][channel_num, iy:iy + tile_height, ix:ix + tile_width]
            tile = tile.astype('uint16')

    # tile = np.ascontiguousarray(tile, dtype='uint32')
    # png = tile.view('uint8').reshape(tile.shape + (-1,))[..., [2, 1, 0]]
    return tile


def get_ome_metadata(datasource_name):
    if config is None:
        load_datasource(datasource_name)
    global metadata
    return metadata


def convertOmeTiff(filePath, channelFilePath=None, dataDirectory=None, isLabelImg=False):
    channel_info = {}
    channelNames = []

    # image is a normal channel?
    if isLabelImg == False:
        channel_io = tf.TiffFile(str(filePath), is_ome=False)
        channels = zarr.open(channel_io.series[0].aszarr())
        if isinstance(channels, zarr.Array):
            channel_info['maxLevel'] = 1
            chunks = channels.chunks
            shape = channels.shape
        else:
            channel_info['maxLevel'] = len(channels)
            shape = channels[0].shape
            chunks = (1, 1024, 1024)
        chunks = (chunks[-2], chunks[-1])
        channel_info['tileHeight'] = chunks[0]
        channel_info['tileWidth'] = chunks[1]
        channel_info['height'] = shape[1]
        channel_info['width'] = shape[2]
        channel_info['num_channels'] = shape[0]
        for i in range(shape[0]):
            channelName = re.sub(r'\.ome|\.tiff|\.tif|\.png', '', filePath.name) + "_" + str(i)
            channelNames.append(channelName)
        channel_info['channel_names'] = channelNames
        return channel_info

    # segmentation mask
    else:
        channel_io = tf.TiffFile(str(channelFilePath), is_ome=False)
        channels = zarr.open(channel_io.series[0].aszarr())
        write_path = None
        directory = Path(dataDirectory + "/" + filePath.name)
        segmentation_mask = tf.TiffFile(str(filePath), is_ome=False)
        if segmentation_mask.series[0].aszarr().is_multiscales is False:
            args = {}
            args['in_paths'] = [Path(filePath)]
            args['out_path'] = directory
            args['is_mask'] = True
            pyramid_assemble.main(py_args=args)
            write_path = str(directory)
        else:
            write_path = str(filePath)
        return {'segmentation': write_path}


def logTransform(csvPath, skip_columns=[]):
    df = pd.read_csv(csvPath)
    for column in df.columns:
        if column not in skip_columns:
            df[column] = np.log1p(df[column])
    df.to_csv(csvPath, index=False)
