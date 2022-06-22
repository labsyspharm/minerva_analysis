import numpy as np
import time

import pickle
# from torchGMM import GaussianMixture
from jaxGMM import JaxGaussianMixture
from sklearn.mixture import GaussianMixture

from pycave.bayes import gmm
from tqdm import tqdm
import torch

times_dict = {}

# num_cells_list = [100000, 200000, 300000, 400000, 500000, 600000, 700000, 800000, 900000, 1000000, 2000000, 3000000,
#                   4000000, 5000000, 6000000, 7000000, 8000000, 9000000,
#                   10000000]
num_cells_list = [400000]
num_cells_list.reverse()
for k in tqdm(range(1)):
    for num_cells in num_cells_list:
        num_cells_str = str(num_cells)
        times_dict[num_cells_str] = {}
        neighborhood_matrix = np.load('testmatrix.npy').astype(np.float32)


        # timer = time.time()
        # g_mixtures = GaussianMixture(6)
        # g_mixtures.fit(neighborhood_matrix)
        # fit_time = time.time() - timer
        # times_dict[num_cells_str]['skl_cluster_time_fit'] = fit_time
        # clusters = g_mixtures.predict(neighborhood_matrix)
        # cluster_time = time.time() - timer
        # times_dict[num_cells_str]['skl_cluster_time_predict'] = cluster_time - fit_time
        # times_dict[num_cells_str]['skl_cluster_time'] = cluster_time

        timer = time.time()
        g_mixtures = JaxGaussianMixture()
        g_mixtures.fit(neighborhood_matrix, 6)
        print('fit')
        fit_time = time.time() - timer
        times_dict[num_cells_str]['jax_cluster_time_fit'] = fit_time
        clusters = g_mixtures.predict(neighborhood_matrix)
        print('predict')
        cluster_time = time.time() - timer
        times_dict[num_cells_str]['jax_cluster_time_predict'] = cluster_time - fit_time
        times_dict[num_cells_str]['jax_cluster_time'] = cluster_time

    pickle.dump(times_dict, open('cluster_dict_perm_' + str(k) + '.pk', 'wb'))

#

#
