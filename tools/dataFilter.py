from sklearn.neighbors import BallTree
import numpy as np
import pandas as pd
import json
import os
from pathlib import Path
import pickle

ball_tree = None
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
    global ball_tree
    global database
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
        csvPath = "." + config[datasource]['featureData'][0]['src']
        raw_data = pd.read_csv(csvPath)
        points = pd.DataFrame({'x': raw_data[xCoordinate], 'y': raw_data[yCoordinate]})
        ball_tree = BallTree(points, metric='euclidean')
        pickle.dump(ball_tree, open(pickled_kd_tree_path, 'wb'))


def query_for_closest_cell(x, y, datasource):
    global database
    global source
    global ball_tree
    if datasource != source:
        load_kd_tree(datasource)
    distance, index = ball_tree.query([[x, y]], k=1)
    if distance == np.inf:
        return {}
    #         Nothing found
    else:
        try:
            row = database.iloc[index[0]]
            obj = row.to_dict(orient='records')[0]
            obj['id'] = str(index[0][0])
            if 'phenotype' not in obj:
                obj['phenotype'] = ''
            return obj
        except:
            return {}


def get_row(row, datasource):
    global database
    global source
    global ball_tree
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


def get_neighborhood(x, y, datasource, r=100):
    global database
    global source
    global ball_tree
    if datasource != source:
        load_kd_tree(datasource)
    index = ball_tree.query_radius([[x, y]], r=r)
    neighbors = index[0]
    try:
        neighborhood = []
        for neighbor in neighbors:
            row = database.iloc[[neighbor]]
            obj = row.to_dict(orient='records')[0]
            obj['id'] = str(neighbor)
            if 'phenotype' not in obj:
                obj['phenotype'] = ''
            neighborhood.append(obj)
        return neighborhood
    except:
        return {}
