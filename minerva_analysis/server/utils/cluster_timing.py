import numpy as np
import time
import numba
from numba import prange
from sklearn.neighbors import BallTree
import pandas as pd
import pickle
# from torchGMM import GaussianMixture
from sklearn.mixture import GaussianMixture

from pycave.bayes import gmm
from tqdm import tqdm
import torch
import numcodecs
import zarr


@numba.jit(nopython=True, parallel=True, cache=True)
def create_perm_matrix(_phenotypes_array, _len_phenos, _neighbors, _distances, _lengths, _vector, _threshold):
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
        z[j, :, :] = perm_matrix
    return z


@numba.jit(nopython=True, parallel=True, cache=True)
def calculate_num_results(chunk, _vector, scores, _threshold):
    results = np.zeros(chunk, dtype=np.int32)
    for j in prange(chunk):
        where = np.where(scores[j, :] > _threshold)
        results[j] = len(where[0])
    return results


def test_with_saved_perm(_perm_matrix, _vector, _threshold=0.8, chunk=50):
    _vector = _vector.astype(np.float32)
    subs = _perm_matrix - _vector
    scores = 1 / (1 + np.sqrt(np.einsum('ijk,ijk->ij', subs, subs)))
    return calculate_num_results(chunk, _vector, scores, _threshold)


@numba.jit(nopython=True, parallel=True, cache=True)
def create_matrix(_phenotypes_array, _len_phenos, _neighbors, _distances, _lengths, _vector, _threshold):
    __phenotypes_array = _phenotypes_array.flatten()
    perm_matrix = np.zeros((_phenotypes_array.shape[0], _len_phenos), dtype=np.float32)
    for i in prange(len(_lengths)):
        this_length = _lengths[i]
        rows = _neighbors[i, 0:this_length]
        phenos = _phenotypes_array[rows].flatten()
        pheno_weight_indices = (phenos)
        result = np.zeros((_len_phenos), dtype=np.float32)
        for ind in prange(len(pheno_weight_indices)):
            result[pheno_weight_indices[ind]] += _distances[i][ind]
        perm_matrix[i] = result / result.sum()
    return perm_matrix


drop_columns = ['DNA1', 'AF488', 'AF555', 'AF647', 'DNA2', 'BG488', 'BG555', 'BG647', 'DNA3', 'CD2', 'NONE', 'CD10',
                'DNA4', 'CD30', 'ALK', 'CD5', 'DNA5', 'CD4', 'CD68', 'CD7', 'DNA6', 'CD43', 'CD3D', 'CD45', 'DNA7',
                'CD11B', 'GATA3', 'CD8A', 'DNA8', 'CD163', 'CD19', 'CD56', 'DNA10', 'KI67', 'FOXP3', 'CD21', 'DNA11',
                'S6P', 'ERKP', 'CD31', 'DNA12', 'BCL6', 'CD57', 'PSTAT3']
df = pd.read_csv('/Users/swarchol/Harvard Drive/Ton/tonsil_with_phenotype.csv', index_col=None)
df = df.drop(drop_columns, axis=1)
df['id'] = df.index
# df['Cluster'] = embedding[:, -1].astype('int32').tolist()
df['Cluster'] = 0

if 'CellType' in df.columns:
    df = df.rename(columns={'CellType': 'phenotype'})
df = df.replace(-np.Inf, 0)
np_df = df.to_numpy()

points = np_df[:, [1, 2]]

phenotypes_dict = {val: idx for idx, val in enumerate(sorted(df.phenotype.unique()))}
phenotypes_array = np_df[:, 12]
for i in range(phenotypes_array.shape[0]):
    phenotypes_array[i] = phenotypes_dict[phenotypes_array[i]]
phenotypes_array = np.array(phenotypes_array, dtype='uint16').flatten()
len_phenos = np.array([len(phenotypes_dict)], dtype='uint16')[0]

#
ton_scale_factor = 0.649999976158
r = 10 / ton_scale_factor

# contiguous_points = np.ascontiguousarray(points.astype('float32'))
# image_ball_tree = BallTree(contiguous_points, metric='euclidean')
# test = time.time()
# neighbors, distances = image_ball_tree.query_radius(contiguous_points, r=r, return_distance=True)
# print('Query Time,', time.time() - test)
# lens = [len(l) for l in neighbors]
times_dict = {}

# num_cells_list = [100000, 200000, 300000, 400000, 500000, 600000, 700000, 800000, 900000, 1000000, 2000000, 3000000,
#                   4000000, 5000000, 6000000, 7000000, 8000000, 9000000,
#                   10000000]
num_cells_list = [100000, 200000, 300000, 400000, 500000, 600000, 700000, 800000, 900000, 1000000, 2000000, 3000000,
                  4000000, 5000000]
num_cells_list.reverse()
for k in tqdm(range(5)):
    for num_cells in num_cells_list:
        num_cells_str = str(num_cells)
        times_dict[num_cells_str] = {}
        for radius in [10]:
            radius_str = str(radius)
            size = 1000 / np.sqrt(5000 / num_cells)
            rand = (np.random.rand(num_cells, 2) * size)
            rand = np.ascontiguousarray(rand, dtype='float32')
            rand_ball_tree = BallTree(rand, metric='euclidean')
            synthetic_phenotypes_array = phenotypes_array[np.random.randint(0, high=(np_df.shape[0] - 1), size=num_cells)]
            timer = time.time()
            r = radius / ton_scale_factor
            synthetic_neighbors, synthetic_distances = rand_ball_tree.query_radius(rand, r=r, return_distance=True)
            times_dict[num_cells_str][radius_str] = {}
            query_time = time.time() - timer
            times_dict[num_cells_str][radius_str]['query_time'] = query_time
            print(num_cells_str, 'Query Time,', query_time)
            timer = time.time()
            synthetic_lens = [len(l) for l in synthetic_neighbors]
            synthetic_maxlen = max(synthetic_lens)
            query_timer = time.time()
            synthetic_neighbors_matrix = np.zeros((len(synthetic_neighbors), synthetic_maxlen), dtype='int32')
            synthetic_distances_matrix = np.zeros((len(synthetic_neighbors), synthetic_maxlen), dtype='float32')
            synthetic_mask = np.arange(synthetic_maxlen) < np.array(synthetic_lens)[:, None]
            synthetic_neighbors_matrix[synthetic_mask] = np.concatenate(synthetic_neighbors, dtype='int32')
            synthetic_distances_matrix[synthetic_mask] = np.concatenate(synthetic_distances, dtype='float32')
            synthetic_distances_matrix = 1 - (synthetic_distances_matrix / r)
            synthetic_distances_matrix[~synthetic_mask] = 0
            matrix_time = time.time() - timer
            times_dict[num_cells_str][radius_str]['matrix_time'] = matrix_time
            timer = time.time()

            vector = np.empty(len_phenos)
            vector.fill(1 / len_phenos)
            matrix_test = time.time()

            neighborhood_matrix = create_matrix(synthetic_phenotypes_array, len_phenos, synthetic_neighbors_matrix,
                                                synthetic_distances_matrix,
                                                np.array(synthetic_lens, dtype=int), vector, 0.8)
            print('Made Matrix', neighborhood_matrix.shape)
            neighborhood_time = time.time() - timer
            times_dict[num_cells_str][radius_str]['neighborhood_time'] = neighborhood_time
            times_dict[num_cells_str][radius_str]['total_neighborhood_time'] = neighborhood_time + matrix_time + query_time
            timer = time.time()
            if radius != 10:
                continue

            add_dim = neighborhood_matrix[np.newaxis, ...]
            resp = test_with_saved_perm(add_dim, vector, 0.8, chunk=1)
            search_time = time.time() - timer
            times_dict[num_cells_str][radius_str]['search_time'] = search_time
            timer = time.time()

            np.save('testmatrix.np', neighborhood_matrix)
            timer = time.time()
            torch_neighborhood_matrix = torch.tensor(neighborhood_matrix)
            g_mixtures = gmm.GaussianMixture(num_components=6)
            g_mixtures.fit(torch_neighborhood_matrix)
            fit_time = time.time() - timer
            times_dict[num_cells_str][radius_str]['pycave_cluster_time_fit'] = fit_time
            clusters = g_mixtures.predict(torch_neighborhood_matrix)
            cluster_time = time.time() - timer
            times_dict[num_cells_str][radius_str]['pycave_cluster_time_predict'] = cluster_time - fit_time
            times_dict[num_cells_str][radius_str]['pycave_cluster_time'] = cluster_time

            timer = time.time()
            g_mixtures = GaussianMixture(n_components=6)
            g_mixtures.fit(neighborhood_matrix)
            fit_time = time.time() - timer
            times_dict[num_cells_str][radius_str]['cluster_time_fit'] = fit_time
            clusters = g_mixtures.predict(neighborhood_matrix)
            cluster_time = time.time() - timer
            times_dict[num_cells_str][radius_str]['cluster_time_predict'] = cluster_time - fit_time
            times_dict[num_cells_str][radius_str]['cluster_time'] = cluster_time
            timer = time.time()




    pickle.dump(times_dict, open('sun_dict_perm_'+str(k)+'.pk', 'wb'))

#

#
