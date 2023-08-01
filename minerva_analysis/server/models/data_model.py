from sklearn.mixture import GaussianMixture
from sklearn.preprocessing import MinMaxScaler
import numba
from sklearn.neighbors import BallTree
from numba import prange
import math
import hdbscan
import numpy_indexed as npi
from sklearn.decomposition import PCA
from sqlalchemy import or_
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
from minerva_analysis.server.utils import pyramid_assemble, pyramid_upgrade
from minerva_analysis.server.models import database_model
import dateutil.parser
import time
import matplotlib.path as mpltPath
import matplotlib.pyplot as plt
import umap

from minerva_analysis.server.utils import smallestenclosingcircle
from minerva_analysis.server.models import database_model
from scipy.stats import pearsonr, spearmanr
from copy import deepcopy

import time
import pickle
import tifffile as tf
import re
import zarr
import cv2
from numcodecs import Blosc
from scipy import spatial
from pycave.bayes import gmm
from sklearn.mixture import GaussianMixture
from scipy.stats import norm
from skimage.measure import block_reduce

useChannels = True
ball_tree = None
database = None
datasource = None
source = None
config = None
seg = None
zarray = None
channels = None
metadata = None
np_datasource = None
zarr_perm_matrix = None
log_norm_neighborhood = False


def init(datasource_name, isChannels=True):
    global useChannels
    useChannels = isChannels;
    load_datasource(datasource_name)

#gater
def load_datasource(datasource_name, reload=False):
    print("def:load_datasource")
    global datasource
    global source
    global config
    global seg
    global zarray
    global channels
    global metadata
    global zarr_perm_matrix
    global np_datasource
    if source is datasource_name and datasource is not None and reload is False:
        return
    load_config(datasource_name)
    csvPath = Path(config[datasource_name]['featureData'][0]['src'])
    print("Loading csv data.. (this can take some time)")
    # datasource = pd.read_csv(csvPath)
    datasource = load_csv(datasource_name)
    datasource['id'] = datasource.index
    datasource = datasource.replace(-np.Inf, 0)
    source = datasource_name
    timer = time.time()
    print('Loading', time.time() - timer)

    # Cell Types
    if 'linkedDatasets' not in config[datasource_name]:
        linked = [datasource_name]
    else:
        linked = config[datasource_name]['linkedDatasets']
    for ds in linked:
        if 'neighborhoods' not in config[ds]:
            print('No Neighborhood')
            matrix_file_name = ds + "_matrix.pk"
            matrix_paths = Path(
                data_path) / ds / matrix_file_name
            perm_data = get_perm_data(ds, matrix_paths)
            print('Creating Matrix', ds)
            matrix = create_matrix(perm_data['phenotypes_array'], perm_data['len_phenos'], perm_data['neighbors'],
                                   perm_data['distances'], numba.typed.List(perm_data['lengths']))

            matrix[np.isnan(matrix)] = 0

            print('Created Matrix', ds)
            neighborhood_path = Path(
                data_path) / ds / 'neighborhood.npy'

            np.save(neighborhood_path, matrix)
            config[ds]['neighborhoods'] = str(neighborhood_path)
            save_config()

    if 'embedding' not in config[datasource_name]:
        if 'linkedDatasets' not in config[datasource_name]:
            create_embedding([datasource_name])
        else:
            create_embedding(config[datasource_name]['linkedDatasets'])


    np_datasource = load_csv(datasource_name, numpy=True)
    # if reload:
    load_ball_tree(datasource_name, reload=reload)
    print("Loading segmentation.")
    if config[datasource_name]['segmentation'].endswith('.zarr'):
        seg = zarr.load(config[datasource_name]['segmentation'])
    else:
        seg_io = tf.TiffFile(config[datasource_name]['segmentation'], is_ome=False)
        seg = zarr.open(seg_io.series[0].aszarr())
    channel_io = tf.TiffFile(config[datasource_name]['channelFile'], is_ome=False)
    print("Loading image descriptions.")
    # metadata = get_ome_metadata(datasource_name)
    try:
        xml = channel_io.pages[0].tags['ImageDescription'].value
        metadata = from_xml(xml).images[0].pixels
    except:
        metadata = {}
    channels = zarr.open(channel_io.series[0].aszarr())

    # init_clusters(datasource_name)
    if 'linkedDatasets' not in config[datasource_name] or len(config[datasource_name]['linkedDatasets']) == 1:
        zarr_file_name = datasource_name + "_perm.zarr"
        zarr_path = Path(
            data_path) / datasource_name / zarr_file_name
        zarr_perm_matrix = zarr.load(zarr_path)

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

#visinity
# @profile
def load_csv(datasource_name, numpy=False):
    print("def:load_csv")
    global config
    global useChannels
    numpy_file_name = datasource_name + "_np.npy"
    numpy_path = Path(
        data_path) / datasource_name / numpy_file_name
    if numpy:
        if numpy_path.is_file():
            return np.load(numpy_path, allow_pickle=True)

    csvPath = Path(config[datasource_name]['featureData'][0]['src'])

    df = pd.read_csv(csvPath, index_col=None)
    # df = dd.read_csv(csvPath, assume_missing=True).set_index('id')
    
    #Visinity drops channels but we need them...
    if (not useChannels):
        df = df.drop(get_channel_names(datasource_name, shortnames=False), axis=1)
    df['id'] = df.index
    # df['Cluster'] = embedding[:, -1].astype('int32').tolist()

    if 'CellType' in df.columns:
        df = df.rename(columns={'CellType': 'phenotype'})
    if 'celltype' in config[datasource_name]['featureData'][0]:
        df = df.rename(columns={config[datasource_name]['featureData'][0]['celltype']: 'phenotype'})

    if np.issubdtype(df['phenotype'].dtype, np.number) is False:
        df['phenotype'] = df['phenotype'].apply(lambda x: x.strip())

    if 'celltypeData' in config[datasource_name]['featureData'][0]:
        cellTypePath = Path(config[datasource_name]['featureData'][0]['celltypeData'])
        type_list = pd.read_csv(cellTypePath).to_numpy().tolist()
        type_ids = [e[0] for e in type_list]
        type_string = [e[1].strip() for e in type_list]
        df['phenotype'] = df['phenotype'].replace(type_ids, type_string)

    df = df.replace(-np.Inf, 0)
    if numpy:
        # np_df = df.compute().to_numpy()
        np_df = df.to_numpy()
        np.save(str(numpy_path), np_df)
        return np_df
    else:
        return df

#visinity
def init_clusters(datasource_name):
    print("def:init_clusters")
    global datasource
    global source
    # Select Cluster Stats
    # clusters = np.sort(datasource['Cluster'].unique().compute().tolist())
    clusters = np.sort(datasource['Cluster'].unique().tolist())

    for cluster in clusters:
        # Check if the Cluster is in the DB
        neighborhood = database_model.get(database_model.Neighborhood, datasource=datasource_name, source="Cluster",
                                          cluster_id=int(cluster))
        cluster_cells = None
        # If it's not in the Neighborhood database then create and add it
        if neighborhood is None:
            cluster_cells = datasource.loc[datasource['Cluster'] == cluster]
            # indices = np.array(cluster_cells.index.values.compute().tolist())
            indices = np.array(cluster_cells.index.values.tolist())
            f = io.BytesIO()
            np.save(f, indices)
            neighborhood = database_model.create(database_model.Neighborhood, cluster_id=int(cluster),
                                                 datasource=datasource_name,
                                                 source="Cluster",
                                                 name="Cluster " + str(cluster), cells=f.getvalue())

        else:
            indices = np.load(io.BytesIO(neighborhood.cells))
            cluster_cells = None

        neighborhood_stats = database_model.get(database_model.NeighborhoodStats, neighborhood=neighborhood)

        # Similarly, if the stats are not initialized, let's store them in the DB as well
        if neighborhood_stats is None:
            obj = get_neighborhood_stats(datasource_name, indices, np_datasource)
            f = io.BytesIO()
            pickle.dump(obj, f)
            neighborhood_stats = database_model.create(database_model.NeighborhoodStats, datasource=datasource_name,
                                                       source="Cluster",
                                                       name="ClusterStats " + str(cluster), stats=f.getvalue(),
                                                       neighborhood=neighborhood)

#visinity
def get_cluster_cells(datasource_name):
    print("def:get_cluster_cells")
    global datasource
    global source
    clusters = datasource['Cluster'].unique().tolist()
    # clusters = datasource['Cluster'].unique().compute().tolist()
    obj = {}
    for cluster in clusters:
        # Check if the Cluster is in the DB
        neighborhood = database_model.get(database_model.Neighborhood, datasource=datasource_name,
                                          cluster_id=int(cluster))
        neighborhood_stats = database_model.get(database_model.NeighborhoodStats, neighborhood=neighborhood)
        obj[str(cluster)] = pickle.load(io.BytesIO(neighborhood_stats.stats))
    return obj

#visinity
def get_neighborhood_list(datasource_name):
    print("def:get_neighborhood_list")
    filtered_neighborhoods = database_model.filter_all(database_model.Neighborhood,
                                                       or_(database_model.Neighborhood.datasource == datasource_name,
                                                           database_model.Neighborhood.datasource == "Multi"))
    return [(neighborhood.id, neighborhood.cluster_id, neighborhood.name, neighborhood.source) for neighborhood in
            filtered_neighborhoods]

#visinity
def edit_neighborhood(elem, datasource_name):
    database_model.edit(database_model.Neighborhood, elem['id'], elem['editField'], elem['editValue'])
    return get_neighborhood_list(datasource_name)

#visinity
def get_neighborhood(elem, datasource_name, mode='single'):
    global config
    neighborhood = database_model.get(database_model.Neighborhood, id=elem['id'])
    neighborhood_stats = database_model.get(database_model.NeighborhoodStats, neighborhood=neighborhood)
    if neighborhood_stats:
        obj = pickle.load(io.BytesIO(neighborhood_stats.stats))
        if mode != 'multi':
            return obj
        else:
            if neighborhood.datasource != 'Multi':
                wrapper_obj = {}
                wrapper_obj['composition_summary'] = obj['composition_summary']
                wrapper_obj[neighborhood.datasource] = obj
                selection_ids = None
                index_sum = 0
                for dataset in config[datasource_name]['linkedDatasets']:
                    np_df = load_csv(dataset, numpy=True)
                    if neighborhood.datasource == dataset:
                        selection_ids = np.array([elem['id'] for elem in obj['cells']]) + index_sum
                    index_sum = index_sum + len(np_df)
                wrapper_obj['selection_ids'] = selection_ids.tolist()
                return wrapper_obj
            else:
                obj['composition_summary'] = weight_multi_image_neighborhood(obj, datasource_name,
                                                                             len(obj['selection_ids']))
                # Deleting redundant data
                for dataset in config[datasource_name]['linkedDatasets']:
                    if 'dataset' in obj and dataset != datasource_name:
                        del obj[dataset]['composition_summary']['selection_neighborhoods']
                        del obj[dataset]['composition_summary']['selection_ids']
                return obj


    else:
        return []

#visinity
def get_all_neighborhood_stats(datasource_name):
    scaler = MinMaxScaler(feature_range=(-1, 1)).fit([[0], [np.max(
        [config[datasource_name]['height'], config[datasource_name]['width']])]])

    def get_stats(neighborhood):
        nonlocal scaler
        neighborhood_stats = database_model.get(database_model.NeighborhoodStats, neighborhood=neighborhood,
                                                datasource=datasource_name)
        if neighborhood_stats is None:
            return {}
        stats = pickle.load(io.BytesIO(neighborhood_stats.stats))
        stats['neighborhood_id'] = neighborhood_stats.neighborhood_id
        stats['name'] = neighborhood_stats.name
        stats['neighborhood_name'] = neighborhood.name
        x_field = config[datasource_name]['featureData'][0]['xCoordinate']
        y_field = config[datasource_name]['featureData'][0]['yCoordinate']
        stats['cells'] = np.array([[elem[x_field], elem[y_field], elem['id']] for elem in stats['cells']])
        stats['cells'] = stats['cells'].astype(float)
        stats['cells'][:, 0:1] = MinMaxScaler(feature_range=(-1, 1)).fit(
            [[0], [config[datasource_name]['width']]]).transform(stats['cells'][:, 0:1])
        stats['cells'][:, 1:2] = MinMaxScaler(feature_range=(-1, 1)).fit(
            [[0], [config[datasource_name]['height']]]).transform(stats['cells'][:, 1:2])
        stats['cells'] = [[elem[0], elem[1], int(elem[2])] for id, elem in enumerate(stats['cells'])]
        return stats

    neighborhoods = database_model.get_all(database_model.Neighborhood, datasource=datasource_name)
    obj = [get_stats(neighborhood) for neighborhood in neighborhoods]
    # phenotypes_dict = {val: idx for idx, val in enumerate(sorted(datasource.phenotype.unique()))}
    # phenotypes_array = np_df[:, get_column_indices(['phenotype'])]
    # for i in range(phenotypes_array.shape[0]):
    #     phenotypes_array[i, 0] = phenotypes_dict[phenotypes_array[i, 0]]
    # phenotypes_array = np.array(phenotypes_array, dtype='uint16')
    # data = np.hstack((data, phenotypes_array))
    return obj

#visinity
def save_lasso(polygon, datasource_name):
    print("def:save_lasso")
    max_cluster_id = database_model.max(database_model.NeighborhoodStats, 'neighborhood_id')
    np_polygon = np.array(polygon['coordinates'])
    f = io.BytesIO()
    np.save(f, np_polygon)
    neighborhood = database_model.create(database_model.Neighborhood, cluster_id=max_cluster_id + 1,
                                         datasource=datasource_name,
                                         source="Lasso",
                                         name="Lasso " + str(max_cluster_id + 1), cells=f.getvalue())
    f = io.BytesIO()
    pickle.dump(polygon['coordinates'], f)
    database_model.create(database_model.NeighborhoodStats, datasource=datasource_name,
                          source=source,
                          name="", stats=f.getvalue(),
                          neighborhood=neighborhood)
    return get_neighborhood_list(datasource_name)

#visinity
def save_neighborhood(selection, datasource_name, source="Cluster", mode='single'):
    phenotype_list = get_phenotypes(datasource_name)
    max_cluster_id = database_model.max(database_model.NeighborhoodStats, 'neighborhood_id')
    if max_cluster_id is None:
        max_cluster_id = -1
    if mode == 'single':

        indices = np.array([e['id'] for e in selection['cells']])
        f = io.BytesIO()
        np.save(f, indices)
        neighborhood = database_model.create(database_model.Neighborhood, cluster_id=max_cluster_id + 1,
                                             datasource=datasource_name,
                                             source=source,
                                             name="", cells=f.getvalue())
        f = io.BytesIO()
        if 'p_value' not in selection:
            query_vector = []
            for i, phenotype in enumerate(phenotype_list):
                query_vector.append(selection['composition_summary']['weighted_contribution'][i][1])

            neighborhood_query = {'query_vector': query_vector, 'disabled': [], 'threshold': 0.8}
            _, p_value = similarity_search(datasource_name, neighborhood_query, calc_p_value=True)
            selection['p_value'] = p_value
            selection['num_results'] = len(selection['cells'])
        pickle.dump(selection, f)
        database_model.create(database_model.NeighborhoodStats, datasource=datasource_name,
                              source=source,
                              name="", stats=f.getvalue(),
                              neighborhood=neighborhood)

    else:
        sorted_ids = np.array(sorted(selection['selection_ids']))
        index_sum = 0
        obj = {}
        for dataset in config[datasource_name]['linkedDatasets']:
            np_df = load_csv(dataset, numpy=True)
            next_sum = index_sum + len(np_df)
            relevant_ids = sorted_ids[np.where((sorted_ids >= index_sum) & (sorted_ids < next_sum))]
            relevant_ids = relevant_ids - index_sum
            obj[dataset] = get_neighborhood_stats(dataset, relevant_ids, np_df,
                                                  compute_neighbors=False)
            obj[dataset]['selection_ids'] = np.array(relevant_ids).astype(int).flatten().tolist()
            index_sum += len(np_df)
        # Simon
        indices_obj = {}
        f = io.BytesIO()
        pickle.dump(sorted_ids, f)

        neighborhood = database_model.create(database_model.Neighborhood,
                                             datasource='Multi', source=source, custom=True,
                                             cluster_id=max_cluster_id + 1,
                                             name="",
                                             cells=f.getvalue())

        obj['selection_ids'] = sorted_ids.astype(int).tolist()
        f = io.BytesIO()
        pickle.dump(obj, f)

        neighborhood_stats = database_model.create(database_model.NeighborhoodStats, datasource='Multi',
                                                   source="Cluster",
                                                   custom=True,
                                                   name="", stats=f.getvalue(),
                                                   neighborhood=neighborhood)
    return get_neighborhood_list(datasource_name)

#visinity
def delete_neighborhood(elem, datasource_name):
    database_model.edit(database_model.Neighborhood, elem['id'], 'is_deleted', True)
    new_neighborhoods = database_model.get_all(database_model.Neighborhood, datasource=datasource_name)
    print('Count', len(new_neighborhoods))
    return [(neighborhood.id, neighborhood.cluster_id, neighborhood.name, neighborhood.source) for neighborhood in
            new_neighborhoods]

#visinity
def download_neighborhood(elem, datasource_name):
    neighborhood = database_model.get(database_model.Neighborhood, id=elem['id'])
    neighborhood_stats = database_model.get(database_model.NeighborhoodStats, neighborhood=neighborhood)
    if neighborhood_stats:
        indices = np.load(io.BytesIO(neighborhood.cells))
        np_df = load_csv(datasource_name, numpy=True)
        column_index = get_column_indices([get_cell_id_field(datasource_name)])
        cell_ids = np_df[indices, column_index]
        cell_ids_df = pd.DataFrame(cell_ids)
        cell_ids_df.columns = [get_cell_id_field(datasource_name)]
        return cell_ids_df
    else:
        return pd.DataFrame([])

#visinity
def load_neighborhood_matrix(datasource_name):
    global config
    global log_norm_neighborhood
    if log_norm_neighborhood:
        if 'log_neighborhoods' in config[datasource_name]:
            log_neighborhood_path = Path(config[datasource_name]['log_neighborhoods'])
            if log_neighborhood_path.exists():
                matrix = np.load(Path(config[datasource_name]['log_neighborhoods']))
                matrix[np.isnan(matrix)] = 0
                matrix[matrix < 0] = 0
                matrix[matrix > 1] = 1
                return matrix
        matrix_file_name = datasource_name + "_matrix.pk"
        matrix_paths = Path(
            data_path) / datasource_name / matrix_file_name
        perm_data = get_perm_data(datasource_name, matrix_paths)
        matrix = create_matrix(perm_data['phenotypes_array'], perm_data['len_phenos'], perm_data['neighbors'],
                               perm_data['distances'], numba.typed.List(perm_data['lengths']), False)
        matrix[np.isnan(matrix)] = 0
        log_matrix = np.log(matrix)
        log_matrix[log_matrix < 0] = 0
        row_sums = log_matrix.sum(axis=1)
        log_matrix = log_matrix / row_sums[:, np.newaxis]
        log_matrix[np.isnan(matrix)] = 0
        log_matrix[log_matrix > 1] = 1


        neighborhood_path = Path(
            data_path) / datasource_name / 'log_neighborhood.npy'
        np.save(neighborhood_path, log_matrix)
        config[datasource_name]['log_neighborhoods'] = str(neighborhood_path)
        save_config()
        return np.load(Path(config[datasource_name]['log_neighborhoods']))
    else:
        neighborhood_path = Path(config[datasource_name]['neighborhoods'])
        if neighborhood_path.exists() is False:
            matrix_file_name = datasource_name + "_matrix.pk"
            matrix_paths = Path(
                data_path) / datasource_name / matrix_file_name
            perm_data = get_perm_data(datasource_name, matrix_paths)
            matrix = create_matrix(perm_data['phenotypes_array'], perm_data['len_phenos'], perm_data['neighbors'],
                                   perm_data['distances'], numba.typed.List(perm_data['lengths']), True)

            matrix[np.isnan(matrix)] = 0
            neighborhood_path = Path(
                data_path) / datasource_name / 'neighborhood.npy'
            np.save(neighborhood_path, matrix)
            config[datasource_name]['neighborhoods'] = str(neighborhood_path)
            save_config()

        matrix = np.load(Path(config[datasource_name]['neighborhoods']))
        matrix[np.isnan(matrix)] = 0
        matrix[matrix < 0] = 0
        matrix[matrix > 1] = 1
        return matrix

#visinity
def get_neighborhood_by_phenotype(datasource_name, phenotype, selection_ids=None):
    global datasource
    # Load if not loaded
    if datasource_name != source:
        load_datasource(datasource_name)

    fields = [config[datasource_name]['featureData'][0]['xCoordinate'],
              config[datasource_name]['featureData'][0]['yCoordinate'], 'id']
    if isinstance(phenotype, list):
        cell_ids = datasource.loc[datasource['phenotype'].isin(phenotype)].index.values
    else:
        # cell_ids = datasource.loc[datasource['phenotype'].isin([phenotype, 'CD4 T cells', 'CD 8 T cells'])].index.values
        cell_ids = datasource.loc[datasource['phenotype'] == phenotype].index.values
    if selection_ids:
        cell_ids = np.intersect1d(np.array(selection_ids), cell_ids)
    obj = get_neighborhood_stats(datasource_name, cell_ids, np_datasource, fields=fields)
    return obj

#visinity
def brush_selection(datasource_name, brush, selection_ids):
    print("def:brush_selection")
    global datasource
    global config
    phenotype_list = get_phenotypes(datasource_name)
    fields = [config[datasource_name]['featureData'][0]['xCoordinate'],
              config[datasource_name]['featureData'][0]['yCoordinate'], 'phenotype', 'id']
    # Load if not loaded
    selection_ids = np.array(selection_ids)
    if datasource_name != source:
        load_datasource(datasource_name)
    neighborhoods = load_neighborhood_matrix(datasource_name)
    valid_ids = selection_ids
    for pheno, brush_range in brush.items():
        pheno_col = phenotype_list.index(pheno)
        these_ids = np.argwhere(
            (neighborhoods[:, pheno_col] >= brush_range[0]) & (
                    neighborhoods[:, pheno_col] <= brush_range[1])).flatten()
        valid_ids = np.intersect1d(valid_ids, these_ids)
    obj = get_neighborhood_stats(datasource_name, valid_ids, np_datasource, fields=fields)
    return obj


#

#visinity
def create_custom_clusters(datasource_name, num_clusters, mode='single', subsample=True):
    print("def:create_custom_clusters")
    global config
    global datasource
    phenotype_list = get_phenotypes(datasource_name)
    database_model.delete(database_model.Neighborhood, custom=True)
    database_model.delete(database_model.NeighborhoodStats, custom=True)
    max_cluster_id = database_model.max(database_model.NeighborhoodStats, 'neighborhood_id')
    if max_cluster_id is None:
        max_cluster_id = 0

    if mode == 'single':

        data = np.load(Path(config[datasource_name]['embedding']))
        # # TODO REMOVE CLUSTER HARDCODE
        # coords = data[:, 0:2]
        # neighborhoods = load_neighborhood_matrix(datasource_name)
        # pcaed = PCA(n_components=2).fit_transform(neighborhoods)
        # data = np.hstack((data, pcaed))
        if subsample:
            g_mixtures = GaussianMixture(n_components=num_clusters)
        else:
            g_mixtures = gmm.GaussianMixture(num_components=num_clusters)
        g_mixtures.fit(data)
        clusters = np.array(g_mixtures.predict(data))
        for cluster in np.sort(np.unique(clusters)).astype(int).tolist():
            indices = np.argwhere(clusters == cluster).flatten()
            f = io.BytesIO()
            np.save(f, indices)
            neighborhood = database_model.create(database_model.Neighborhood,
                                                 datasource=datasource_name, source="Cluster", custom=True,
                                                 cluster_id=max_cluster_id + 1,
                                                 name="Cluster " + str(cluster + 1) + " / " + str(num_clusters),
                                                 cells=f.getvalue())

            obj = get_neighborhood_stats(datasource_name, indices, np_datasource)
            query_vector = []
            for i, phenotype in enumerate(phenotype_list):
                query_vector.append(obj['composition_summary']['weighted_contribution'][i][1])

            neighborhood_query = {'query_vector': query_vector, 'disabled': [], 'threshold': 0.8}
            # _, p_value = similarity_search(datasource_name, neighborhood_query, calc_p_value=True)
            obj['p_value'] = 0.0
            obj['num_results'] = len(obj['cells'])
            f = io.BytesIO()
            pickle.dump(obj, f)

            neighborhood_stats = database_model.create(database_model.NeighborhoodStats, datasource=datasource_name,
                                                       source="Cluster",
                                                       custom=True,
                                                       name="ClusterStats " + str(cluster), stats=f.getvalue(),
                                                       neighborhood=neighborhood)
            max_cluster_id += 1
    else:
        combined_neighborhoods = get_all_cell_neighborhoods(datasource_name, mode, sample_size=10000)
        combined_embedding = None
        for dataset in config[datasource_name]['linkedDatasets']:
            embedding = np.load(Path(config[dataset]['embedding']))
            if combined_embedding is None:
                combined_embedding = embedding
            else:
                combined_embedding = np.vstack((combined_embedding, embedding))

        max_cluster_id = database_model.max(database_model.NeighborhoodStats, 'neighborhood_id')
        if max_cluster_id is None:
            max_cluster_id = 0
        if subsample:
            g_mixtures = GaussianMixture(n_components=num_clusters)
        else:
            g_mixtures = gmm.GaussianMixture(num_components=num_clusters)

        pca = PCA(n_components=2).fit(combined_neighborhoods['full_neighborhoods'])
        pcaed = pca.transform(combined_neighborhoods['full_neighborhoods'])
        combined_embedding = combined_embedding[
                             np.random.choice(combined_embedding.shape[0], pcaed.shape[0], replace=True), :]
        data = np.hstack((combined_embedding, combined_embedding, combined_embedding, pcaed))
        g_mixtures.fit(data)
        obj = {}

        for dataset in config[datasource_name]['linkedDatasets']:
            embedding = np.load(Path(config[dataset]['embedding']))
            neighborhoods = pca.transform(np.load(Path(config[dataset]['neighborhoods'])))
            data = np.hstack((embedding, neighborhoods))
            obj[dataset] = g_mixtures.predict(data)
        cluster_obj = {}
        for i in range(num_clusters):
            indices_obj = {}
            for dataset in config[datasource_name]['linkedDatasets']:
                indices_obj[dataset] = np.argwhere(obj[dataset] == i).flatten()

            f = io.BytesIO()
            pickle.dump(obj, f)

            neighborhood = database_model.create(database_model.Neighborhood,
                                                 datasource='Multi', source="Cluster", custom=True,
                                                 cluster_id=max_cluster_id + 1,
                                                 name="Custom Cluster " + str(i) + " / " + str(num_clusters),
                                                 cells=f.getvalue())
            selection_ids = np.array([])
            index_sum = 0
            for dataset in config[datasource_name]['linkedDatasets']:
                np_df = load_csv(dataset, numpy=True)
                cluster_obj[dataset] = get_neighborhood_stats(dataset, indices_obj[dataset], np_df,
                                                              compute_neighbors=False)
                cluster_obj[dataset]['selection_ids'] = np.array(indices_obj[dataset]).astype(int).flatten().tolist()
                selection_ids = np.concatenate([selection_ids, indices_obj[dataset] + index_sum])
                cluster_obj[dataset]['p_value'] = 0.0
                cluster_obj[dataset]['num_results'] = len(cluster_obj[dataset]['cells'])
                index_sum += len(np_df)
            cluster_obj['selection_ids'] = selection_ids.astype(int).tolist()
            f = io.BytesIO()
            pickle.dump(cluster_obj, f)

            neighborhood_stats = database_model.create(database_model.NeighborhoodStats, datasource='Multi',
                                                       source="Cluster",
                                                       custom=True,
                                                       name="ClusterStats " + str(i), stats=f.getvalue(),
                                                       neighborhood=neighborhood)
            max_cluster_id += 1

    return get_neighborhood_list(datasource_name)

#visinity
# def load_config():
#     global config
#     with open(config_json_path, "r+") as configJson:
#         config = json.load(configJson)

def load_config(datasource_name):
    print("def:load_config")
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

#visinity
def save_config():
    print("def:save_config")
    global config
    with open(config_json_path, "r+") as configJson:
        json.dump(config, configJson, indent=4)

#visinity
def load_ball_tree(datasource_name, reload=False):
    print("def:load_ball_tree")
    global ball_tree
    global datasource
    global config
    global ball_tree
    global datasource
    global config
    pickled_kd_tree_path = str(
        Path(
            data_path) / datasource_name / "ball_tree.pickle")
    try:
        if os.path.isfile(pickled_kd_tree_path) and reload is False:
            print("Pickled KD Tree Exists, Loading")
            ball_tree = pickle.load(open(pickled_kd_tree_path, "rb"))
            return
    except:
        pass
    print("Creating KD Tree")
    xCoordinate = config[datasource_name]['featureData'][0]['xCoordinate']
    yCoordinate = config[datasource_name]['featureData'][0]['yCoordinate']
    csvPath = Path(config[datasource_name]['featureData'][0]['src'])
    raw_data = pd.read_csv(csvPath)
    points = pd.DataFrame({'x': raw_data[xCoordinate], 'y': raw_data[yCoordinate]})
    ball_tree = BallTree(points, metric='euclidean')
    parent_directory_path = Path(data_path) / datasource_name
    # Creates Directory if it doesn't exist
    parent_directory_path.mkdir(parents=True, exist_ok=True)
    pickle.dump(ball_tree, open(pickled_kd_tree_path, 'wb'))
    print('Creating KD Tree done.')
    print("def:load_ball_tree ended")

#gater, different in visinity (load_datasource insteas of ball tree)
def query_for_closest_cell(x, y, datasource_name):
    print("def:query_for_closest_cell")
    global datasource
    global source
    global ball_tree
    if datasource_name != source:
        load_datasource(datasource_name)
    distance, index = ball_tree.query([[x, y]], k=1)
    if distance == np.inf:
        return {}
    #         Nothing found
    else:
        try:
            row = datasource.iloc[index[0]]
            obj = row.to_dict(orient='records')[0]
            # named phenotype in visinity
            if 'celltype' not in obj:
                obj['celltype'] = ''
            if 'phenotype' not in obj:
                obj['phenotype'] = ''
            return obj
        except:
            return {}

#gater
def get_row(row, datasource_name):
    print("def:get_row")
    global database
    global source
    global ball_tree
    if datasource_name != source:
        load_ball_tree(datasource_name)
    obj = database.loc[[row]].to_dict(orient='records')[0]
    obj['id'] = row
    return obj

#visinity
# @profile
def get_cells(elem, datasource_name, mode, linked_dataset=None, is_image=False, log_normalization=False):
    print("def:get_cells")
    global datasource
    global source
    global config
    global log_norm_neighborhood
    log_norm_neighborhood = log_normalization
    fields = [config[datasource_name]['featureData'][0]['xCoordinate'],
              config[datasource_name]['featureData'][0]['yCoordinate'], 'phenotype', 'id']

    if mode == 'multi':
        obj = {'selection_ids': elem['ids']}
        sorted_ids = np.array(sorted(elem['ids']))
        this_time = time.time()
        if 'linkedDatasets' in config[datasource_name]:
            index_sum = 0
            for dataset in config[datasource_name]['linkedDatasets']:
                np_df = load_csv(dataset, numpy=True)
                next_sum = index_sum + len(np_df)
                # next_sum = index_sum + df.shape[0].compute()
                if linked_dataset is not None and is_image is True:
                    if linked_dataset == dataset:
                        obj[dataset] = get_neighborhood_stats(dataset, sorted_ids, np_df, fields=fields,
                                                              compute_neighbors=False)
                        selection_ids = sorted_ids + index_sum
                        obj[dataset]['selection_ids'] = selection_ids
                else:
                    relevant_ids = sorted_ids[np.where((sorted_ids >= index_sum) & (sorted_ids < next_sum))]
                    relevant_ids = relevant_ids - index_sum
                    obj[dataset] = get_neighborhood_stats(dataset, relevant_ids, np_df, fields=fields,
                                                          compute_neighbors=False)
                    print('ranges', index_sum, next_sum)
                index_sum = next_sum
        obj['composition_summary'] = weight_multi_image_neighborhood(obj, datasource_name, len(sorted_ids))
        # Deleting redundant data
        for dataset in config[datasource_name]['linkedDatasets']:
            if 'dataset' in obj:
                del obj[dataset]['composition_summary']['selection_neighborhoods']
                del obj[dataset]['composition_summary']['selection_ids']

        print('Get Cells Multi Time', time.time() - this_time)
    else:
        ids = np.array(elem['ids'], dtype=int)
        obj = get_neighborhood_stats(datasource_name, ids, np_datasource, fields=fields)
    return obj

#visinity
def weight_multi_image_neighborhood(neighborhood_obj, datasource_name, selection_length):
    print("def:weight_multi_image_neighborhood")
    global config
    obj = {'weighted_contribution': None, 'selection_neighborhoods': None}
    for dataset in config[datasource_name]['linkedDatasets']:
        if dataset in neighborhood_obj:
            try:
                dataset_weight = len(neighborhood_obj[dataset]['cells']) / selection_length
            except ZeroDivisionError:
                dataset_weight = 0
            if obj['weighted_contribution'] is None:
                obj['weighted_contribution'] = deepcopy(
                    neighborhood_obj[dataset]['composition_summary']['weighted_contribution'])
                obj['selection_neighborhoods'] = neighborhood_obj[dataset]['composition_summary'][
                    'selection_neighborhoods']
                for i, val in enumerate(neighborhood_obj[dataset]['composition_summary']['weighted_contribution']):
                    obj['weighted_contribution'][i][1] *= dataset_weight
            else:
                for i, val in enumerate(neighborhood_obj[dataset]['composition_summary']['weighted_contribution']):
                    obj['weighted_contribution'][i][1] += (val[1] * dataset_weight)
                obj['selection_neighborhoods'] = np.vstack((obj['selection_neighborhoods'],
                                                            neighborhood_obj[dataset]['composition_summary'][
                                                                'selection_neighborhoods']))

    return obj

#gater
def get_all_cells(datasource_name, start_keys, data_type=float):
    print("def:get_all_cells")
    global datasource
    global source

    # Load if not loaded
    if datasource_name != source:
        load_ball_tree(datasource_name)

    query = datasource[start_keys].values.flatten('C');
    if np.issubdtype(data_type, int):
        return query.astype(np.uint32)
    return query.astype(np.float32)

#visinity
def get_all_cell_neighborhoods(datasource_name, mode, sample_size=400):
    print("def:get_all_cells")
    global datasource
    global source
    global config
    fields = [config[datasource_name]['featureData'][0]['xCoordinate'],
              config[datasource_name]['featureData'][0]['yCoordinate'], 'phenotype', 'id']
    if mode == 'single':
        neighborhoods = load_neighborhood_matrix(datasource_name)
        neighborhoods = np.nan_to_num(neighborhoods)
        # row_sums = neighborhoods.sum(axis=1)
        # neighborhoods = neighborhoods / row_sums[:, np.newaxis]
        indices = np.arange(neighborhoods.shape[0])
        selection_neighborhoods = neighborhoods[indices, :]
        sample_size = 5000
        selection_neighborhoods = selection_neighborhoods[
                                  np.random.choice(selection_neighborhoods.shape[0], sample_size, replace=True),
                                  :]
        return {'full_neighborhoods': selection_neighborhoods,
                'selection_ids': indices, 'scatter': get_image_scatter(datasource_name, mode, False)}
        # obj = get_neighborhood_stats(datasource_name, np.arange(datasource.shape[0]), fields=fields)
    else:
        if 'linkedDatasets' in config[datasource_name]:
            combined_neighborhoods = None
            for dataset in config[datasource_name]['linkedDatasets']:
                neighborhoods = np.load(Path(config[dataset]['neighborhoods']))
                neighborhoods = np.nan_to_num(neighborhoods)
                # row_sums = neighborhoods.sum(axis=1)
                # neighborhoods = neighborhoods / row_sums[:, np.newaxis]
                indices = np.arange(neighborhoods.shape[0])
                selection_neighborhoods = neighborhoods[indices, :]
                sample_size = sample_size
                selection_neighborhoods = selection_neighborhoods[
                                          np.random.choice(selection_neighborhoods.shape[0], sample_size, replace=True),
                                          :]
                if combined_neighborhoods is None:
                    combined_neighborhoods = selection_neighborhoods
                else:
                    combined_neighborhoods = np.vstack((combined_neighborhoods, selection_neighborhoods))
            return {'full_neighborhoods': combined_neighborhoods}
            # 'selection_ids': indices}

    #     neighborhoods = load_neighborhood_matrix(datasource_name)
    #     row_sums = neighborhoods.sum(axis=1)
    #     neighborhoods = neighborhoods / row_sums[:, np.newaxis]
    #     selection_neighborhoods = neighborhoods[indices, :]
    #


def get_channel_names(datasource_name, shortnames=True):
    print("def:get_channel_names")
    global datasource
    # global source
    # if datasource_name != source:
    #     load_datasource(datasource_name)
    if shortnames:
        channel_names = [channel['name'] for channel in config[datasource_name]['imageData'][1:]]
    else:
        channel_names = [channel['fullname'] for channel in config[datasource_name]['imageData'][1:]]
    return channel_names


def get_channel_cells(datasource_name, channels):
    print("def:get_channel_cells")
    global datasource
    global source
    global ball_tree

    range = [0, 65536]

    # Load if not loaded
    if datasource_name != source:
        load_datasource(datasource_name)

    origId = config[datasource_name]['featureData'][0]['idField']

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
    print("def:get_phenotype_description")
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
    print("def:get_phenotype_column_name")
    try:
        return config[datasource]['featureData'][0]['celltype']
    except KeyError:
        return ''
    except TypeError:
        return ''


def get_cells_phenotype(datasource_name):
    print("def:get_cells_phenotype")
    global datasource
    global source
    global ball_tree

    range = [0, 65536]

    # Load if not loaded
    if datasource_name != source:
        load_ball_tree(datasource_name)

    try:
        id_field = config[datasource_name]['featureData'][0]['idField']
        phenotype_field = config[datasource_name]['featureData'][0]['celltype']
    except KeyError:
        phenotype_field = 'celltype'
    except TypeError:
        phenotype_field = 'celltype'

    query = datasource[['id', phenotype_field]].to_dict(orient='records')
    return query


# def get_phenotypes(datasource_name):
#     print("def:get_phenotypes")
#     global datasource
#     global source
#     global config
#     try:
#         phenotype_field = config[datasource_name]['featureData'][0]['celltype']
#     except KeyError:
#         phenotype_field = 'celltype'
#     except TypeError:
#         phenotype_field = 'celltype'
#
#     if datasource_name != source:
#         load_ball_tree(datasource_name)
#     if phenotype_field in datasource.columns:
#         return sorted(datasource[phenotype_field].unique().tolist())
#     else:
#         return ['']

#visinity
def get_phenotypes(datasource_name):
    print("def:get_phenotypes")
    global datasource
    global source
    global config

    phenotype_list_path = Path(data_path) / datasource_name / 'phenotypes.pk'

    if phenotype_list_path.is_file():
        phenotype_lst = pickle.load(open(phenotype_list_path, "rb"))
        return phenotype_lst

    try:
        phenotype_field = config[datasource_name]['featureData'][0]['phenotype']
    except KeyError:
        phenotype_field = 'phenotype'
    except TypeError:
        phenotype_field = 'phenotype'

    if datasource_name != source:
        load_datasource(datasource_name)

    if phenotype_field in datasource.columns:
        if 'linkedDatasets' not in config[datasource_name]:
            phenotype_lst = sorted(datasource.phenotype.unique().tolist())
        else:
            combined_list = []
            for dataset in config[datasource_name]['linkedDatasets']:
                combined_list = combined_list + (load_csv(dataset).phenotype.unique().tolist())
            phenotype_lst = sorted(list(set(combined_list)))
    else:
        phenotype_lst = ['']

    pickle.dump(phenotype_lst, open(phenotype_list_path, "wb"))
    return phenotype_lst

def get_neighborhood(x, y, datasource_name, r=100, fields=None):
    print("def:get_neighborhood")
    global database
    global datasource
    global source
    global ball_tree
    if datasource_name != source:
        load_datasource(datasource_name)
    index = ball_tree.query_radius([[x, y]], r=r)
    neighbors = index[0]
    try:
        if fields and len(fields) > 0:
            fields.append('id') if 'id' not in fields else fields
            if len(fields) > 1:
                neighborhood = datasource.iloc[neighbors][fields].to_dict(orient='records')
            else:
                neighborhood = datasource.iloc[neighbors][fields].to_dict()
        else:
            neighborhood = datasource.iloc[neighbors].to_dict(orient='records')

        return neighborhood
    except:
        return {}

#visinity
def get_individual_neighborhood(x, y, datasource_name, r=100, fields=None):
    print("def:get_individual_neighborhood")
    global datasource
    global source
    global ball_tree
    if datasource_name != source:
        load_datasource(datasource_name)
    index = ball_tree.query_radius([[x, y]], r=r)
    neighbors = index[0]
    # try:
    if fields and len(fields) > 0:
        fields.append('id') if 'id' not in fields else fields
        if len(fields) > 1:
            neighborhood = datasource.iloc[neighbors][fields].to_dict(orient='records')
        else:
            neighborhood = datasource.iloc[neighbors][fields].to_dict()
    else:
        neighborhood = datasource.iloc[neighbors].to_dict(orient='records')

    return neighborhood

#scope2screen (simiar to whats above)
def get_neighborhood_for_spat_corr(x, y, datasource_name, r=100, fields=None):
    global database
    global datasource
    global source
    global ball_tree
    if datasource_name != source:
        load_datasource(datasource_name)
    index = ball_tree.query_radius([[x, y]], r=r)
    neighbors = index[0]
    try:
        if fields and len(fields) > 0:
            fields.append('id') if 'id' not in fields else fields
            if len(fields) > 1:
                neighborhood = datasource.iloc[neighbors][fields].to_dict(orient='records')
            else:
                neighborhood = datasource.iloc[neighbors][fields].to_dict()
        else:
            neighborhood = datasource.iloc[neighbors].to_dict(orient='records')

        # print(datasource)
        return neighborhood
    except:
        return {}

#scope2screen
def get_k_results_for_spat_corr(x, y, datasource_name, r=100, channels=[], fields=None):
    global config
    global database
    global datasource
    global source
    global ball_tree
    if datasource_name != source:
        load_datasource(datasource_name)

    index = ball_tree.query_radius([[x, y]], r=r)
    neighbors = index[0]
    try:

        # Settings, configs
        k_range = [1, 11]
        x_coordinate = config[datasource_name]['featureData'][0]['xCoordinate']
        y_coordinate = config[datasource_name]['featureData'][0]['yCoordinate']
        index = config[datasource_name]['featureData'][0]['idField']

        # Filter dataframe
        neighborhood_df = datasource.iloc[neighbors][channels + ['id', x_coordinate, y_coordinate, index]]

        # Iterate k
        for k in range(k_range[0], k_range[1]):

            # Spatial analysis
            new_data = spatial_corr(adata=neighborhood_df, x_coordinate=x_coordinate, y_coordinate=y_coordinate,
                                    index='id', channels=channels, k=k)
            # print(new_data)

            # Update dataframe
            for name, values in new_data.iteritems():
                new_column = f'{name}_{k}'
                neighborhood_df[new_column] = values

        # New neighborhood
        new_neighborhood = neighborhood_df.to_dict(orient='records')
        return new_neighborhood

    except:
        return []

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


def get_color_scheme(datasource_name, refresh=False):
    labels = get_phenotypes(datasource_name)
    color_scheme = {}
    # http://godsnotwheregodsnot.blogspot.com/2013/11/kmeans-color-quantization-seeding.html
    # colors = ['#00c0c7', '#5144d3', '#723521', '#da3490', '#9089fa', '#c41d1d', '#2780ec', '#6f38b1',
    #           '#e0bf04', '#ab9a95', '#258d6b', '#934270', '#48e26f']
    # colors = ["#563cd3", "#aaec32", "#dc31b0", "#44ea17", "#be29ff", "#fff070", "#040ee8", "#02531d", "#fbacf6",
    #           "#683c00", "#54d7eb", "#bc3f3b", "#11e38c", "#830c6f", "#aee39a", "#2c457d", "#fea27a", "#3295e9",
    #           "#ead624"] FINAL DAY
    # colors = ["#563cd3", "#aaec32", "#dc31b0", "#bc3f3b", "#44ea17", "#fff070", "#040ee8", "#02531d", "#fbacf6",
    #  "#683c00", "#54d7eb", "#be29ff", "#11e38c", "#830c6f", "#aee39a", "#2c457d", "#fea27a", "#3295e9",
    #  "#ead624"]  #Tonsil
    # Purlpe 563cd3 563cd3
    # Green 44ea17 44ea17
    #  RED bc3f3b
    # Yellow fff070 fff070
    # Blue 040ee8 040ee8

    colors = ["#44ea17", "#FF0000", "#dc31b0", "#bc3f3b", "#563cd3", "#040ee8", "#fff070", "#02531d", "#fbacf6",
              "#683c00", "#54d7eb", "#be29ff", "#11e38c", "#830c6f", "#aee39a", "#2c457d", "#fea27a", "#3295e9",
              "#ead624", "#00FFFF"]  # Tonsil

    # colors = ["#563cd3", "#aaec32", "#dc31b0", "#44ea17", "#be29ff", "#2626ff", "#040ee8", "#02531d", "#fbacf6",
    #           "#683c00", "#54d7eb", "#bc3f3b", "#11e38c", "#830c6f", "#aee39a", "#2c457d", "#fea27a", "#3295e9",
    #           "#ead624"]
    # # colors.remove('#FDB462')
    # colors.append('#db4ba8')
    # colors.append('#02b72e')
    # colors.append('#2580fe')
    # #db4ba8 #02b72e #2580fe
    for i in range(len(labels)):
        color_scheme[str(labels[i])] = {}
        color_scheme[str(labels[i])]['rgb'] = list(ImageColor.getcolor(colors[i], "RGB"))
        color_scheme[str(labels[i])]['hex'] = colors[i]
        color_scheme[str(i)] = {}
        color_scheme[str(i)]['rgb'] = list(ImageColor.getcolor(colors[i], "RGB"))
        color_scheme[str(i)]['hex'] = colors[i]
    return color_scheme

# def get_color_scheme(datasource_name, refresh, label_field='celltype'):
#     print("def:get_color_scheme")
#     # old os.path way:
#     # color_scheme_path = str(
#     #     Path(os.path.join(os.getcwd())) / data_path / datasource_name / str(
#     #         label_field + "_color_scheme.pickle"))
# 
#     color_scheme_path = str(PurePath(cwd_path, data_path, datasource_name, str(
#             label_field + "_color_scheme.pickle")) )
# 
#     if refresh == False:
#         #old os.path way:  if os.path.isfile(color_scheme_path):
#         if Path(color_scheme_path).is_file():
#             print("Color Scheme Exists, Loading")
#             color_scheme = pickle.load(open(color_scheme_path, "rb"))
#             return color_scheme
#     if label_field == 'celltype':
#         labels = get_phenotypes(datasource_name)
#         print(labels)
#     labels.append('SelectedCluster')
#     color_scheme = {}
#     colors = ["#e41a1c", "#377eb8", "#4daf4a", "#984ea3", "#ff7f00", "#a65628", "#f781bf", "#808080", "#7A4900",
#               "#0000A6", "#63FFAC", "#B79762", "#004D43", "#8FB0FF", "#997D87", "#5A0007", "#809693", "#FEFFE6",
#               "#1B4400", "#4FC601", "#3B5DFF", "#4A3B53", "#FF2F80", "#61615A", "#BA0900", "#6B7900", "#00C2A0",
#               "#FFAA92", "#FF90C9", "#B903AA", "#D16100", "#DDEFFF", "#000035", "#7B4F4B", "#A1C299", "#300018",
#               "#0AA6D8", "#013349", "#00846F", "#372101", "#FFB500", "#C2FFED", "#A079BF", "#CC0744", "#C0B9B2",
#               "#C2FF99", "#001E09", "#00489C", "#6F0062", "#0CBD66", "#EEC3FF", "#456D75", "#B77B68", "#7A87A1",
#               "#788D66", "#885578", "#FAD09F", "#FF8A9A", "#D157A0", "#BEC459", "#456648", "#0086ED", "#886F4C",
#               "#34362D", "#B4A8BD", "#00A6AA", "#452C2C", "#636375", "#A3C8C9", "#FF913F", "#938A81", "#575329",
#               "#00FECF", "#B05B6F", "#8CD0FF", "#3B9700", "#04F757", "#C8A1A1", "#1E6E00", "#7900D7", "#A77500",
#               "#6367A9", "#A05837", "#6B002C", "#772600", "#D790FF", "#9B9700", "#549E79", "#FFF69F", "#201625",
#               "#72418F", "#BC23FF", "#99ADC0", "#3A2465", "#922329", "#5B4534", "#FDE8DC", "#404E55", "#0089A3",
#               "#CB7E98", "#A4E804", "#324E72", "#6A3A4C", "#83AB58", "#001C1E", "#D1F7CE", "#004B28", "#C8D0F6",
#               "#A3A489", "#806C66", "#222800", "#BF5650", "#E83000", "#66796D", "#DA007C", "#FF1A59", "#8ADBB4",
#               "#1E0200", "#5B4E51", "#C895C5", "#320033", "#FF6832", "#66E1D3", "#CFCDAC", "#D0AC94", "#7ED379",
#               "#012C58", "#7A7BFF", "#D68E01", "#353339", "#78AFA1", "#FEB2C6", "#75797C", "#837393", "#943A4D",
#               "#B5F4FF", "#D2DCD5", "#9556BD", "#6A714A", "#001325", "#02525F", "#0AA3F7", "#E98176", "#DBD5DD",
#               "#5EBCD1", "#3D4F44", "#7E6405", "#02684E", "#962B75", "#8D8546", "#9695C5", "#E773CE", "#D86A78",
#               "#3E89BE", "#CA834E", "#518A87", "#5B113C", "#55813B", "#E704C4", "#00005F", "#A97399", "#4B8160",
#               "#59738A", "#FF5DA7", "#F7C9BF", "#643127", "#513A01", "#6B94AA", "#51A058", "#A45B02", "#1D1702",
#               "#E20027", "#E7AB63", "#4C6001", "#9C6966", "#64547B", "#97979E", "#006A66", "#391406", "#F4D749",
#               "#0045D2", "#006C31", "#DDB6D0", "#7C6571", "#9FB2A4", "#00D891", "#15A08A", "#BC65E9", "#FFFFFE",
#               "#C6DC99", "#203B3C", "#671190", "#6B3A64", "#F5E1FF", "#FFA0F2", "#CCAA35", "#374527", "#8BB400",
#               "#797868", "#C6005A", "#3B000A", "#C86240", "#29607C", "#402334", "#7D5A44", "#CCB87C", "#B88183",
#               "#AA5199", "#B5D6C3", "#A38469", "#9F94F0", "#A74571", "#B894A6", "#71BB8C", "#00B433", "#789EC9",
#               "#6D80BA", "#953F00", "#5EFF03", "#E4FFFC", "#1BE177", "#BCB1E5", "#76912F", "#003109", "#0060CD",
#               "#D20096", "#895563", "#29201D", "#5B3213", "#A76F42", "#89412E", "#1A3A2A", "#494B5A", "#A88C85",
#               "#F4ABAA", "#A3F3AB", "#00C6C8", "#EA8B66", "#958A9F", "#BDC9D2", "#9FA064", "#BE4700", "#658188",
#               "#83A485", "#453C23", "#47675D", "#3A3F00", "#061203", "#DFFB71", "#868E7E", "#98D058", "#6C8F7D",
#               "#D7BFC2", "#3C3E6E", "#D83D66", "#2F5D9B", "#6C5E46", "#D25B88", "#5B656C", "#00B57F", "#545C46",
#               "#866097", "#365D25", "#252F99", "#00CCFF", "#674E60", "#FC009C", "#92896B"]
#     for i in range(len(labels)):
#         color_scheme[str(labels[i])] = {}
#         color_scheme[str(labels[i])]['rgb'] = list(ImageColor.getcolor(colors[i], "RGB"))
#         color_scheme[str(labels[i])]['hex'] = colors[i]
# 
#     pickle.dump(color_scheme, open(color_scheme_path, 'wb'))
#     return color_scheme

#visinity
def get_cluster_labels(datasource_name):
    global config
    data = np.load(Path(config[datasource_name]['embedding']))
    clusters = np.unique(data[:, -1])
    return clusters.astype('int32').tolist()

#visinity
def get_scatterplot_data(datasource_name, mode):
    global config
    global datasource
    phenotype_list = get_phenotypes(datasource_name)
    this_time = time.time()
    if 'linkedDatasets' in config[datasource_name] and mode == 'multi':

        combined_embedding = None
        phenotypes_dict = {val: idx for idx, val in enumerate(phenotype_list)}

        for dataset in config[datasource_name]['linkedDatasets']:
            embedding = np.load(Path(config[dataset]['embedding']))  # TODO Replace
            np_df = load_csv(dataset, numpy=True)
            phenotypes_array = np_df[:, get_column_indices(['phenotype'])]
            for i in range(phenotypes_array.shape[0]):
                phenotypes_array[i, 0] = phenotypes_dict[phenotypes_array[i, 0]]
            phenotypes_array = np.array(phenotypes_array, dtype='uint16')
            if embedding.shape[1] < 3:
                embedding = np.hstack((embedding, np.zeros((embedding.shape[0], 1))))
            embedding = np.hstack((embedding, phenotypes_array))

            if combined_embedding is None:
                combined_embedding = embedding
            else:
                combined_embedding = np.vstack((combined_embedding, embedding))
        data = combined_embedding
        print('Combine Embedding Time', time.time() - this_time, 'and shape', data.shape)
    else:
        data = np.load(Path(config[datasource_name]['embedding']))
        # data[:, 0:2] = normalize_scatterplot_data(data[:, 0:2])
        # np.save(Path(config[datasource_name]['embedding']), data)
        np_df = load_csv(datasource_name, numpy=True)
        phenotypes_dict = {val: idx for idx, val in enumerate(phenotype_list)}
        phenotypes_array = np_df[:, get_column_indices(['phenotype'])]
        for i in range(phenotypes_array.shape[0]):
            phenotypes_array[i, 0] = phenotypes_dict[phenotypes_array[i, 0]]
        phenotypes_array = np.array(phenotypes_array, dtype='uint16')
        data = np.hstack((data, phenotypes_array))

    data[:, 0:2] = normalize_scatterplot_data(data[:, 0:2])
    # normalized_data = MinMaxScaler(feature_range=(-1, 1)).fit_transform(data[:, :-1])
    # data[:, :2] = normalized_data
    if data.shape[1] == 3:
        list_of_obs = [[elem[0], elem[1], id, int(elem[2])] for id, elem in enumerate(data)]
    else:
        list_of_obs = [[elem[0], elem[1], id, int(elem[3])] for id, elem in enumerate(data)]

    visData = {
        'data': list_of_obs
    }
    print('Total Embedding Time', time.time() - this_time)
    return visData

def get_rect_cells(datasource_name, rect, channels):
    global datasource
    global source
    global ball_tree

    # Load if not loaded
    if datasource_name != source:
        load_datasource(datasource_name)

    # Query
    index = ball_tree.query_radius([[rect[0], rect[1]]], r=rect[2])
    print('Query size:', len(index[0]))
    neighbors = index[0]
    try:
        neighborhood = []
        for neighbor in neighbors:
            row = datasource.iloc[[neighbor]]
            obj = row.to_dict(orient='records')[0]
            #in visinity named phenotype
            if 'celltype' not in obj:
                obj['celltype'] = ''
            neighborhood.append(obj)
        return neighborhood
    except:
        return {}

#visinity
def get_cells_in_polygon(datasource_name, points, similar_neighborhood=False, embedding=False):
    print("def:get_cells_in_polygon")
    global config
    global datasource
    import ome_types as ometypes
    fields = [config[datasource_name]['featureData'][0]['xCoordinate'],
              config[datasource_name]['featureData'][0]['yCoordinate'], 'phenotype', 'id']
    if embedding:
        start = time.process_time()
        point_tuples = [tuple(pt) for pt in MinMaxScaler(feature_range=(0, 1)).fit(
            [[-1], [1]]).transform(np.array(points)).tolist()]
        path = mpltPath.Path(point_tuples)
        embedding = np.load(Path(config[datasource_name]['embedding']))
        inside = path.contains_points(embedding[:, [0, 1]].astype('float'))
        print('Points in Embedding Polygon', time.process_time() - start)
        # neighbor_ids = datasource.loc[np.where(inside == True), 'id'].compute().tolist()
        neighbor_ids = datasource.loc[np.where(inside == True), 'id'].tolist()
    else:
        point_tuples = [(e['imagePoints']['x'], e['imagePoints']['y']) for e in points]
        (x, y, r) = smallestenclosingcircle.make_circle(point_tuples)

        circle_neighbors = get_individual_neighborhood(x, y, datasource_name, r=r,
                                                       fields=fields)
        neighbor_points = pd.DataFrame(circle_neighbors).values
        path = mpltPath.Path(point_tuples)

        inside = path.contains_points(neighbor_points[:, [0, 1]].astype('float'))
        neighbor_ids = neighbor_points[np.where(inside == True), 3].flatten()
    obj = get_neighborhood_stats(datasource_name, neighbor_ids, np_datasource, fields=fields)
    return obj

#visinity
def get_similar_neighborhood_to_selection(datasource_name, selection_ids, similarity, mode='single'):
    global config
    phenotype_list = get_phenotypes(datasource_name)
    fields = [config[datasource_name]['featureData'][0]['xCoordinate'],
              config[datasource_name]['featureData'][0]['yCoordinate'], 'phenotype', 'id']
    query_vector = None
    calc_p_value = True
    if mode == 'multi' and 'linkedDatasets' in config[datasource_name]:
        combined_selection = None
        calc_p_value = False
        for dataset in config[datasource_name]['linkedDatasets']:
            if dataset in selection_ids:
                neighborhoods = np.load(Path(config[dataset]['neighborhoods']))
                selected_rows = neighborhoods[selection_ids[dataset], :]
                if combined_selection is None:
                    combined_selection = selected_rows
                else:
                    combined_selection = np.vstack((combined_selection, selected_rows))
        query_vector = np.mean(combined_selection, axis=0)
    else:
        neighborhoods = load_neighborhood_matrix(datasource_name)
        query_vector = np.mean(neighborhoods[selection_ids[datasource_name], :], axis=0)

    # We expect query in the form of a dict with a bit more info
    query_vector = query_vector.flatten()
    query_vector_dict = {}
    for i, phenotype in enumerate(phenotype_list):
        query_vector_dict[phenotype] = {'value': query_vector[i], 'key': phenotype}

    obj = find_custom_neighborhood_wrapper(datasource_name, query_vector_dict, similarity, mode, calc_p_value)
    return obj

#visinity
def build_neighborhood_vector(neighborhood_composition, datasource_name):
    global datasource
    phenotype_list = get_phenotypes(datasource_name)

    disabled = []
    neighborhood_vector = np.zeros((len(phenotype_list)))
    for i in range(len(phenotype_list)):
        neighborhood_vector[i] = neighborhood_composition[phenotype_list[i]]['value']
        if 'disabled' in neighborhood_composition[phenotype_list[i]] and neighborhood_composition[phenotype_list[i]][
            'disabled']:
            disabled.append(i)
    return neighborhood_vector, disabled


def find_custom_neighborhood_wrapper(datasource_name, neighborhood_composition, similarity, mode='single',
                                     calc_p_value=True):
    neighborhood_vector, disabled = build_neighborhood_vector(neighborhood_composition, datasource_name)
    return find_custom_neighborhood(datasource_name, neighborhood_vector, disabled, similarity, mode, calc_p_value)

#visinity
def find_custom_neighborhood(datasource_name, neighborhood_vector, disabled, similarity, mode='single',
                             calc_p_value=True):
    global datasource
    global source
    # Load if not loaded
    if datasource_name != source:
        load_datasource(datasource_name)
    fields = [config[datasource_name]['featureData'][0]['xCoordinate'],
              config[datasource_name]['featureData'][0]['yCoordinate'], 'phenotype', 'id']

    if mode == 'multi' and 'linkedDatasets' in config[datasource_name]:
        selection_ids = np.array([])
        obj = {}
        index_sum = 0
        query = None
        for dataset in config[datasource_name]['linkedDatasets']:
            np_df = load_csv(dataset, numpy=True)
            similar_ids, neighborhood_query, _ = find_similarity(neighborhood_vector, similarity, dataset,
                                                                 disabled, False)
            selection_ids = np.concatenate([selection_ids, similar_ids + index_sum])
            obj[dataset] = get_neighborhood_stats(dataset, similar_ids, np_df, fields=fields, compute_neighbors=False)

            query = neighborhood_query
            index_sum = index_sum + len(np_df)
        obj['composition_summary'] = weight_multi_image_neighborhood(obj, datasource_name, len(selection_ids))
        obj['composition_summary']['selection_neighborhoods'] = obj['composition_summary']['selection_neighborhoods'][
                                                                np.random.choice(obj['composition_summary'][
                                                                                     'selection_neighborhoods'].shape[
                                                                                     0], 10000, replace=True), :]
        # Deleting redundant data
        for dataset in config[datasource_name]['linkedDatasets']:
            if 'dataset' in obj:
                del obj[dataset]['composition_summary']['selection_neighborhoods']
                del obj[dataset]['composition_summary']['selection_ids']
        obj['selection_ids'] = selection_ids.tolist()

    else:
        similar_ids, neighborhood_query, p_value = find_similarity(neighborhood_vector, similarity, datasource_name,
                                                                   disabled, calc_p_value)
        obj = get_neighborhood_stats(datasource_name, similar_ids, np_datasource, fields=fields)
        obj['p_value'] = p_value
        obj['num_results'] = len(similar_ids)
        query = neighborhood_query
    obj['neighborhood_query'] = query
    return obj

#visinity
def find_similarity(composition_summary, similarity, datasource_name, disabled=None, calc_p_value=True):
    global config
    neighborhood_query = {'query_vector': composition_summary, 'disabled': disabled, 'threshold': similarity}
    # neighborhoods = load_neighborhood_matrix(datasource_name)
    greater_than, p_value = similarity_search(datasource_name, neighborhood_query, calc_p_value)
    return greater_than, neighborhood_query, p_value

#visinity
def similarity_search(datasource_name, neighborhood_query, calc_p_value=True):
    global config
    timer = time.time()
    neighborhoods = load_neighborhood_matrix(datasource_name)
    disabled = neighborhood_query['disabled']
    query_vector = neighborhood_query['query_vector']
    threshold = neighborhood_query['threshold']
    if disabled:
        neighborhoods = np.delete(neighborhoods, disabled, axis=1)
        composition_summary = np.delete(query_vector, disabled, axis=0)
    timer = time.time()
    scores = euclidian_distance_score(neighborhoods, np.array(query_vector))
    print('Search Time', time.time() - timer)

    greater_than = np.argwhere(scores > threshold).flatten()
    print('Fast Time', time.time() - timer)

    # test
    num_results = len(greater_than)
    calc_p_value = False;
    if calc_p_value:
        permuted_results = get_permuted_results(datasource_name, neighborhood_query)
        p_value = p_val(num_results, permuted_results)
        print('Sim Search Time', time.time() - timer)
        return greater_than, p_value
    else:
        return greater_than, None

#visinity
def compute_individual_p_value(datasource_name, num_results, neighborhood_query):
    permuted_results = get_permuted_results(datasource_name, neighborhood_query)
    p_value = p_val(num_results, permuted_results)
    return p_value


def get_gated_cells(datasource_name, gates, start_keys):
    print("def:get_gated_cells")
    global datasource
    global source
    global ball_tree

    # Load if not loaded
    if datasource_name != source:
        load_datasource(datasource_name)

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
    print("def:get_gated_cells_custom")
    global datasource
    global source
    global ball_tree

    # Load if not loaded
    if datasource_name != source:
        load_datasource(datasource_name)

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


def download_gating_csv(datasource_name, gates, channels, encoding):
    print("def:download_gating_csv")
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
        load_datasource(datasource_name)
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
    print("def:save_gating_list")
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

# #visinity
# def get_datasource_description(datasource_name):
#     print("def:get_datasource_description")
#     global datasource
#     global source
#     global ball_tree

def get_saved_gating_list(datasource_name):
    print("def:get_saved_gating_list")
    gating_list = database_model.get(database_model.GatingList, datasource=datasource_name)
    return pickle.loads(gating_list.cells)


def download_channels(datasource_name, map_channels, active_channels, list_colors, list_ranges, list_channels):
    print("def:download_channels")
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
    print("def:save_channel_list")
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

#scope2screen
# def get_datasource_description(datasource_name):
#     global datasource
#     global source
#     global ball_tree
#
#     # Load if not loaded
#     if datasource_name != source:
#         load_ball_tree(datasource_name)
#     description = datasource.describe(percentiles=[.005, .01, .25, .5, .75, .95, .99, .995]).to_dict()
#     for column in description:
#         col = datasource[column]
#         col = col[(col >= description[column]['1%']) & (col <= description[column]['99%'])]
#         col = col.to_numpy()
#         [hist, bin_edges] = np.histogram(col, bins=25, density=True)
#         midpoints = (bin_edges[1:] + bin_edges[:-1]) / 2
#         description[column]['histogram'] = {}
#         dat = []
#         for i in range(len(hist)):
#             obj = {}
#             obj['x'] = midpoints[i]
#             obj['y'] = hist[i]
#             dat.append(obj)
#         description[column]['histogram'] = dat
#     return description


def get_datasource_description(datasource_name, isFull=False):
    print("def:get_datasource_description")
    global datasource
    global source
    global ball_tree
    global config
    global useChannels

    # Load if not loaded
    if datasource_name != source:
        load_datasource(datasource_name)
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
    if (useChannels):
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
    print("def:get_channel_gmm")
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
    print("def:get_channel_gmm ended")
    return packet_gmm


def get_gating_gmm(channel_name, datasource_name):
    print("def:get_gating_gmm")
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

#scope2screen
def spatial_corr(adata, raw=False, log=False, threshold=None, x_coordinate='X_centroid', y_coordinate='Y_centroid',
                 marker=None, k=500, label='spatial_corr', index='id', channels=[]):
    global ball_tree

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
    # Reset some vars (hardcoded for now)
    # adata = pd.DataFrame(datasource)
    # x_coordinate = config[source]['featureData'][0]['xCoordinate']
    # y_coordinate = config[source]['featureData'][0]['yCoordinate']
    # index = config[source]['featureData'][0]['idField']
    # channels = [d['fullname'] for d in config[source]['imageData']][1:]

    # Start
    bdata = adata.copy()
    bdata_features = channels.copy()
    print('Input shape', bdata[bdata_features].shape)
    bdata_features.append(index)
    # Create a DataFrame with the necessary information
    data = pd.DataFrame({'x': bdata[x_coordinate], 'y': bdata[y_coordinate]})
    # user defined expression matrix
    exp = pd.DataFrame(bdata[channels], index=bdata[index])
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
    neighbours = pd.DataFrame(ind, index=bdata[index])
    # find the mean dist
    rad_approx = np.mean(dist.T, axis=0)
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
        # corrfunc = np.mean(Y, axis=1)
        corrfunc = np.mean(Y.T, axis=1)
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
    # adata.uns[label] = df
    print('Output shape', df.shape)
    # return
    return df


def generate_zarr_png(datasource_name, channel, level, tile):
    print("def:generate_zarr_png")
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

#visinity
def get_pearsons_correlation(datasource_name, mode='single'):
    global datasource
    global source
    global config
    neighborhoods = None

    if mode == 'single' or 'linkedDatasets' not in config[datasource_name]:
        neighborhoods = load_neighborhood_matrix(datasource_name)
    else:
        for dataset in config[datasource_name]['linkedDatasets']:
            if neighborhoods is None:
                neighborhoods = np.load(Path(config[dataset]['neighborhoods']))
            else:
                neighborhoods = np.vstack((neighborhoods, np.load(Path(config[dataset]['neighborhoods']))))
    heatmap = np.zeros((neighborhoods.shape[1], neighborhoods.shape[1]))
    for i in range(0, neighborhoods.shape[1]):
        for j in range(0, i):
            p_cor = pearsonr(neighborhoods[:, i], neighborhoods[:, j])[0]
            p_cor = np.nan_to_num(p_cor)
            heatmap[i, j] = p_cor
            heatmap[j, i] = p_cor
    return heatmap


#visinity
def get_heatmap_pearson_correlation(datasource_name, selection_ids, mode='single'):
    global datasource
    global ball_tree
    global source
    global config
    neighborhoods = load_neighborhood_matrix(datasource_name)
    # Load if not loaded
    if datasource_name != source:
        load_datasource(datasource_name)
    test = time.time()
    obj = {}
    # Selection Data
    selected_neighborhoods = neighborhoods[sorted(selection_ids), :]
    coeffecients = pd.DataFrame(neighborhoods).corr('pearson').to_numpy()
    selected_coeffecients = pd.DataFrame(selected_neighborhoods).corr('pearson').to_numpy()

    coeffecients[np.isnan(coeffecients)] = 0
    selected_coeffecients[np.isnan(selected_coeffecients)] = 0
    if len(selected_neighborhoods) == 0:
        selected_coeffecients[:] = None
    heatmap = []
    for i in range(0, coeffecients.shape[0]):
        coeff_list = coeffecients[i, 0:i].tolist()
        selected_coeff_list = selected_coeffecients[i, 0:i].tolist()
        combined = [{'overall': a[0], 'selected': a[1]} for a in zip(coeff_list, selected_coeff_list)]
        coeff_list.append(None)
        heatmap.append(combined)
    # print('Heatmap', time.time() - test)
    return heatmap

# def get_ome_metadata(datasource_name):
#     print("def:get_ome_metadata")
#     if config is None:
#         load_datasource(datasource_name)
#     global metadata
#     return metadata

#visinity
def get_ome_metadata(datasource_name):
    global config
    timer = time.time()
    if config is None:
        load_datasource(datasource_name)

    channel_io = tf.TiffFile(config[datasource_name]['channelFile'], is_ome=False)
    xml = channel_io.pages[0].tags['ImageDescription'].value
    image_metadata = from_xml(xml).images[0].pixels

    print('Metadata Time', time.time() - timer)
    return image_metadata

#gater, but slightly different in visinity. check
def convertOmeTiff(filePath, channelFilePath=None, dataDirectory=None, isLabelImg=False):
    channel_info = {}
    channelNames = []
    print("def:convertOmeTiff")
    # image is a normal channel?
    if isLabelImg == False:
        channel_io = tf.TiffFile(str(filePath), is_ome=False)
        channels = zarr.open(channel_io.series[0].aszarr())
        if isinstance(channels, zarr.Array):
            channel_info['maxLevel'] = 1
            chunks = channels.chunks
            if chunks[1] == 1 or chunks[2] == 1:
                chunks = [1, channels.shape[1], channels.shape[2]]
                channel_info['channels'] = channels.shape[0]
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
            pyramid_upgrade.main(py_args=args)
            write_path = str(directory)
        else:
            write_path = str(filePath)
        return {'segmentation': write_path}


#visinity
# @profile
def get_neighborhood_stats(datasource_name, indices, np_df, cluster_cells=None, fields=[], compute_neighbors=True):
    global ball_tree
    global source
    global config
    global metadata
    global datasource
    phenotype_list = get_phenotypes(datasource_name)
    default_fields = ['id', 'phenotype', config[datasource_name]['featureData'][0]['xCoordinate'],
                      config[datasource_name]['featureData'][0]['yCoordinate']]
    for field in fields:
        if field not in default_fields:
            default_fields.append(field)
    time_neighborhood_stats = time.time()
    if indices.dtype.kind != 'i':
        indices = indices.astype(int)
    if 'useCellID' in config[datasource_name]['featureData'][0] or config[datasource_name]['featureData'][0]['idField'] == 'CellID':
        default_fields.append('CellID')

    column_indices = get_column_indices(default_fields)

    if cluster_cells is None:
        cluster_cells = np_df[indices, :][:, column_indices]
    else:
        cluster_cells = cluster_cells[default_fields]
    neighborhoods = load_neighborhood_matrix(datasource_name)
    neighborhoods = np.nan_to_num(neighborhoods)
    # row_sums = neighborhoods.sum(axis=1)
    # neighborhoods = neighborhoods / row_sums[:, np.newaxis]
    selection_neighborhoods = neighborhoods[indices, :]
    print('Loading Neighborhood Time', time.time() - time_neighborhood_stats)

    if neighborhoods.shape[0] == selection_neighborhoods.shape[0]:
        sample_size = 5000
    else:
        # TODO: Replace sample_size = selection_neighborhoods.shape[0]
        sample_size = 5000

    composition_summary = np.mean(selection_neighborhoods, axis=0)
    if selection_neighborhoods.shape[0] > 0:
        selection_neighborhoods = selection_neighborhoods[
                                  np.random.choice(selection_neighborhoods.shape[0], sample_size, replace=True), :]
    # Sample down so we have 10k of full
    # if selection_neighborhoods.shape[0] > sample_size:
    #     selection_neighborhoods = selection_neighborhoods[
    #                               np.random.choice(selection_neighborhoods.shape[0], sample_size, replace=False), :]
    # else:
    #     selection_neighborhoods = selection_neighborhoods
    # scale_factor = int(sample_size / selection_neighborhoods.shape[0])
    #
    # selection_neighborhoods = np.tile(selection_neighborhoods, (scale_factor, 1))

    summary_stats = {'weighted_contribution': {}, 'selection_neighborhoods': selection_neighborhoods,
                     'selection_ids': indices}
    # phenotypes = sorted(df.phenotype.unique().tolist())
    # phenotypes = sorted(datasource.phenotype.unique().compute().tolist())
    try:
        summary_stats['weighted_contribution'] = list(map(list, zip(phenotype_list, composition_summary)))
    except TypeError:
        phenotype_list = get_phenotypes(datasource_name)
        summary_stats['weighted_contribution'] = list(map(list, zip(phenotype_list, composition_summary)))

    obj = {
        # 'cells': cluster_cells.to_dict(orient='records'),
        'cells': fast_to_dict_records(cluster_cells, default_fields),
        'composition_summary': summary_stats,
        'phenotypes_list': phenotype_list
    }
    # print('Computing Stats Time', time.time() - time_neighborhood_stats)
    if compute_neighbors and len(cluster_cells) > 0:

        points = cluster_cells[:, [2, 3]]
        # Hardcoded to 30 um
        if 'neighborhood_range' in config[datasource_name]:
            neighborhood_range = config[datasource_name]['neighborhood_range']
        else:
            neighborhood_range = 30  # default 30um
        r = neighborhood_range / metadata.physical_size_x
        neighbors = ball_tree.query_radius(points, r=r)
        unique_neighbors = np.unique(np.concatenate(neighbors).ravel())
        border_neighbors = np.setdiff1d(unique_neighbors, cluster_cells[:, 0].astype(int))
        neighbor_phenotypes = {}
        for elem in border_neighbors:
            neighbor_phenotypes[str(elem)] = np_df[elem, get_column_indices(['phenotype'])][0]
        obj['neighbors'] = unique_neighbors
        obj['neighbor_phenotypes'] = neighbor_phenotypes
    print('Neighbors Time', time.time() - time_neighborhood_stats)
    points = np.load(Path(config[datasource_name]['embedding']))[indices, 0:2]
    centroid = points.mean(axis=0)

    obj['centroid'] = centroid;

    return obj

#visinity
def get_contour_line_paths(datasource_name, selection_ids):
    global datasource
    global config
    idField = get_cell_id_field(datasource_name)
    cells = datasource.iloc[selection_ids]
    x = cells[config[datasource_name]['featureData'][0]['xCoordinate']].to_numpy()
    y = cells[config[datasource_name]['featureData'][0]['yCoordinate']].to_numpy()
    cell_points = np.column_stack((x, y))
    if len(selection_ids) < 25:
        clusterer = hdbscan.HDBSCAN(allow_single_cluster=True, min_samples=1)
    else:
        clusterer = hdbscan.HDBSCAN(allow_single_cluster=True, min_samples=1, min_cluster_size=25)

    clusterer.fit(cell_points)
    cell_points = np.column_stack((cell_points, clusterer.labels_))

    grouping = npi.group_by(cell_points[:, 2])
    return grouping.split_array_as_list(cell_points)

    # grid_points = 2 ** 7
    # num_levels = 10
    # kde = FFTKDE(kernel='gaussian')
    # grid, points = kde.fit(cell_points).evaluate(grid_points)
    # grid_x, grid_y = np.unique(grid[:, 0]), np.unique(grid[:, 1])
    # z = points.reshape(grid_points, grid_points).T
    # plt.ioff()
    # cs = plt.contour(grid_x, grid_y, z, num_levels)
    # levels = {}
    # i = 0
    # for collection in cs.collections:
    #     levels[str(i)] = []
    #     for path in collection.get_paths():
    #         levels[str(i)].append(path.vertices)
    #     i += 1
    # return levels
    # return cell_points


import gzip

#visnity
# @profile
@numba.jit(nopython=True, parallel=True, cache=True)
def create_perm_matrix(_phenotypes_array, _len_phenos, _neighbors, _distances, _lengths):
    chunk = 50
    __phenotypes_array = _phenotypes_array.flatten()
    z = np.zeros((chunk, _phenotypes_array.shape[0], _len_phenos), dtype=np.float32)
    perm_matrix = np.zeros((_phenotypes_array.shape[0], _len_phenos), dtype=np.float32)
    for j in prange(chunk):
        ___phenotypes_array = np.random.permutation(__phenotypes_array)
        for i in prange(len(_lengths)):
            this_length = _lengths[i]
            rows = _neighbors[i, 0:this_length]
            phenos = ___phenotypes_array[rows].flatten()
            pheno_weight_indices = (phenos)
            result = np.zeros((_len_phenos), dtype=np.float32)
            for ind in prange(len(pheno_weight_indices)):
                result[pheno_weight_indices[ind]] += _distances[i][ind]
            perm_matrix[i] = result / result.sum()
        z[j, :, :] = perm_matrix
    return z

#visinity
@numba.jit(nopython=True, parallel=True)
def create_matrix(_phenotypes_array, _len_phenos, _neighbors, _distances, _lengths, normalize=True):
    __phenotypes_array = _phenotypes_array.flatten()
    matrix = np.zeros((_phenotypes_array.shape[0], _len_phenos), dtype=np.float32)
    for i in prange(len(_lengths)):
        this_length = _lengths[i]
        rows = _neighbors[i, 0:this_length]
        phenos = __phenotypes_array[rows].flatten()
        pheno_weight_indices = (phenos)
        result = np.zeros((_len_phenos), dtype=np.float32)
        for ind in prange(len(pheno_weight_indices)):
            result[pheno_weight_indices[ind]] += _distances[i][ind]
        if normalize:
            result = result / result.sum()
        matrix[i] = result
    return matrix

#visinity
# @profile
def test_with_saved_perm(_perm_matrix, _vector, _threshold=0.8):
    chunk = 50
    _vector = _vector.astype(np.float32)
    subs = _perm_matrix - _vector
    scores = 1 / (1 + np.sqrt(np.einsum('ijk,ijk->ij', subs, subs)))
    return calculate_num_results(chunk, _vector, scores, _threshold)

#visinity
@numba.jit(nopython=True, parallel=True, cache=True)
def calculate_num_results(chunk, _vector, scores, _threshold):
    results = np.zeros(chunk, dtype=np.int32)
    for j in prange(chunk):
        where = np.where(scores[j, :] > _threshold)
        results[j] = len(where[0])
    return results

#visinity
@numba.jit(nopython=True, parallel=True, cache=True)
def euclidian_distance_score(y1, y2):
    return 1.0 / ((np.sqrt(np.sum((y1 - y2) ** 2, axis=1))) + 1.0)

#visinity
def p_val(val, perm_vals):
    p_value = len(perm_vals[perm_vals >= val]) / len(perm_vals)
    print('P Value', p_value)
    return p_value

#visinity
# @profile
def get_image_scatter(datasource_name, mode, all_results=True):
    results = {}
    phenotype_list = get_phenotypes(datasource_name)
    if 'linkedDatasets' in config[datasource_name] and all_results:
        for dataset in config[datasource_name]['linkedDatasets']:
            if dataset != datasource_name or mode == 'multi' or mode == 'single':  # TODO:Remove
                np_df = load_csv(dataset, numpy=True)
                x_field = config[datasource_name]['featureData'][0]['xCoordinate']
                y_field = config[datasource_name]['featureData'][0]['yCoordinate']
                column_indices = get_column_indices([x_field, y_field, 'id'])
                data = np_df[:, column_indices].astype(int)
                # Get Cell Types
                phenotypes_dict = {val: idx for idx, val in enumerate(phenotype_list)}
                phenotypes_array = np_df[:, get_column_indices(['phenotype'])]
                for i in range(phenotypes_array.shape[0]):
                    phenotypes_array[i, 0] = phenotypes_dict[phenotypes_array[i, 0]]
                phenotypes_array = np.array(phenotypes_array, dtype='uint16')
                data = np.hstack((data, phenotypes_array))

                # data = df[[x_field, y_field, 'id']].to_numpy()
                normalized_data = normalize_scatterplot_data(data[:, 0:2])
                normalized_data[:, 1] = normalized_data[:, 1] * -1.0  # Flip image
                data = np.column_stack((normalized_data, data[:, 2:4]))
                results[dataset] = np.ascontiguousarray(data)
    else:
        np_df = load_csv(datasource_name, numpy=True)
        x_field = config[datasource_name]['featureData'][0]['xCoordinate']
        y_field = config[datasource_name]['featureData'][0]['yCoordinate']
        column_indices = get_column_indices([x_field, y_field, 'id'])
        data = np_df[:, column_indices].astype(int)
        # Get Cell Types
        phenotypes_dict = {val: idx for idx, val in enumerate(phenotype_list)}
        phenotypes_array = np_df[:, get_column_indices(['phenotype'])]
        for i in range(phenotypes_array.shape[0]):
            phenotypes_array[i, 0] = phenotypes_dict[phenotypes_array[i, 0]]
        phenotypes_array = np.array(phenotypes_array, dtype='uint16')
        data = np.hstack((data, phenotypes_array))

        # data = df[[x_field, y_field, 'id']].to_numpy()
        normalized_data = normalize_scatterplot_data(data[:, 0:2])
        normalized_data[:, 1] = normalized_data[:, 1] * -1.0  # Flip image
        data = np.column_stack((normalized_data, data[:, 2:4]))
        results = np.ascontiguousarray(data)

    return results

#visinity
def get_column_indices(column_names):
    global datasource
    csv_column_names = list(datasource.columns)
    return [csv_column_names.index(column_name) for column_name in column_names]

#visinity
def search_across_images(datasource_name, linked_datasource, neighborhood_query=None):
    results = {}
    if 'linkedDatasets' in config[datasource_name] and neighborhood_query is not None:
        for dataset in config[datasource_name]['linkedDatasets']:
            if dataset == linked_datasource:
                # linked_neighborhoods = np.load(Path(config[dataset]['neighborhoods']))
                results[dataset] = {}
                cells, p_value = similarity_search(dataset, neighborhood_query)
                results[dataset]['cells'] = cells
                results[dataset]['p_value'] = p_value
                results[dataset]['num_results'] = len(cells)

    else:
        test = ''
    return results

#visinity
# @profile
def get_permuted_results(datasource_name, neighborhood_query):
    global config
    global datasource
    global perm_data

    vector = np.array(neighborhood_query['query_vector'], dtype='float32')

    matrix_file_name = datasource_name + "_matrix.pk"
    matrix_paths = Path(data_path) / datasource_name / matrix_file_name

    test = time.time()
    perm_data = get_perm_data(datasource_name, matrix_paths)

    # print('P Load Data,', time.time() - test)
    test = time.time()

    zarr_file_name = datasource_name + "_perm.zarr"
    zarr_path = Path(data_path) / datasource_name / zarr_file_name
    test = time.time()
    if zarr_path.is_dir():
        if zarr_perm_matrix is not None:
            zarr_data = zarr_perm_matrix
        else:
            zarr_data = zarr.load(zarr_path)
        print('P Done Load Data,', time.time() - test)
        test = time.time()
        results = test_with_saved_perm(zarr_data, vector, neighborhood_query['threshold'])
        print('P Perm Time,', time.time() - test)
        test = time.time()

    else:
        print('P Creating Data,', time.time() - test)
        test = time.time()
        perms = create_perm_matrix(perm_data['phenotypes_array'], perm_data['len_phenos'], perm_data['neighbors'],
                                   perm_data['distances'], perm_data['lengths'])
        print('P Create Perm Matrix,', time.time() - test)
        test = time.time()
        zarr_perms = zarr.array(perms, compressor=Blosc(cname='zstd', clevel=3))
        zarr.save_array(zarr_path, zarr_perms)
        print('P Create Perm Matrix,', time.time() - test)
        test = time.time()
        results = test_with_saved_perm(perms, vector, neighborhood_query['threshold'])
        print('P Calc Results,', time.time() - test)
        test = time.time()

    # print('P Compute Perms,', time.time() - test)

    return results

#visinity
def get_perm_data(datasource_name, matrix_paths):
    global config
    if matrix_paths.is_file():
        return pickle.load(open(matrix_paths, "rb"))
    phenotype_list = get_phenotypes(datasource_name)
    test = time.time()
    column_indices = get_column_indices([config[datasource_name]['featureData'][0]['xCoordinate'],
                                         config[datasource_name]['featureData'][0]['yCoordinate']])
    np_df = load_csv(datasource_name, numpy=True)
    print('P Done Data Loading,', time.time() - test)
    test = time.time()
    points = np_df[:, column_indices].astype('float32')
    image_ball_tree = BallTree(points, metric='euclidean')
    print('P Ball Tree,', time.time() - test)
    test = time.time()
    image_metadata = get_ome_metadata(datasource_name)
    print('P Metadata,', time.time() - test)
    test = time.time()
    if 'neighborhood_radius' in config[datasource_name]:
        neighborhood_range = int(config[datasource_name]['neighborhood_radius'])
    else:
        neighborhood_range = 30  # Default 30 microns
    r = neighborhood_range / image_metadata.physical_size_x
    neighbors, distances = image_ball_tree.query_radius(points, r=r, return_distance=True)
    print('P Query,', time.time() - test)
    test = time.time()
    lengths = [len(l) for l in neighbors]
    maxlen = max(lengths)
    print('Max Time', time.time() - test)
    neighbors_matrix = np.zeros((len(neighbors), maxlen), int)
    distances_matrix = np.zeros((len(neighbors), maxlen), int)
    mask = np.arange(maxlen) < np.array(lengths)[:, None]
    neighbors_matrix[mask] = np.concatenate(neighbors)
    distances_matrix[mask] = np.concatenate(distances)
    phenotypes_dict = {val: idx for idx, val in enumerate(phenotype_list)}
    phenotypes_array = np_df[:, get_column_indices(['phenotype'])]
    for i in range(phenotypes_array.shape[0]):
        phenotypes_array[i, 0] = phenotypes_dict[phenotypes_array[i, 0]]
    phenotypes_array = np.array(phenotypes_array, dtype='uint16').flatten()
    len_phenos = np.array([len(phenotypes_dict)], dtype='uint16')[0]
    perm_data = {'lengths': lengths, 'neighbors': neighbors_matrix, 'distances': distances_matrix,
                 'phenotypes_array': phenotypes_array, 'len_phenos': len_phenos}
    pickle.dump(perm_data, open(matrix_paths, 'wb'))
    return perm_data

#visinity
def normalize_scatterplot_data(data):
    shifted_data = data - data.min()
    scaled_data = shifted_data / shifted_data.max()
    scaled_data = scaled_data * 2
    # Puts everything between -1 and 1
    scaled_data = scaled_data - 1
    return scaled_data

#visinity
def get_cell_id_field(datasource_name):
    print("def:get_cell_id_field")
    if 'idField' in config[datasource_name]['featureData'][0]:
        return config[datasource_name]['featureData'][0]['idField']
    else:
        return "CellID"

#visinity
def apply_neighborhood_query(datasource_name, neighborhood_query, mode):
    global config

    results = {}
    # neighborhoods = np.load(Path(config[datasource_name]['neighborhoods']))
    disabled = neighborhood_query['disabled']
    query_vector = neighborhood_query['query_vector']
    threshold = neighborhood_query['threshold']

    return find_custom_neighborhood(datasource_name, query_vector, disabled, threshold, mode)

    # if mode == 'multi' and 'linkedDatasets' in config[datasource_name] and neighborhood_query is not None:
    #     for dataset in config[datasource_name]['linkedDatasets']:
    #         results[dataset] = {}
    #         cells, _ = similarity_search(dataset, neighborhood_query, False)
    #         results[dataset]['cells'] = cells
    # else:
    #     similar_ids, p_value = similarity_search(datasource_name, neighborhood_query)
    #     results = get_neighborhood_stats(datasource_name, similar_ids, np_datasource)
    #     results['p_value'] = p_value
    # return results

#visinity
def calculate_axis_order(datasource_name, mode):
    print("def:calculate_axis_order")
    global datasource
    global config
    phenotypes = get_phenotypes(datasource_name)
    correlation_matrix = np.absolute(get_pearsons_correlation(datasource_name, mode))
    order = [None for e in range(len(phenotypes))]
    starting_index = math.ceil(len(phenotypes) / 2.0)
    above_index = starting_index - 2
    below_index = starting_index
    below = True
    for i in range(starting_index):
        # Final Iter
        if i == starting_index - 1:
            remaining_phenotypes = list(filter(lambda x: x is not None, phenotypes))
            order[len(phenotypes) - 1] = remaining_phenotypes[0]
            if len(phenotypes) % 2 == 0:
                order[0] = remaining_phenotypes[1]
        else:
            top_corrs = np.argwhere(correlation_matrix.max() == correlation_matrix)[0]
            pair_one = top_corrs[0]
            pair_two = top_corrs[1]
            if below:
                order[below_index] = phenotypes[pair_one]
                order[below_index - 1] = phenotypes[pair_two]
                below_index += 2
            else:
                order[above_index] = phenotypes[pair_one]
                order[above_index - 1] = phenotypes[pair_two]
                above_index -= 2
            correlation_matrix[:, pair_one] = -1
            correlation_matrix[:, pair_two] = -1
            correlation_matrix[pair_one, :] = -1
            correlation_matrix[pair_two, :] = -1
            phenotypes[pair_one] = None
            phenotypes[pair_two] = None
            below = not below
    return order

#scope2screen
def save_dot(datasource_name, dot):
    database_model.create_or_update(database_model.Dot, id=dot['id'], datasource=datasource_name, group=dot['group'],
                                    name=dot['name'], description=dot['description'], shape_type=dot['shape_type'],
                                    shape_info=dot['shape_info'], cell_ids=dot['cell_ids'],
                                    date=dateutil.parser.parse(dot['date']), image_data=dot['image_data'],
                                    viewer_info=dot['viewer_info'], channel_info=dot['channel_info'])

# Via https://stackoverflow.com/questions/67050899/why-pandas-dataframe-to-dictrecords-performance-is-bad-compared-to-another-n
def fast_to_dict_records(np_df_obj, columns=None):
    global datasource
    # data = df.values.tolist()
    data = np_df_obj.tolist()
    return [
        dict(zip(columns, datum))
        for datum in data
    ]

#visinity
def create_embedding(datasets):
    global config

    combined_neighborhoods = None
    for name in datasets:
        neighborhoods = np.load(Path(config[name]['neighborhoods']))
        if combined_neighborhoods is None:
            combined_neighborhoods = neighborhoods
        else:
            combined_neighborhoods = np.vstack((combined_neighborhoods, neighborhoods))
    print('Creating Umap Embedding', combined_neighborhoods.shape)
    # If slow undo low_memory
    fit = umap.UMAP(n_neighbors=10, min_dist=0.01)
    u = fit.fit_transform(combined_neighborhoods)
    normalized_embedding = normalize_scatterplot_data(u)
    index_sum = 0
    for name in datasets:
        neighborhoods = np.load(Path(config[name]['neighborhoods']))
        next_sum = index_sum + len(neighborhoods)
        individual_embedding = normalized_embedding[index_sum:next_sum, :]
        embedding_path = Path(data_path) / name / 'embedding.npy'

        np.save(embedding_path, individual_embedding)
        config[name]['embedding'] = str(embedding_path)
    save_config()

#scope2screen
def load_dots(datasource_name):
    dots = database_model.get_all(database_model.Dot, datasource=datasource_name)
    print(dots)
    return dots

#scope2screen
def delete_dot(datasource_name, id):
    database_model.edit(database_model.Dot, id, 'is_deleted', True)
    return True


#visnity
def jax_em_clustering():
    import jax
    import jax.numpy as jnp
    import jax.scipy as jsp
    import tensorflow_probability.substrates.jax as jaxp
    jaxd = jaxp.distributions
    from jax.config import config
    config.update("jax_enable_x64", True)

def logTransform(csvPath, skip_columns=[]):
    print("def:logTransform")
    df = pd.read_csv(csvPath)
    for column in df.columns:
        if column not in skip_columns:
            df[column] = np.log1p(df[column])
    df.to_csv(csvPath, index=False)
