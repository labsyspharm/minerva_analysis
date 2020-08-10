from sklearn.neighbors import BallTree
from tqdm import tqdm
import numpy as np
import umap
import time
import os

metric = 'euclidean'
A = np.load('../static/data/neighborhood_array.npy')
for n_neighbors in [10, 100, 200]:
    for min_dist in [.2, .8]:
        start_time = time.time()
        save_string = 'full_weighted_umap_' + metric + '_' + str(n_neighbors) + 'neighbors_' + str(min_dist) + 'dist'
        save_string = save_string.replace('.', '')
        print(save_string)
        if (os.path.isfile(save_string + '.npy')):
            print("skipping")
        else:
            new_data_embedding = umap.UMAP(metric=metric, n_neighbors=n_neighbors, min_dist=min_dist).fit_transform(
                A)
            np.save(save_string, new_data_embedding)
        print("--- %s seconds ---" % (time.time() - start_time))
