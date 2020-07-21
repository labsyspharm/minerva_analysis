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


def loadDB(datasource):
    global database
    global source
    if source is datasource and database is not None:
        return
    with open("static/data/config.json", "r+") as configJson:
        configData = json.load(configJson)
    csvPath = "." + configData[datasource]['featureData'][0]['src']
    index_col = None
    if 'idField' in configData[datasource]['featureData'][0]:
        idField = configData[datasource]['featureData'][0]['idField']
        if idField != 'none' and idField is not None:
            index_col = idField
    database = pd.read_csv(csvPath, index_col=index_col)
    source = datasource


def loadKDTree(datasource):
    global kdTree
    global database
    if datasource != source:
        loadDB(datasource)
    pickled_kd_tree_path = str(Path(os.path.join(os.getcwd())) / "static" / "data" / datasource / "kd_tree.pickle")
    if os.path.isfile(pickled_kd_tree_path):
        print("Pickled KD Tree Exists, Loading")
        kdTree = pickle.load(open(pickled_kd_tree_path, "rb"))
    else:
        print("No Pickled KD Tree, Creating One")
        with open("static/data/config.json", "r+") as configJson:
            configData = json.load(configJson)
        xCoordinate = configData[datasource]['featureData'][0]['xCoordinate']
        yCoordinate = configData[datasource]['featureData'][0]['yCoordinate']
        csvPath = "." + configData[datasource]['featureData'][0]['src']
        raw_data = pd.read_csv(csvPath)
        kdTree = cKDTree(list(zip(raw_data[xCoordinate], raw_data[yCoordinate])))
        pickle.dump(kdTree, open(pickled_kd_tree_path, 'wb'))


def query_for_closest_cell(x, y, datasource, max_distance=100):
    global database
    global source
    global kdTree
    if datasource != source:
        loadKDTree(datasource)
    distance, index = kdTree.query([[x, y]], k=1, distance_upper_bound=max_distance)
    if distance == np.inf:
        return {}
    #         Nothing found
    else:
        try:
            row = database.loc[[index[0]]]
            obj = row.to_dict(orient='records')[0]
            obj['id'] = str(row.index.item())
            obj['cluster'] = "-"
            return obj
        except:
            return {}


def get_row(row, datasource):
    global database
    global source
    global kdTree
    if datasource != source:
        loadKDTree(datasource)
    obj = database.loc[[row]].to_dict(orient='records')[0]
    obj['id'] = row
    return obj
