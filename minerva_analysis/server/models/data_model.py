from sklearn.neighbors import BallTree
import numpy as np
import pandas as pd
from PIL import ImageColor
import palettable
import json
import os
from pathlib import Path
from pathlib import PurePath
from ome_types import from_xml
from minerva_analysis import config_json_path, data_path, cwd_path
from minerva_analysis.server.utils import pyramid_assemble
from minerva_analysis.server.utils import smallestenclosingcircle
import matplotlib.path as mpltPath
from minerva_analysis.server.models import database_model
import dateutil.parser
import time
import pickle
import tifffile as tf
import re
import zarr
from dask import dataframe as dd
import cv2

ball_tree = None
database = None
source = None
config = None
seg = None
channels = None
metadata = None


def init(datasource_name):
    load_ball_tree(datasource_name)


def load_datasource(datasource_name, reload=False):
    global datasource
    global source
    global config
    global seg
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
    if 'celltype' not in datasource.columns:
        embedding_data_path = Path(config[datasource_name]['featureData'][0]['embeddingData'])
        scatter_df = pd.read_csv(embedding_data_path)
        scatter_np = scatter_df.to_numpy()
        if scatter_np.shape[1] > 3:
            datasource['celltype'] = scatter_np[:, 3].astype('int').tolist()
        else:
            datasource['celltype'] = 0
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

    # using pathlib now:
    pickled_kd_tree_path = str(
        PurePath(cwd_path, data_path, datasource_name_name, "ball_tree.pickle"))

    # old os.path way:  if os.path.isfile(pickled_kd_tree_path) and reload is False:
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
        query_string += str(range[0]) + ' < ' + c + ' < ' + str(range[1])
    if query_string == None or query_string == "":
        return []
    query = datasource.query(query_string)[['id']].to_dict(orient='records')
    return query


def get_celltype_column_name(datasource):
    try:
        return config[datasource]['featureData'][0]['celltype']
    except KeyError:
        return 'celltype'
    except TypeError:
        return 'celltype'


def get_phenotype_description(datasource):
    try:
        data = ''
        csvPath = config[datasource]['featureData'][0]['celltypeData']
        if Path(csvPath).is_file():
            # old os.path usage: if os.path.isfile(csvPath):
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


def get_cell_groups(datasource_name):
    global datasource
    global source
    global config
    try:
        if 'celltypeData' in config[datasource_name]['featureData'][0]:
            celltype_data = Path(config[datasource_name]['featureData'][0]['celltypeData'])
            celltype_df = pd.read_csv(celltype_data)
            obj = celltype_df.to_numpy()[:, 1].tolist()
        else:

            celltype_data = sorted(datasource['celltype'].unique())
            obj = [str(i) for i in celltype_data]
        # Test
        return obj
    except:
        return [0]


def get_cells_by_cell_group(datasource_name, cell_group):
    global datasource
    global source
    global config
    try:
        if 'celltypeData' in config[datasource_name]['featureData'][0]:
            celltype_data = Path(config[datasource_name]['featureData'][0]['celltypeData'])
            celltype_df = pd.read_csv(celltype_data)
            group_id = celltype_df[celltype_df.name == cell_group].values[0][0]
        else:
            group_id = int(cell_group)
        fields = [config[datasource_name]['featureData'][0]['xCoordinate'],
                  config[datasource_name]['featureData'][0]['yCoordinate'],
                  config[datasource_name]['featureData'][0]['celltype'], 'id',
                  config[datasource_name]['featureData'][0]['idField']]
        obj = datasource[
            datasource[config[datasource_name]['featureData'][0]['celltype']] == group_id][fields].to_dict(
            orient='records')
        return obj
    except:
        return []


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


def get_color_scheme(datasource_name):
    labels = get_cell_groups(datasource_name)
    color_scheme = {}
    # http://godsnotwheregodsnot.blogspot.com/2013/11/kmeans-color-quantization-seeding.html

    colors = palettable.colorbrewer.qualitative.Set3_12.hex_colors
    colors.remove('#FDB462')
    for i in range(len(labels)):
        color_scheme[str(labels[i])] = {}
        color_scheme[str(labels[i])]['rgb'] = list(ImageColor.getcolor(colors[i], "RGB"))
        color_scheme[str(labels[i])]['hex'] = colors[i]
        color_scheme[str(i)] = {}
        color_scheme[str(i)]['rgb'] = list(ImageColor.getcolor(colors[i], "RGB"))
        color_scheme[str(i)]['hex'] = colors[i]
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


def get_gated_cells(datasource_name, gates):
    global datasource
    global source
    global ball_tree

    # Load if not loaded
    if datasource_name != source:
        load_ball_tree(datasource_name)

    query_string = ''
    for key, value in gates.items():
        if query_string != '':
            query_string += ' and '
        query_string += str(value[0]) + ' < ' + key + ' < ' + str(value[1])
    if query_string == None or query_string == "":
        return []
    query = datasource.query(query_string)[['id']].to_dict(orient='records')
    return query


def download_gating_csv(datasource_name, gates, channels):
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
        query_string += str(value[0]) + ' < ' + key + ' < ' + str(value[1])
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
            csv.loc[csv[idField].isin(ids), key] = 1
            csv.loc[~csv[idField].isin(ids), key] = 0
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


def get_datasource_description(datasource_name):
    global datasource
    global source
    global ball_tree

    # Load if not loaded
    if datasource_name != source:
        load_ball_tree(datasource_name)
    description = datasource.describe(percentiles=[.005, .01, .25, .5, .75, .95, .99, .995]).to_dict()
    for column in description:
        col = datasource[column]
        col = col[(col >= description[column]['1%']) & (col <= description[column]['99%'])]
        col = col.to_numpy()
        [hist, bin_edges] = np.histogram(col, bins=25, density=True)
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


def get_scatterplot_data(datasource_name):
    global config
    global datasource

    embedding_data_path = Path(config[datasource_name]['featureData'][0]['embeddingData'])
    scatter_df = pd.read_csv(embedding_data_path)
    scatter_np = scatter_df.to_numpy()
    # scatter_np[:, 1:3] = datasource[['X_centroid', 'Y_centroid']].to_numpy()
    scatter_np[:, 1:3] = (scatter_np[:, 1:3] - np.min(scatter_np[:, 1:3])) / (
            np.max(scatter_np[:, 1:3]) - np.min(scatter_np[:, 1:3])) * 2 - 1
    try:
        clusters = datasource[get_celltype_column_name(datasource_name)].astype('uint32').values.tolist()
    except:
        clusters = np.zeros((datasource.shape[0],), dtype='int').tolist()
    scatter_np = np.append(scatter_np, np.expand_dims(clusters, 1), 1)
    list_of_obs = [[elem[1], elem[2], int(elem[0]), int(elem[3])] for elem in scatter_np]
    visData = {
        'data': list_of_obs,
        'clusters': clusters
    }
    return visData


def spatial_corr(adata, raw=False, log=False, threshold=None, x_coordinate='X_centroid', y_coordinate='Y_centroid',
                 marker=None, k=500, label='spatial_corr'):
    """
    Parameters
    ----------
    adata : TYPE
        DESCRIPTION.
    raw : TYPE, optional
        DESCRIPTION. The default is False.
    log : TYPE, optional
        DESCRIPTION. The default is False.
    threshold : TYPE, optional
        DESCRIPTION. The default is None.
    x_coordinate : TYPE, optional
        DESCRIPTION. The default is 'X_centroid'.
    y_coordinate : TYPE, optional
        DESCRIPTION. The default is 'Y_centroid'.
    marker : TYPE, optional
        DESCRIPTION. The default is None.
    k : TYPE, optional
        DESCRIPTION. The default is 500.
    label : TYPE, optional
        DESCRIPTION. The default is 'spatial_corr'.
    Returns
    -------
    corrfunc : TYPE
        DESCRIPTION.
    Example
    -------
    adata = spatial_corr (adata, threshold=0.5, x_coordinate='X_position',y_coordinate='Y_position',marker=None)
    """
    # Start
    bdata = adata.copy()
    # Create a DataFrame with the necessary inforamtion
    data = pd.DataFrame({'x': bdata.obs[x_coordinate], 'y': bdata.obs[y_coordinate]})
    # user defined expression matrix
    if raw is True:
        exp = pd.DataFrame(bdata.raw.X, index=bdata.obs.index, columns=bdata.var.index)
    else:
        exp = pd.DataFrame(bdata.X, index=bdata.obs.index, columns=bdata.var.index)
    # log the data if needed
    if log is True:
        exp = np.log1p(exp)
    # set a threshold if needed
    if threshold is not None:
        exp[exp >= threshold] = 1
        exp[exp < threshold] = 0
    # subset markers if needed
    if marker is not None:
        if isinstance(marker, str):
            marker = [marker]
        exp = exp[marker]
    # find the nearest neighbours
    tree = BallTree(data, leaf_size=2)
    dist, ind = tree.query(data, k=k, return_distance=True)
    neighbours = pd.DataFrame(ind, index=bdata.obs.index)
    # find the mean dist
    rad_approx = np.mean(dist, axis=0)
    # Calculate the correlation
    mean = np.mean(exp).values
    std = np.std(exp).values
    A = (exp - mean) / std

    def corrfunc(marker, A, neighbours, ind):
        print('Processing ' + str(marker))
        # Map phenotype
        ind_values = dict(zip(list(range(len(ind))), A[marker]))  # Used for mapping
        # Loop through (all functionized methods were very slow)
        neigh = neighbours.copy()
        for i in neigh.columns:
            neigh[i] = neigh[i].dropna().map(ind_values, na_action='ignore')
        # multiply the matrices
        Y = neigh.T * A[marker]
        corrfunc = np.mean(Y, axis=1)
        # return
        return corrfunc

    # apply function to all markers    # Create lamda function
    r_corrfunc = lambda x: corrfunc(marker=x, A=A, neighbours=neighbours, ind=ind)
    all_data = list(map(r_corrfunc, exp.columns))  # Apply function
    # Merge all the results into a single dataframe
    df = pd.concat(all_data, axis=1)
    df.columns = exp.columns
    df['distance'] = rad_approx
    # add it to anndata object
    adata.uns[label] = df
    # return
    return adata


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
        directory = Path(dataDirectory + "/" + filePath.name)
        args = {}
        args['in_paths'] = [Path(filePath)]
        args['out_path'] = directory
        args['is_mask'] = True
        pyramid_assemble.main(py_args=args)
        return {'segmentation': str(directory)}


def get_cells_in_polygon(datasource_name, points, similar_neighborhood=False):
    global config
    global ball_tree
    point_tuples = [(e['imagePoints']['x'], e['imagePoints']['y']) for e in points]
    (x, y, r) = smallestenclosingcircle.make_circle(point_tuples)
    fields = [config[datasource_name]['featureData'][0]['xCoordinate'],
              config[datasource_name]['featureData'][0]['yCoordinate'],
              config[datasource_name]['featureData'][0]['celltype'], 'id',
              config[datasource_name]['featureData'][0]['idField']]
    index = ball_tree.query_radius([[x, y]], r=r)
    cells = index[0]
    circle_cells = datasource.iloc[cells][fields].values
    path = mpltPath.Path(point_tuples)
    inside = path.contains_points(circle_cells[:, [0, 1]].astype('float'))
    neighbor_ids = circle_cells[np.where(inside == True), 3].flatten().tolist()
    # obj = get_neighborhood_stats(datasource_name, neighbor_ids, fields=fields)
    # try:
    if fields and len(fields) > 0:
        if len(fields) > 1:
            poly_cells = datasource.iloc[neighbor_ids][fields].to_dict(orient='records')
        else:
            poly_cells = datasource.iloc[neighbor_ids][fields].to_dict()
    else:
        poly_cells = datasource.iloc[neighbor_ids].to_dict(orient='records')
    return poly_cells


def get_cells(elem, datasource_name):
    global datasource
    global source
    global config
    fields = [config[datasource_name]['featureData'][0]['xCoordinate'],
              config[datasource_name]['featureData'][0]['yCoordinate'],
              config[datasource_name]['featureData'][0]['celltype'], 'id',
              config[datasource_name]['featureData'][0]['idField']]
    ids = np.array(elem['ids'])
    obj = datasource.iloc[ids][fields].to_dict(orient='records')
    return obj


def save_dot(datasource_name, dot):
    database_model.create_or_update(database_model.Dot, id=dot['id'], datasource=datasource_name, group=dot['group'],
                                    name=dot['name'], description=dot['description'], shape_type=dot['shape_type'],
                                    shape_info=dot['shape_info'], cell_ids=dot['cell_ids'],
                                    date=dateutil.parser.parse(dot['date']), image_data=dot['image_data'],
                                    viewer_info=dot['viewer_info'], channel_info=dot['channel_info'])


def load_dots(datasource_name):
    dots = database_model.get_all(database_model.Dot, datasource=datasource_name)
    print(dots)
    return dots


def delete_dot(datasource_name, id):
    database_model.edit(database_model.Dot, id, 'is_deleted', True)
    return True
