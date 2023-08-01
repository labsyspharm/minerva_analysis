from minerva_analysis import app
from flask import make_response, render_template, request, Response, jsonify, abort, send_file
import io
from PIL import Image
from minerva_analysis import data_path, get_config
from minerva_analysis.server.models import data_model
from minerva_analysis.server.analytics import comparison
from pathlib import Path
from time import time
import numpy as np
import pandas as pd
import gzip
import json
import orjson
import os
from os import walk
from flask_sqlalchemy import SQLAlchemy


@app.route('/init_database', methods=['GET'])
def init_database():
    datasource = request.args.get('datasource')
    isChannel = request.args.get('isChannels')
    if (isChannel == False):
        data_model.init(datasource, False)
    else:
        data_model.init(datasource)
    resp = jsonify(success=True)
    return resp

#still doubled because somehow called differently in tools
@app.route('/init_datasource', methods=['GET'])
def init_datasource():
    datasource = request.args.get('datasource')
    isChannel = request.args.get('isChannels')
    if (isChannel == 'false'):
        data_model.init(datasource, False)
    else:
        data_model.init(datasource)
    resp = jsonify(success=True)
    return resp

@app.route('/config')
def serve_config():
    return get_config()


@app.route('/get_nearest_cell', methods=['GET'])
def get_nearest_cell():
    x = float(request.args.get('point_x'))
    y = float(request.args.get('point_y'))
    datasource = request.args.get('datasource')
    resp = data_model.query_for_closest_cell(x, y, datasource)
    return serialize_and_submit_json(resp)


@app.route('/get_channel_cell_ids', methods=['GET'])
def get_channel_cell_ids():
    datasource = request.args.get('datasource')
    filter = json.loads(request.args.get('filter'))
    resp = data_model.get_channel_cells(datasource, filter)
    return serialize_and_submit_json(resp)

#scope2screen
@app.route('/get_cell_ids_phenotype', methods=['GET'])
def get_cell_ids_phenotype():
    datasource = request.args.get('datasource')
    resp = data_model.get_cells_phenotype(datasource)
    return serialize_and_submit_json(resp)

#scope2screen
# Gets a row based on the index
@app.route('/get_phenotype_column_name', methods=['GET'])
def get_phenotype_column_name():
    datasource = request.args.get('datasource')
    resp = data_model.get_phenotype_column_name(datasource)
    return serialize_and_submit_json(resp)

#scope2screen
# Gets a row based on the index
@app.route('/get_phenotype_description', methods=['GET'])
def get_phenotype_description():
    datasource = request.args.get('datasource')
    resp = data_model.get_phenotype_description(datasource)
    return serialize_and_submit_json(resp)

# Gets a row based on the index
@app.route('/get_database_row', methods=['GET'])
def get_database_row():
    datasource = request.args.get('datasource')
    row = int(request.args.get('row'))
    resp = data_model.get_row(row, datasource)
    return serialize_and_submit_json(resp)


#visinity
# Gets a row based on the index
@app.route('/get_cells', methods=['POST'])
def get_datasource_row_visinity():
    post_data = json.loads(request.data)
    datasource = post_data['datasource']
    elem = post_data['elem']
    mode = post_data['mode']
    linked_dataset = post_data['linkedDataset']
    is_image = post_data['isImage']
    log_normalization = post_data['logNormalization']
    resp = data_model.get_cells(elem, datasource, mode, linked_dataset, is_image,log_normalization)
    return serialize_and_submit_json(resp)

#visinity
# Gets a row based on the index
@app.route('/get_all_cells', methods=['POST'])
def get_all_datasource_row():
    post_data = json.loads(request.data)
    datasource = post_data['datasource']
    mode = post_data['mode']
    resp = data_model.get_all_cell_neighborhoods(datasource, mode)
    return serialize_and_submit_json(resp)

@app.route('/get_all_cells/<dtype>/', methods=['GET'])
def get_all_cells(dtype):
    datasource = request.args.get('datasource')
    data_type = int if 'integer' == dtype else float
    start_keys = list(request.args.get('start_keys').split(','))
    resp = data_model.get_all_cells(datasource, start_keys, data_type)
    content = gzip.compress(resp.tobytes('C'))
    response = make_response(content)
    response.headers.set('Content-Type', 'application/octet-stream')
    response.headers['Content-length'] = len(content)
    response.headers['Content-Encoding'] = 'gzip'
    return response

@app.route('/get_channel_names', methods=['GET'])
def get_channel_names():
    datasource = request.args.get('datasource')
    shortnames = bool(request.args.get('shortNames'))
    resp = data_model.get_channel_names(datasource, shortnames)
    return serialize_and_submit_json(resp)


@app.route('/get_phenotypes', methods=['GET'])
def get_phenotypes():
    datasource = request.args.get('datasource')
    resp = data_model.get_phenotypes(datasource)
    return serialize_and_submit_json(resp)


@app.route('/get_color_scheme', methods=['GET'])
def get_color_scheme():
    datasource = request.args.get('datasource')
    refresh = request.args.get('refresh') == 'true'
    resp = data_model.get_color_scheme(datasource, refresh)
    return serialize_and_submit_json(resp)

def get_color_scheme(datasource_name):
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

def get_color_scheme(datasource_name):
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

#visinity
@app.route('/get_neighborhood_list', methods=['GET'])
def get_neighborhood_list():
    datasource = request.args.get('datasource')
    resp = data_model.get_neighborhood_list(datasource)
    return serialize_and_submit_json(resp)

#visinity
@app.route('/get_all_neighborhood_stats', methods=['GET'])
def get_all_neighboorhood_stats():
    datasource = request.args.get('datasource')
    resp = data_model.get_all_neighborhood_stats(datasource)
    return serialize_and_submit_json(resp)

#visinity
@app.route('/get_individual_neighborhood', methods=['GET'])
def get_individual_neighborhood():
    x = float(request.args.get('point_x'))
    y = float(request.args.get('point_y'))
    max_distance = float(request.args.get('max_distance'))
    datasource = request.args.get('datasource')
    resp = data_model.get_individual_neighborhood(x, y, datasource, r=max_distance)
    return serialize_and_submit_json(resp)

#visinity
@app.route('/get_neighborhood', methods=['POST'])
def get_neighborhood_visinity():
    post_data = json.loads(request.data)
    datasource = post_data['datasource']
    elem = post_data['elem']
    mode = post_data['mode']
    resp = data_model.get_neighborhood(elem, datasource, mode)
    return serialize_and_submit_json(resp)

@app.route('/get_neighborhood', methods=['GET'])
def get_neighborhood():
    x = float(request.args.get('point_x'))
    y = float(request.args.get('point_y'))
    max_distance = float(request.args.get('max_distance'))
    datasource = request.args.get('datasource')
    resp = data_model.get_neighborhood(x, y, datasource, r=max_distance)
    return serialize_and_submit_json(resp)

#visinity
@app.route('/save_neighborhood', methods=['POST'])
def save_neighborhood():
    post_data = json.loads(request.data)
    datasource = post_data['datasource']
    selection = post_data['selection']
    mode = post_data['mode']
    source = post_data['source']
    resp = data_model.save_neighborhood(selection, datasource, source, mode)
    return serialize_and_submit_json(resp)

#scope2screen
@app.route('/get_neighborhood_for_spat_corr', methods=['GET'])
def get_neighborhood_for_spat_corr():
    x = float(request.args.get('point_x'))
    y = float(request.args.get('point_y'))
    max_distance = float(request.args.get('max_distance'))
    datasource = request.args.get('datasource')
    resp = data_model.get_neighborhood_for_spat_corr(x, y, datasource, r=max_distance)
    return serialize_and_submit_json(resp)

#scope2screen
@app.route('/get_k_results_for_spat_corr', methods=['GET'])
def get_k_results_for_spat_corr():
    x = float(request.args.get('point_x'))
    y = float(request.args.get('point_y'))
    max_distance = float(request.args.get('max_distance'))
    channels = request.args.get('channels').split()[0].split(',')
    datasource = request.args.get('datasource')
    resp = data_model.get_k_results_for_spat_corr(x, y, datasource, r=max_distance, channels=channels)
    return serialize_and_submit_json(resp)


@app.route('/get_naive_states', methods=['GET'])
def get_naive_states():
    # test of triggering docker module
    dirname = os.path.dirname(__file__)
    os.system('docker run --rm -v' + dirname + '/data:/data labsyspharm/naivestates:1.7.0 /app/main.R -i /data/unmicst-163.csv')
    os.path.join(os.getcwd() / data_path / "data"  / "umicst-162-models.csv")

#visnity
@app.route('/save_lasso', methods=['POST'])
def save_lasso():
    post_data = json.loads(request.data)
    datasource = post_data['datasource']
    polygon = post_data['polygon']
    resp = data_model.save_lasso(polygon, datasource)
    return serialize_and_submit_json(resp)

#visinity
@app.route('/delete_neighborhood', methods=['POST'])
def delete_neighborhood():
    post_data = json.loads(request.data)
    datasource = post_data['datasource']
    elem = post_data['elem']
    resp = data_model.delete_neighborhood(elem, datasource)
    return serialize_and_submit_json(resp)

#visinity
@app.route('/download_neighborhood', methods=['POST'])
def download_neighborhood():
    post_data = json.loads(request.data)
    datasource = post_data['datasource']
    elem = post_data['elem']
    resp_df = data_model.download_neighborhood(elem, datasource)
    return Response(
        resp_df.to_csv(index=False),
        mimetype="text/csv",
        headers={"Content-disposition":
                     "attachment; filename=gating_csv.csv"})

#visinity
@app.route('/get_cluster_cells', methods=['GET'])
def get_cluster_cells():
    datasource = request.args.get('datasource')
    resp = data_model.get_cluster_cells(datasource)
    return serialize_and_submit_json(resp)


@app.route('/get_num_cells_in_circle', methods=['GET'])
def get_num_cells_in_circle():
    datasource = request.args.get('datasource')
    x = float(request.args.get('point_x'))
    y = float(request.args.get('point_y'))
    r = float(request.args.get('radius'))
    resp = data_model.get_number_of_cells_in_circle(x, y, datasource, r=r)
    return serialize_and_submit_json(resp)

#visinity
@app.route('/get_scatterplot_data', methods=['GET'])
def get_scatterplot_data():
    datasource = request.args.get('datasource')
    mode = request.args.get('mode')
    resp = data_model.get_scatterplot_data(datasource, mode)
    return serialize_and_submit_json(resp)

#visinity
@app.route('/get_cells_in_polygon', methods=['POST'])
def get_cells_in_polygon():
    post_data = json.loads(request.data)
    datasource = post_data['datasource']
    points = post_data['points']
    similar = post_data['similar_neighborhood'] == 'true'
    embedding = post_data['embedding'] == 'true'
    resp = data_model.get_cells_in_polygon(datasource, points, similar, embedding)
    return serialize_and_submit_json(resp)

#visinity
@app.route('/find_custom_neighborhood', methods=['POST'])
def find_custom_neighborhood():
    post_data = json.loads(request.data)
    datasource = post_data['datasource']
    similarity = post_data['similarity']
    mode = post_data['mode']
    neighborhood_composition = post_data['neighborhoodComposition']
    resp = data_model.find_custom_neighborhood_wrapper(datasource, neighborhood_composition, similarity, mode)
    return serialize_and_submit_json(resp)

#visinity
@app.route('/get_similar_neighborhood_to_selection', methods=['POST'])
def get_similar_neighborhood_to_selection():
    post_data = json.loads(request.data)
    datasource = post_data['datasource']
    similarity = post_data['similarity']
    selection_ids = post_data['selectionIds']
    mode = post_data['mode']
    resp = data_model.get_similar_neighborhood_to_selection(datasource, selection_ids, similarity, mode)
    return serialize_and_submit_json(resp)

#visinity
@app.route('/compute_p_value', methods=['POST'])
def compute_p_value():
    post_data = json.loads(request.data)
    datasource = post_data['datasource']
    num_results = post_data['numResults']
    neighborhood_query = json.loads(post_data['neighborhoodQuery'])
    resp = data_model.compute_individual_p_value(datasource, num_results, neighborhood_query)
    return serialize_and_submit_json(resp)

@app.route('/get_gated_cell_ids', methods=['GET'])
def get_gated_cell_ids():
    datasource = request.args.get('datasource')
    filter = json.loads(request.args.get('filter'))
    start_keys = list(request.args.get('start_keys').split(','))
    resp = data_model.get_gated_cells(datasource, filter, start_keys)
    return serialize_and_submit_json(resp)

#visinity
# @app.route('/get_gated_cell_ids', methods=['GET'])
# def get_gated_cell_ids():
#     datasource = request.args.get('datasource')
#     filter = json.loads(request.args.get('filter'))
#     resp = data_model.get_gated_cells(datasource, filter)
#     return serialize_and_submit_json(resp)

@app.route('/get_gated_cell_ids_custom', methods=['GET'])
def get_gated_cell_ids_custom():
    datasource = request.args.get('datasource')
    filter = json.loads(request.args.get('filter'))
    start_keys = list(request.args.get('start_keys').split(','))
    resp = data_model.get_gated_cells_custom(datasource, filter, start_keys)
    return serialize_and_submit_json(resp)

# @app.route('/get_channel_cell_ids', methods=['GET'])
# def get_channel_cell_ids():
#     datasource = request.args.get('datasource')
#     filter = json.loads(request.args.get('filter'))
#     resp = data_model.get_channel_cells(datasource, filter)
#     return serialize_and_submit_json(resp)


@app.route('/get_database_description', methods=['GET'])
def get_database_description():
    datasource = request.args.get('datasource')
    resp = data_model.get_datasource_description(datasource)
    return serialize_and_submit_json(resp)

#visinity
@app.route('/get_heatmap_data', methods=['POST'])
def get_heatmap_data():
    post_data = json.loads(request.data)
    selection_ids = post_data['selectionIds']
    datasource = post_data['datasource']
    mode = post_data['mode']
    resp = data_model.get_heatmap_pearson_correlation(datasource, selection_ids, mode)
    return serialize_and_submit_json(resp)

#visinity
@app.route('/get_neighborhood_by_phenotype', methods=['POST'])
def get_neighborhood_by_phenotype():
    post_data = json.loads(request.data)
    selection_ids = post_data['selectionIds']
    datasource = post_data['datasource']
    phenotype = post_data['phenotype']
    resp = data_model.get_neighborhood_by_phenotype(datasource, phenotype, selection_ids)
    return serialize_and_submit_json(resp)

#visinity
@app.route('/brush_selection', methods=['POST'])
def brush_selection():
    post_data = json.loads(request.data)
    selection_ids = post_data['selectionIds']
    datasource = post_data['datasource']
    brush = post_data['brush']
    resp = data_model.brush_selection(datasource, brush, selection_ids)
    return serialize_and_submit_json(resp)


@app.route('/get_channel_gmm', methods=['GET'])
def get_channel_gmm():
    channel = request.args.get('channel')
    datasource = request.args.get('datasource')
    resp = data_model.get_channel_gmm(channel, datasource)
    return serialize_and_submit_json(resp)


@app.route('/get_gating_gmm', methods=['GET'])
def get_gating_gmm():
    channel = request.args.get('channel')
    datasource = request.args.get('datasource')
    resp = data_model.get_gating_gmm(channel, datasource)
    return serialize_and_submit_json(resp)


@app.route('/upload_gates', methods=['POST'])
def upload_gates():
    file = request.files['file']
    if file.filename.endswith('.csv') == False:
        abort(422)
    datasource = request.form['datasource']
    save_path = data_path / datasource
    if save_path.is_dir() == False:
        abort(422)

    filename = 'uploaded_gates.csv'
    file.save(Path(save_path / filename))
    resp = jsonify(success=True)
    return resp

#visinity
# @app.route('/upload_gates', methods=['POST'])
# def upload_gates():
#     file = request.files['file']
#     if file.filename.endswith('.csv') == False:
#         abort(422)
#     datasource = request.form['datasource']
#     save_path = Path(os.path.join(os.getcwd())) / "minerva_analysis" / "data" / datasource
#     if save_path.is_dir() == False:
#         abort(422)
#
#     filename = 'uploaded_gates.csv'
#     file.save(Path(save_path / filename))
#     resp = jsonify(success=True)
#     return resp

@app.route('/upload_channels', methods=['POST'])
def upload_channels():
    file = request.files['file']
    if file.filename.endswith('.csv') == False:
        abort(422)
    datasource = request.form['datasource']
    save_path = data_path / datasource
    if save_path.is_dir() == False:
        abort(422)

    filename = 'uploaded_channels.csv'
    file.save(Path(save_path / filename))
    resp = jsonify(success=True)
    return resp

@app.route('/get_rect_cells', methods=['GET'])
def get_rect_cells():
    # Parse (rect - [x, y, r], channels [string])
    datasource = request.args.get('datasource')
    rect = [float(x) for x in request.args.get('rect').split(',')]
    channels = request.args.get('channels')

    # Retrieve cells - FIXME: Too slow - jam is stalling image loading
    resp = data_model.get_rect_cells(datasource, rect, channels)
    print('Neighborhood size:', len(resp))
    return serialize_and_submit_json(resp)

# #visinity
# @app.route('/get_rect_cells', methods=['GET'])
# def get_rect_cells():
#     # Parse (rect - [x, y, r], channels [string])
#     datasource = request.args.get('datasource')
#     rect = [float(x) for x in request.args.get('rect').split(',')]
#     channels = request.args.get('channels')
#
#     # Retrieve cells - FIXME: Too slow - jam is stalling image loading
#     resp = data_model.get_rect_cells(datasource, rect, channels)
#     print('Neighborhood size:', len(resp))
#     return serialize_and_submit_json(resp)

#visinity
@app.route('/custom_cluster', methods=['GET'])
def get_custom_clusters():
    # Parse (rect - [x, y, r], channels [string])
    datasource = request.args.get('datasource')
    num_clusters = int(request.args.get('numClusters'))
    subsample = request.args.get('subsample') == 'true'
    mode = request.args.get('mode')
    data_model.create_custom_clusters(datasource, num_clusters, mode, subsample)
    resp = data_model.get_neighborhood_list(datasource)
    return serialize_and_submit_json(resp)



@app.route('/get_ome_metadata', methods=['GET'])
def get_ome_metadata():
    datasource = request.args.get('datasource')
    resp = data_model.get_ome_metadata(datasource)
    if resp:
        resp = resp.json()
    # OME-Types handles jsonify itself, so skip the orjson conversion
    response = app.response_class(
        response=resp,
        mimetype='application/json'
    )
    return response

# #visinity
# @app.route('/get_ome_metadata', methods=['GET'])
# def get_ome_metadata():
#     datasource = request.args.get('datasource')
#     resp = data_model.get_ome_metadata(datasource)
#     return serialize_and_submit_json(resp)

#scope2screen
# @app.route('/get_ome_metadata', methods=['GET'])
# def get_ome_metadata():
#     datasource = request.args.get('datasource')
#     resp = data_model.get_ome_metadata(datasource).json()
#     # OME-Types handles jsonify itself, so skip the orjson conversion
#     response = app.response_class(
#         response=resp,
#         mimetype='application/json'
#     )
#     return response

@app.route('/download_gating_csv', methods=['POST'])
def download_gating_csv():
    datasource = request.form['datasource']
    filename = request.form['filename']

    filter = json.loads(request.form['filter'])
    channels = json.loads(request.form['channels'])
    fullCsv = json.loads(request.form['fullCsv'])
    encoding = request.form['encoding']
    if fullCsv:
        csv = data_model.download_gating_csv(datasource, filter, channels, encoding)
        return Response(
            csv.to_csv(index=False),
            mimetype="text/csv",
            headers={"Content-disposition":
                         "attachment; filename=" + filename + ".csv"})
    else:
        csv = data_model.download_gates(datasource, filter, channels)
        return Response(
            csv.to_csv(index=False),
            mimetype="text/csv",
            headers={"Content-disposition":
                         "attachment; filename=" + filename + ".csv"})

@app.route('/save_gating_list', methods=['POST'])
def save_gating_list():
    post_data = json.loads(request.data)

    datasource = post_data['datasource']
    filter = post_data['filter']
    channels = post_data['channels']

    data_model.save_gating_list(datasource, filter, channels)

    resp = jsonify(success=True)
    return resp

@app.route('/get_saved_gating_list', methods=['GET'])
def get_saved_gating_list():
    datasource = request.args.get('datasource')
    resp = data_model.get_saved_gating_list(datasource)
    return serialize_and_submit_json(resp)

@app.route('/download_channels_csv', methods=['POST'])
def download_channels_csv():
    filename = request.form['filename']

    datasource = request.form['datasource']
    map_channels = json.loads(request.form['map_channels'])
    active_channels = json.loads(request.form['active_channels'])
    list_colors = json.loads(request.form['list_colors'])
    list_ranges = json.loads(request.form['list_ranges'])
    list_channels = json.loads(request.form['list_channels'])
    csv = data_model.download_channels(datasource, map_channels, active_channels, list_colors, list_ranges, list_channels)
    return Response(
        csv.to_csv(index=False),
        mimetype="text/csv",
        headers={"Content-disposition":
                     "attachment; filename=" + filename + ".csv"})

@app.route('/save_channel_list', methods=['POST'])
def save_channel_list():
    post_data = json.loads(request.data)

    datasource = post_data['datasource']
    map_channels = post_data['map_channels']
    active_channels = post_data['active_channels']
    list_colors = post_data['list_colors']
    list_ranges = post_data['list_ranges']
    list_channels = post_data['list_channels']

    data_model.save_channel_list(datasource, map_channels, active_channels, list_colors, list_ranges, list_channels)

    resp = jsonify(success=True)
    return resp

@app.route('/get_uploaded_gating_csv_values', methods=['GET'])
def get_gating_csv_values():
    datasource = request.args.get('datasource')
    file_path = data_path / datasource / 'uploaded_gates.csv'
    if file_path.is_file() == False:
        abort(422)
    csv = pd.read_csv(file_path)
    obj = csv.to_dict(orient='records')
    return serialize_and_submit_json(obj)

#visinity
# @app.route('/get_uploaded_gating_csv_values', methods=['GET'])
# def get_gating_csv_values():
#     datasource = request.args.get('datasource')
#     file_path = Path(os.path.join(os.getcwd())) / "minerva_analysis" / "data" / datasource / 'uploaded_gates.csv'
#     if file_path.is_file() == False:
#         abort(422)
#     csv = pd.read_csv(file_path)
#     obj = csv.to_dict(orient='records')
#     return serialize_and_submit_json(obj)

#scope2screen
@app.route('/histogram_comparison', methods=['GET'])
def histogram_comparison():
    x = float(request.args.get('point_x'))
    y = float(request.args.get('point_y'))
    max_distance = float(request.args.get('max_distance'))
    datasource = request.args.get('datasource')
    viewport = request.args.getlist('viewport')[0]
    zoomlevel = int(float(request.args.get('zoomlevel')))
    sensitivity = float(request.args.get('sensitivity'))

    # for which channels to compute? (currently only the first)
    channels = []
    if request.args.get('channels') != '':
        channels = request.args.get('channels').split()[0].split(',')

    # call functionality
    resp = comparison.histogramComparison(x, y, datasource, max_distance, channels, viewport, zoomlevel, sensitivity)
    return serialize_and_submit_json(resp)

#visinity
@app.route('/histogram_comparison_simmap', methods=['GET'])
def histogram_comparison_simmap():
    x = float(request.args.get('point_x'))
    y = float(request.args.get('point_y'))
    max_distance = float(request.args.get('max_distance'))
    datasource = request.args.get('datasource')
    viewport = request.args.getlist('viewport')[0]
    zoomlevel = int(float(request.args.get('zoomlevel')))
    sensitivity = float(request.args.get('sensitivity'))

    # for which channels to compute? (currently only the first)
    channels = []
    if request.args.get('channels') != '':
        channels = request.args.get('channels').split()[0].split(',')

    # call functionality
    resp = comparison.histogramComparisonSimMap(x, y, datasource, max_distance, channels, viewport, zoomlevel,
                                                sensitivity)
    # file_object = io.BytesIO()
    # # write PNG in file-object
    # Image.fromarray(png).save(file_object, 'PNG', compress_level=0)
    # # move to beginning of file so `send_file()` it will read from start
    # file_object.seek(0)
    return serialize_and_submit_json(resp)

@app.route('/get_uploaded_channel_csv_values', methods=['GET'])
def get_channel_csv_values():
    datasource = request.args.get('datasource')
    file_path = data_path / datasource / 'uploaded_channels.csv'
    if file_path.is_file() == False:
        abort(422)
    csv = pd.read_csv(file_path)
    obj = csv.to_dict(orient='records')
    return serialize_and_submit_json(obj)

@app.route('/get_saved_channel_list', methods=['GET'])
def get_saved_channel_list():
    datasource = request.args.get('datasource')
    resp = data_model.get_saved_channel_list(datasource)
    return serialize_and_submit_json(resp)

#visinity
@app.route('/get_contour_lines', methods=['POST'])
def get_contour_lines():
    post_data = json.loads(request.data)
    datasource = post_data['datasource']
    selection_ids = post_data['selectionIds']
    resp = data_model.get_contour_line_paths(datasource, selection_ids)
    return serialize_and_submit_json(resp)

#visinity
@app.route('/get_related_image_data', methods=['GET'])
def get_related_image_data():
    datasource = request.args.get('datasource')
    mode = request.args.get('mode')
    resp = data_model.get_image_scatter(datasource, mode)
    return serialize_and_submit_json(resp)

#visinity
@app.route('/get_image_search_results', methods=['GET'])
def get_image_search_results():
    datasource = request.args.get('datasource')
    linked_datasource = request.args.get('linkedDatasource')
    neighborhood_query = json.loads(request.args.get('neighborhoodQuery'))
    resp = data_model.search_across_images(datasource, linked_datasource, neighborhood_query)
    return serialize_and_submit_json(resp)

#visinity
@app.route('/apply_neighborhood_query', methods=['POST'])
def apply_neighborhood_query():
    post_data = json.loads(request.data)
    datasource = post_data['datasource']
    neighborhood_query = post_data['neighborhoodQuery']
    mode = post_data['mode']
    resp = data_model.apply_neighborhood_query(datasource, neighborhood_query, mode)
    return serialize_and_submit_json(resp)

#visinity
@app.route('/get_axis_order', methods=['GET'])
def get_axis_order():
    datasource = request.args.get('datasource')
    mode = request.args.get('mode')
    resp = data_model.calculate_axis_order(datasource, mode)
    return serialize_and_submit_json(resp)


#scope2screen
@app.route('/save_dot', methods=['POST'])
def save_dot():
    post_data = json.loads(request.data)
    datasource = post_data['datasource']
    dot = post_data['dot']
    resp = data_model.save_dot(datasource, dot)
    return serialize_and_submit_json(resp)

#scope2screen
@app.route('/load_dots', methods=['GET'])
def load_dots():
    datasource = request.args.get('datasource')
    dots = data_model.load_dots(datasource)
    dots_dict = [to_dict(dot) for dot in dots]
    return serialize_and_submit_json(dots_dict)

#scope2screen
@app.route('/delete_dot', methods=['GET'])
def delete_dot():
    datasource = request.args.get('datasource')
    id = int(request.args.get('id'))
    dots = data_model.delete_dot(datasource, id)
    return serialize_and_submit_json(True)

#scope2screen
def to_dict(row):
    return {column.name: getattr(row, row.__mapper__.get_property_by_column(column).key) for column in
            row.__table__.columns}


# E.G /generated/data/melanoma/channel_00_files/13/16_18.png
@app.route('/generated/data/<string:datasource>/<string:channel>/<string:level>/<string:tile>')
def generate_png(datasource, channel, level, tile):
    now = time()
    png = data_model.generate_zarr_png(datasource, channel, level, tile)
    file_object = io.BytesIO()
    # write PNG in file-object
    Image.fromarray(png).save(file_object, 'PNG', compress_level=0)
    # move to beginning of file so `send_file()` it will read from start
    file_object.seek(0)
    return send_file(file_object, mimetype='image/PNG')

# def serialize_and_submit_json(data):
#     response = app.response_class(
#         response=orjson.dumps(data, option=orjson.OPT_SERIALIZE_NUMPY),
#         mimetype='application/json'
#     )
#     return response

#scope2screen
@app.route('/start_spatial_correlation')
def start_spatial_correlation():
    data_model.spatial_corr([])
    return 'hi'


#visinity
def serialize_and_submit_json(data):
    response = None
    try:
        response = app.response_class(
            response=orjson.dumps(data, option=orjson.OPT_SERIALIZE_NUMPY),
            mimetype='application/json'
        )
    #     Handle case where array isn't C contiguous
    except TypeError:
        response = app.response_class(
            response=orjson.dumps(np.ascontiguousarray(data), option=orjson.OPT_SERIALIZE_NUMPY),
            mimetype='application/json'
        )
    return response
