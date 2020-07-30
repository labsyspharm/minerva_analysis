from scipy.spatial import cKDTree
import numpy as np
import pandas as pd
import json
import os
from pathlib import Path
import pickle

kdTree = None
database = None
source = None
config = None


def init(datasource):
    load_kd_tree(datasource)


def load_db(datasource):
    global database
    global source
    global config
    if source is datasource and database is not None:
        return
    load_config()
    csvPath = "." + config[datasource]['featureData'][0]['src']
    index_col = None
    if 'idField' in config[datasource]['featureData'][0]:
        idField = config[datasource]['featureData'][0]['idField']
        if idField != 'none' and idField is not None:
            index_col = idField
    database = pd.read_csv(csvPath, index_col=index_col)
    source = datasource


def load_config():
    config_json_path = Path("static/data") / "config.json"
    global config
    with open(config_json_path, "r+") as configJson:
        config = json.load(configJson)


def load_kd_tree(datasource):
    global kdTree
    global database
    global config
    if datasource != source:
        load_db(datasource)
    pickled_kd_tree_path = str(Path(os.path.join(os.getcwd())) / "static" / "data" / datasource / "kd_tree.pickle")
    if os.path.isfile(pickled_kd_tree_path):
        print("Pickled KD Tree Exists, Loading")
        kdTree = pickle.load(open(pickled_kd_tree_path, "rb"))
    else:
        print("No Pickled KD Tree, Creating One")
        xCoordinate = config[datasource]['featureData'][0]['xCoordinate']
        yCoordinate = config[datasource]['featureData'][0]['yCoordinate']
        csvPath = "." + config[datasource]['featureData'][0]['src']
        raw_data = pd.read_csv(csvPath)
        kdTree = cKDTree(list(zip(raw_data[xCoordinate], raw_data[yCoordinate])))
        pickle.dump(kdTree, open(pickled_kd_tree_path, 'wb'))


def query_for_closest_cell(x, y, datasource, max_distance=100):
    global database
    global source
    global kdTree
    if datasource != source:
        load_kd_tree(datasource)
    distance, index = kdTree.query([[x, y]], k=1, distance_upper_bound=max_distance)
    if distance == np.inf:
        return {}
    #         Nothing found
    else:
        try:
            row = database.loc[[index[0]]]
            obj = row.to_dict(orient='records')[0]
            obj['id'] = str(row.index.item())
            if 'phenotype' not in obj:
                obj['phenotype'] = ''
            return obj
        except:
            return {}


def get_row(row, datasource):
    global database
    global source
    global kdTree
    if datasource != source:
        load_kd_tree(datasource)
    obj = database.loc[[row]].to_dict(orient='records')[0]
    obj['id'] = row
    return obj


def get_sample_row(datasource):
    global database
    global source
    if datasource != source:
        load_kd_tree(datasource)
    obj = database.iloc[[0]].to_dict(orient='records')[0]
    return obj


def get_phenotypes(datasource):
    global database
    global source
    global config
    try:
        phenotype_field = config[datasource]['featureData'][0]['phenotype']
    except KeyError:
        phenotype_field = 'phenotype'

    if datasource != source:
        load_kd_tree(datasource)
    if phenotype_field in database.columns:
        return database[phenotype_field].unique().tolist()
    else:
        return []


def get_neighborhood(x, y, cellId, datasource, max_distance=100):
    global database
    global source
    global kdTree
    nn = 100
    if datasource != source:
        load_kd_tree(datasource)
    distance, index = kdTree.query([[x, y]], k=1, distance_upper_bound=max_distance)
    valid_points = np.array(index[index < database.shape[0]])
    neighborhood_cells = []
    for neighbor in valid_points.tolist():
        row = database.loc[[neighbor]]
        obj = row.to_dict(orient='records')[0]
        obj['id'] = str(row.index.item())
        if 'phenotype' not in obj:
            obj['phenotype'] = ''
        neighborhood_cells.append(obj)
    return neighborhood_cells
