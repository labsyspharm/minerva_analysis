from sklearn.neighbors import BallTree
import numpy as np
import pandas as pd
import json
from pathlib import Path
from pathlib import PurePath
from ome_types import from_xml
from minerva_analysis import config_json_path, data_path, cwd_path
from minerva_analysis.server.utils import pyramid_assemble
from minerva_analysis.server.models import database_model
import pickle
import tifffile as tf
import re
import zarr
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


def get_phenotype_description(datasource):
    try:
        data = ''
        csvPath = config[datasource]['featureData'][0]['celltypeData']
        if Path(csvPath).is_file():
        #old os.path usage: if os.path.isfile(csvPath):
            data = pd.read_csv(csvPath)
            data = data.to_numpy().tolist()
            # data = data.to_json(orient='records', lines=True)
        return data
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
    RAW_DATA = np.genfromtxt(csvPath, names=True, dtype=float, delimiter=',')
    marker_list = pd.read_csv(csvPath).columns
    log_data = RAW_DATA.view((np.float, len(marker_list)))

    for marker_id in range(log_data.shape[1]):
        if marker_list[marker_id] not in skip_columns:
            log_data[:, marker_id] = np.log1p(log_data[:, marker_id])

    with open(csvPath, 'w') as f:
        for marker_id, marker_name in enumerate(marker_list):
            f.write(marker_name)
            if marker_id != (len(marker_list) - 1):
                f.write(',')
        f.write('\n')
        for log_row in log_data:
            for elem_id, norm_elem in enumerate(log_row):
                f.write(str(norm_elem))
                if elem_id != (log_row.shape[0] - 1):
                    f.write(',')
            f.write('\n')
