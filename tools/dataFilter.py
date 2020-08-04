from sklearn.neighbors import BallTree
import numpy as np
import pandas as pd
from skimage import color
import requests
import json
import os
from pathlib import Path
import time
import pickle
import scimap as sm
import csv

ball_tree = None
source = None
config = None
adata = None


def init(datasource):
    load_ball_tree(datasource)


def load_db(datasource):
    global source
    global config
    global adata
    if source is datasource and adata is not None:
        return
    load_config()
    csvPath = "." + config[datasource]['featureData'][0]['src']

    index_col = None
    split_cols = []  # Potential columns that would indicate end of marker quantification
    if 'idField' in config[datasource]['featureData'][0]:
        idField = config[datasource]['featureData'][0]['idField']
        if idField != 'none' and idField is not None:
            index_col = idField
    split_cols.append(config[datasource]['featureData'][0]['xCoordinate'])
    split_cols.append(config[datasource]['featureData'][0]['yCoordinate'])
    split_cols.append(config[datasource]['imageData'][0]['name'])

    with open(csvPath) as in_file:
        csv_reader = csv.reader(in_file)
        header = next(csv_reader)
    min_index = np.inf
    for col in split_cols:
        try:
            index = header.index(col)
            if index < min_index:
                min_index = index
        except ValueError:
            pass
    if index_col:
        adata = sm.pp.mcmicro_to_scimap([csvPath], split=header[min_index], remove_dna=False, CellId=index_col)
    else:
        adata = sm.pp.mcmicro_to_scimap([csvPath], remove_dna=True, split=header[min_index])
    source = datasource


def load_config():
    config_json_path = Path("static/data") / "config.json"
    global config
    with open(config_json_path, "r+") as configJson:
        config = json.load(configJson)


def load_ball_tree(datasource):
    global ball_tree
    global config
    if datasource != source:
        load_db(datasource)
    pickled_kd_tree_path = str(Path(os.path.join(os.getcwd())) / "static" / "data" / datasource / "ball_tree.pickle")
    if os.path.isfile(pickled_kd_tree_path):
        print("Pickled KD Tree Exists, Loading")
        ball_tree = pickle.load(open(pickled_kd_tree_path, "rb"))
    else:
        print("No Pickled KD Tree, Creating One")
        xCoordinate = config[datasource]['featureData'][0]['xCoordinate']
        yCoordinate = config[datasource]['featureData'][0]['yCoordinate']
        points = pd.DataFrame({'x': adata.obs[xCoordinate], 'y': adata.obs[yCoordinate]})
        ball_tree = BallTree(points, metric='euclidean')
        pickle.dump(ball_tree, open(pickled_kd_tree_path, 'wb'))


def query_for_closest_cell(x, y, datasource):
    global source
    global ball_tree
    global adata
    if datasource != source:
        load_ball_tree(datasource)
    distance, index = ball_tree.query([[x, y]], k=1)
    if distance == np.inf:
        return {}
    #         Nothing found
    else:
        try:
            row = adata.obs.iloc[index[0]]
            obj = row.to_dict(orient='records')[0]
            obj['id'] = str(index[0][0])
            if 'phenotype' not in obj:
                obj['phenotype'] = ''
            return obj
        except:
            return {}


def get_row(row, datasource):
    global source
    global ball_tree
    global adata

    if datasource != source:
        load_ball_tree(datasource)
    obj = {}
    obj['id'] = row
    adata_row = adata[row]
    obs = adata_row.obs.to_dict()
    for key in obs:
        obj[key] = (list(obs[key].values())[0])
    cols = adata[row].var_names
    [x] = adata_row.X
    for i in range(len(cols)):
        obj[cols[i]] = x[i]
    return obj


def get_column_names(datasource):
    global source
    global adata
    if datasource != source:
        load_ball_tree(datasource)
    return adata.var_names.values.tolist()


def get_phenotypes(datasource):
    global source
    global config
    global adata
    try:
        phenotype_field = config[datasource]['featureData'][0]['phenotype']
    except KeyError:
        phenotype_field = 'phenotype'

    if datasource != source:
        load_ball_tree(datasource)

    if phenotype_field in adata.obs.columns:
        return adata.obs[phenotype_field].unique().tolist()
    else:
        return ['']


def get_neighborhood(x, y, datasource, r=100):
    global source
    global ball_tree
    if datasource != source:
        load_ball_tree(datasource)
    index = ball_tree.query_radius([[x, y]], r=r)
    neighbors = index[0]
    try:
        neighborhood = []
        for neighbor in neighbors:
            row = adata.obs.iloc[[neighbor]]
            obj = row.to_dict(orient='records')[0]
            obj['id'] = str(neighbor)
            if 'phenotype' not in obj:
                obj['phenotype'] = ''
            neighborhood.append(obj)
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
