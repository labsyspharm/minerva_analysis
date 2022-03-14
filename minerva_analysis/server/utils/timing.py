import numpy as np
import time
import numba
from numba import prange
from sklearn.neighbors import BallTree
import pandas as pd
import pickle


@numba.jit(nopython=True, parallel=True, cache=True)
def create_perm_matrix(_phenotypes_array, _len_phenos, _neighbors, _distances, _lengths, _vector, _threshold):
    __phenotypes_array = _phenotypes_array.flatten()
    z = np.zeros((_phenotypes_array.shape[0], _len_phenos), dtype=np.float32)
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
r = 30 / ton_scale_factor

# contiguous_points = np.ascontiguousarray(points.astype('float32'))
# image_ball_tree = BallTree(contiguous_points, metric='euclidean')
# test = time.time()
# neighbors, distances = image_ball_tree.query_radius(contiguous_points, r=r, return_distance=True)
# print('Query Time,', time.time() - test)
# lens = [len(l) for l in neighbors]
times_dict = {}

# for num_cells in np.linspace(100000, 10000000, 100, dtype=int):
for num_cells in [5000000]:
    num_cells_str = str(num_cells)
    size = 1000 / np.sqrt(5000 / num_cells)
    rand = (np.random.rand(num_cells, 2) * size)
    rand_ball_tree = BallTree(rand, metric='euclidean')
    synthetic_phenotypes_array = phenotypes_array[np.random.randint(0, high=(np_df.shape[0] - 1), size=num_cells)]
    timer = time.time()
    synthetic_neighbors, synthetic_distances = rand_ball_tree.query_radius(rand, r=r, return_distance=True)
    times_dict[num_cells_str] = {}
    query_time = time.time() - timer
    times_dict[num_cells_str]['query_time'] = query_time
    print(num_cells_str, 'Query Time,', query_time)
    timer = time.time()
    synthetic_lens = [len(l) for l in synthetic_neighbors]
    synthetic_maxlen = max(synthetic_lens)
    synthetic_neighbors_matrix = np.zeros((len(synthetic_neighbors), synthetic_maxlen), int)
    synthetic_distances_matrix = np.zeros((len(synthetic_neighbors), synthetic_maxlen), float)
    synthetic_mask = np.arange(synthetic_maxlen) < np.array(synthetic_lens)[:, None]
    synthetic_neighbors_matrix[synthetic_mask] = np.concatenate(synthetic_neighbors)
    synthetic_distances_matrix[synthetic_mask] = np.concatenate(synthetic_distances)
    synthetic_distances_matrix = 1 - (synthetic_distances_matrix / r)
    synthetic_distances_matrix[~synthetic_mask] = 0

    matrix_time = time.time() - timer
    times_dict[num_cells_str]['matrix_time'] = matrix_time
    timer = time.time()

    vector = np.empty(len_phenos)
    vector.fill(1 / len_phenos)
    matrix_test = time.time()
    create_perm_matrix(synthetic_phenotypes_array, len_phenos, synthetic_neighbors_matrix, synthetic_distances_matrix,
                       np.array(synthetic_lens, dtype=int), vector, 0.8)
    neighborhood_time = time.time() - timer
    times_dict[num_cells_str]['neighborhood_time'] = neighborhood_time
    times_dict[num_cells_str]['total_time'] = neighborhood_time + matrix_time + query_time
    print(num_cells_str, times_dict[num_cells_str]['total_time'])

pickle.dump(times_dict, open('times_dict.pk', 'wb'))

#
# print('Matrix Time,', time.time() - test)

#
# print('Length Time,', time.time() - test, 'Max Len', maxlen, 'AVG_LEN', np.mean(lens))
# neighbors_matrix = np.zeros((len(neighbors), maxlen), int)
# distances_matrix = np.zeros((len(neighbors), maxlen), float)
# mask = np.arange(maxlen) < np.array(lens)[:, None]
# neighbors_matrix[mask] = np.concatenate(neighbors)
# distances_matrix[mask] = np.concatenate(distances)
# distances_matrix = 1 - (distances_matrix / r)
# distances_matrix[~mask] = 0
#
# print('Phenos Time,', time.time() - test, len_phenos)
#
# vector = np.empty(len_phenos)
# vector.fill(1 / len_phenos)
# matrix_test = time.time()
# create_perm_matrix(phenotypes_array, len_phenos, neighbors_matrix, distances_matrix, np.array(lens, dtype=int), vector,
#                    0.8)
# print('Just Matrix', time.time() - matrix_test)
# print('Neighborhood Matrix Time,', time.time() - test)
#
# print('~~~~~~~~~~~~~~~~~~~~synthetic~~~~~~~~~~~~~~~~~`')
# test = time.time()
#
# # Now We Make Synthetic Data
# data_size = 10000000
# synthetic_neighbors = []
# synthetic_distances = []
# synthetic_phenotypes_array = np.zeros(data_size, dtype=int)
# for i in range(data_size):
#     random_index = np.random.randint(0, high=len(lens) - 1)
#     synthetic_length = lens[random_index]
#     rand_neighbor = np.random.randint(0, high=data_size - 1, size=synthetic_length)
#     rand_dists = np.random.rand(synthetic_length) * r
#     synthetic_neighbors.append(rand_neighbor)
#     synthetic_distances.append(rand_dists)
#     synthetic_phenotypes_array[i] = phenotypes_array[random_index]
#
#
# print('Creating Time,', time.time() - test, len_phenos)
#
#
#
#

#
