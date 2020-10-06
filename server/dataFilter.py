from sklearn.neighbors import BallTree
import numpy as np
import pandas as pd
from PIL import ImageColor
import requests
import json
import os
from pathlib import Path
import time
import pickle

ball_tree = None
database = None
source = None
config = None


def init(datasource):
    load_ball_tree(datasource)


def load_db(datasource, reload=False):
    global database
    global source
    global config
    if source is datasource and database is not None and reload is False:
        return
    load_config()
    if reload:
        load_ball_tree(datasource, reload=reload)
    csvPath = "." + config[datasource]['featureData'][0]['src']
    database = pd.read_csv(csvPath)
    embedding = np.load(Path("static/data/Ton_378/embedding.npy"))
    database['id'] = database.index
    database['Cluster'] = embedding[:, 2].astype('int32').tolist()
    source = datasource


def load_config():
    config_json_path = Path("static/data") / "config.json"
    global config
    with open(config_json_path, "r+") as configJson:
        config = json.load(configJson)


def load_ball_tree(datasource, reload=False):
    global ball_tree
    global database
    global config
    if datasource != source:
        load_db(datasource)
    pickled_kd_tree_path = str(Path(os.path.join(os.getcwd())) / "static" / "data" / datasource / "ball_tree.pickle")
    if os.path.isfile(pickled_kd_tree_path) and reload is False:
        print("Pickled KD Tree Exists, Loading")
        ball_tree = pickle.load(open(pickled_kd_tree_path, "rb"))
    else:
        print("Creating KD Tree")
        xCoordinate = config[datasource]['featureData'][0]['xCoordinate']
        print('X', xCoordinate)
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
        load_ball_tree(datasource)
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
        load_ball_tree(datasource)
    obj = database.loc[[row]].to_dict(orient='records')[0]
    obj['id'] = row
    return obj


def get_channel_names(datasource, shortnames=True):
    global database
    global source
    if datasource != source:
        load_ball_tree(datasource)
    if shortnames:
        channel_names = [channel['name'] for channel in config[datasource]['imageData'][1:]]
    else:
        channel_names = [channel['fullname'] for channel in config[datasource]['imageData'][1:]]
    return channel_names


def get_phenotypes(datasource):
    global database
    global source
    global config
    try:
        phenotype_field = config[datasource]['featureData'][0]['phenotype']
    except KeyError:
        phenotype_field = 'phenotype'

    if datasource != source:
        load_ball_tree(datasource)
    if phenotype_field in database.columns:
        return database[phenotype_field].unique().tolist()
    else:
        return ['']


def get_neighborhood(x, y, datasource, r=100):
    global database
    global source
    global ball_tree
    if datasource != source:
        load_ball_tree(datasource)
    index = ball_tree.query_radius([[x, y]], r=r)
    neighbors = index[0]
    try:
        neighborhood = []
        for neighbor in neighbors:
            row = database.iloc[[neighbor]]
            obj = row.to_dict(orient='records')[0]
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


def get_color_scheme(datasource, refresh, label_field='phenotype'):
    color_scheme_path = str(
        Path(os.path.join(os.getcwd())) / "static" / "data" / datasource / str(label_field + "_color_scheme.pickle"))
    if refresh == False:
        if os.path.isfile(color_scheme_path):
            print("Color Scheme Exists, Loading")
            color_scheme = pickle.load(open(color_scheme_path, "rb"))
            return color_scheme
    if label_field == 'phenotype':
        labels = get_phenotypes(datasource)
    elif label_field == 'cluster':
        labels = get_cluster_labels()

    color_scheme = {}
    colors = ["#FFFF00", "#1CE6FF", "#FF34FF", "#FF4A46", "#008941", "#006FA6", "#A30059", "#FFDBE5", "#7A4900",
              "#0000A6", "#63FFAC", "#B79762", "#004D43", "#8FB0FF", "#997D87", "#5A0007", "#809693", "#FEFFE6",
              "#1B4400", "#4FC601", "#3B5DFF", "#4A3B53", "#FF2F80", "#61615A", "#BA0900", "#6B7900", "#00C2A0",
              "#FFAA92", "#FF90C9", "#B903AA", "#D16100", "#DDEFFF", "#000035", "#7B4F4B", "#A1C299", "#300018",
              "#0AA6D8", "#013349", "#00846F", "#372101", "#FFB500", "#C2FFED", "#A079BF", "#CC0744", "#C0B9B2",
              "#C2FF99", "#001E09", "#00489C", "#6F0062", "#0CBD66", "#EEC3FF", "#456D75", "#B77B68", "#7A87A1",
              "#788D66", "#885578", "#FAD09F", "#FF8A9A", "#D157A0", "#BEC459", "#456648", "#0086ED", "#886F4C",
              "#34362D", "#B4A8BD", "#00A6AA", "#452C2C", "#636375", "#A3C8C9", "#FF913F", "#938A81", "#575329",
              "#00FECF", "#B05B6F", "#8CD0FF", "#3B9700", "#04F757", "#C8A1A1", "#1E6E00", "#7900D7", "#A77500",
              "#6367A9", "#A05837", "#6B002C", "#772600", "#D790FF", "#9B9700", "#549E79", "#FFF69F", "#201625",
              "#72418F", "#BC23FF", "#99ADC0", "#3A2465", "#922329", "#5B4534", "#FDE8DC", "#404E55", "#0089A3",
              "#CB7E98", "#A4E804", "#324E72", "#6A3A4C", "#83AB58", "#001C1E", "#D1F7CE", "#004B28", "#C8D0F6",
              "#A3A489", "#806C66", "#222800", "#BF5650", "#E83000", "#66796D", "#DA007C", "#FF1A59", "#8ADBB4",
              "#1E0200", "#5B4E51", "#C895C5", "#320033", "#FF6832", "#66E1D3", "#CFCDAC", "#D0AC94", "#7ED379",
              "#012C58", "#7A7BFF", "#D68E01", "#353339", "#78AFA1", "#FEB2C6", "#75797C", "#837393", "#943A4D",
              "#B5F4FF", "#D2DCD5", "#9556BD", "#6A714A", "#001325", "#02525F", "#0AA3F7", "#E98176", "#DBD5DD",
              "#5EBCD1", "#3D4F44", "#7E6405", "#02684E", "#962B75", "#8D8546", "#9695C5", "#E773CE", "#D86A78",
              "#3E89BE", "#CA834E", "#518A87", "#5B113C", "#55813B", "#E704C4", "#00005F", "#A97399", "#4B8160",
              "#59738A", "#FF5DA7", "#F7C9BF", "#643127", "#513A01", "#6B94AA", "#51A058", "#A45B02", "#1D1702",
              "#E20027", "#E7AB63", "#4C6001", "#9C6966", "#64547B", "#97979E", "#006A66", "#391406", "#F4D749",
              "#0045D2", "#006C31", "#DDB6D0", "#7C6571", "#9FB2A4", "#00D891", "#15A08A", "#BC65E9", "#FFFFFE",
              "#C6DC99", "#203B3C", "#671190", "#6B3A64", "#F5E1FF", "#FFA0F2", "#CCAA35", "#374527", "#8BB400",
              "#797868", "#C6005A", "#3B000A", "#C86240", "#29607C", "#402334", "#7D5A44", "#CCB87C", "#B88183",
              "#AA5199", "#B5D6C3", "#A38469", "#9F94F0", "#A74571", "#B894A6", "#71BB8C", "#00B433", "#789EC9",
              "#6D80BA", "#953F00", "#5EFF03", "#E4FFFC", "#1BE177", "#BCB1E5", "#76912F", "#003109", "#0060CD",
              "#D20096", "#895563", "#29201D", "#5B3213", "#A76F42", "#89412E", "#1A3A2A", "#494B5A", "#A88C85",
              "#F4ABAA", "#A3F3AB", "#00C6C8", "#EA8B66", "#958A9F", "#BDC9D2", "#9FA064", "#BE4700", "#658188",
              "#83A485", "#453C23", "#47675D", "#3A3F00", "#061203", "#DFFB71", "#868E7E", "#98D058", "#6C8F7D",
              "#D7BFC2", "#3C3E6E", "#D83D66", "#2F5D9B", "#6C5E46", "#D25B88", "#5B656C", "#00B57F", "#545C46",
              "#866097", "#365D25", "#252F99", "#00CCFF", "#674E60", "#FC009C", "#92896B"]
    for i in range(len(labels)):
        color_scheme[str(labels[i])] = {}
        color_scheme[str(labels[i])]['rgb'] = list(ImageColor.getcolor(colors[i], "RGB"))
        color_scheme[str(labels[i])]['hex'] = colors[i]

    pickle.dump(color_scheme, open(color_scheme_path, 'wb'))
    return color_scheme


def get_cluster_cells(datasource):
    global database
    global source
    global ball_tree
    if datasource != source:
        load_ball_tree(datasource)
    cluster_stats_path = str(
        Path(os.path.join(os.getcwd())) / "static" / "data" / datasource / "cluster_stats.pickle")
    if os.path.isfile(cluster_stats_path):
        print("Cluster Stats Exist, Loading")
        cluster_stats = pickle.load(open(cluster_stats_path, "rb"))
        return cluster_stats
    clusters = database['Cluster'].unique().tolist()
    obj = {}
    for cluster in clusters:
        cluster_cells = database.loc[database['Cluster'] == cluster]
        indices = cluster_cells.index.values.tolist()
        cluster_cells = cluster_cells[['id', 'Cluster', 'phenotype']].to_dict(orient='records')
        neighborhood_array = np.load(Path("static/data/Ton_378/neighborhood_array_complex.npy"))
        cluster_summary = np.mean(neighborhood_array[indices, :], axis=0)
        summary_stats = {'neighborhood_count': {}, 'avg_weight': {}, 'weighted_contribution': {}}
        phenotypes = database.phenotype.unique().tolist()
        for i in range(len(phenotypes)):
            count = cluster_summary[i * 2]
            weight = cluster_summary[i * 2 + 1]
            summary_stats['neighborhood_count'][phenotypes[i]] = count
            summary_stats['avg_weight'][phenotypes[i]] = weight
            summary_stats['weighted_contribution'][phenotypes[i]] = weight * count
        obj[str(cluster)] = {'cells': cluster_cells, 'clusterSummary': summary_stats}
    pickle.dump(obj, open(cluster_stats_path, 'wb'))
    return obj


def get_cluster_labels():
    data = np.load(Path("static/data/Ton_378/embedding.npy"))
    clusters = np.unique(data[:, 2])
    return clusters.astype('int32').tolist()


def get_scatterplot_data():
    data = np.load(Path("static/data/Ton_378/embedding.npy"))
    list_of_obs = [{'x': elem[0], 'y': elem[1], 'cluster': elem[2], 'id': id} for id, elem in enumerate(data)]
    visData = {
        'data': list_of_obs,
        'xMin': np.min(data[:, 0]),
        'xMax': np.max(data[:, 0]),
        'yMin': np.min(data[:, 1]),
        'yMax': np.max(data[:, 1]),
        'clusters': np.unique(data[:, 2]).astype('int32').tolist()
    }
    return visData
