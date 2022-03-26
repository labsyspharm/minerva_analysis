from minerva_analysis import app
from flask import render_template, request, Response, jsonify, abort, send_file
import io
from PIL import Image

from minerva_analysis.server.models import data_model
import os
from pathlib import Path
from time import time
import numpy as np
import pandas as pd
import json
import orjson
from flask_sqlalchemy import SQLAlchemy


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


# Gets a row based on the index
@app.route('/get_cells', methods=['POST'])
def get_datasource_row():
    post_data = json.loads(request.data)
    datasource = post_data['datasource']
    elem = post_data['elem']
    mode = post_data['mode']
    linked_dataset = post_data['linkedDataset']
    is_image = post_data['isImage']
    resp = data_model.get_cells(elem, datasource, mode, linked_dataset, is_image)
    return serialize_and_submit_json(resp)


# Gets a row based on the index
@app.route('/get_all_cells', methods=['POST'])
def get_all_datasource_row():
    post_data = json.loads(request.data)
    datasource = post_data['datasource']
    mode = post_data['mode']
    resp = data_model.get_all_cells(datasource, mode)
    return serialize_and_submit_json(resp)


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
    resp = data_model.get_color_scheme(datasource)
    return serialize_and_submit_json(resp)


@app.route('/get_neighborhood_list', methods=['GET'])
def get_neighborhood_list():
    datasource = request.args.get('datasource')
    resp = data_model.get_neighborhood_list(datasource)
    return serialize_and_submit_json(resp)


@app.route('/get_all_neighborhood_stats', methods=['GET'])
def get_all_neighboorhood_stats():
    datasource = request.args.get('datasource')
    resp = data_model.get_all_neighborhood_stats(datasource)
    return serialize_and_submit_json(resp)


@app.route('/get_individual_neighborhood', methods=['GET'])
def get_individual_neighborhood():
    x = float(request.args.get('point_x'))
    y = float(request.args.get('point_y'))
    max_distance = float(request.args.get('max_distance'))
    datasource = request.args.get('datasource')
    resp = data_model.get_individual_neighborhood(x, y, datasource, r=max_distance)
    return serialize_and_submit_json(resp)


@app.route('/get_neighborhood', methods=['POST'])
def get_neighborhood():
    post_data = json.loads(request.data)
    datasource = post_data['datasource']
    elem = post_data['elem']
    mode = post_data['mode']
    resp = data_model.get_neighborhood(elem, datasource, mode)
    return serialize_and_submit_json(resp)


@app.route('/edit_neighborhood', methods=['POST'])
def edit_neighborhood():
    post_data = json.loads(request.data)
    datasource = post_data['datasource']
    elem = post_data['elem']
    resp = data_model.edit_neighborhood(elem, datasource)
    return serialize_and_submit_json(resp)


@app.route('/save_neighborhood', methods=['POST'])
def save_neighborhood():
    post_data = json.loads(request.data)
    datasource = post_data['datasource']
    selection = post_data['selection']
    mode = post_data['mode']
    source = post_data['source']
    resp = data_model.save_neighborhood(selection, datasource, source, mode)
    return serialize_and_submit_json(resp)


@app.route('/save_lasso', methods=['POST'])
def save_lasso():
    post_data = json.loads(request.data)
    datasource = post_data['datasource']
    polygon = post_data['polygon']
    resp = data_model.save_lasso(polygon, datasource)
    return serialize_and_submit_json(resp)


@app.route('/delete_neighborhood', methods=['POST'])
def delete_neighborhood():
    post_data = json.loads(request.data)
    datasource = post_data['datasource']
    elem = post_data['elem']
    resp = data_model.delete_neighborhood(elem, datasource)
    return serialize_and_submit_json(resp)


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


@app.route('/get_scatterplot_data', methods=['GET'])
def get_scatterplot_data():
    datasource = request.args.get('datasource')
    mode = request.args.get('mode')
    resp = data_model.get_scatterplot_data(datasource, mode)
    return serialize_and_submit_json(resp)


@app.route('/get_cells_in_polygon', methods=['POST'])
def get_cells_in_polygon():
    post_data = json.loads(request.data)
    datasource = post_data['datasource']
    points = post_data['points']
    similar = post_data['similar_neighborhood'] == 'true'
    embedding = post_data['embedding'] == 'true'
    resp = data_model.get_cells_in_polygon(datasource, points, similar, embedding)
    return serialize_and_submit_json(resp)


@app.route('/find_custom_neighborhood', methods=['POST'])
def find_custom_neighborhood():
    post_data = json.loads(request.data)
    datasource = post_data['datasource']
    similarity = post_data['similarity']
    mode = post_data['mode']
    neighborhood_composition = post_data['neighborhoodComposition']
    resp = data_model.find_custom_neighborhood_wrapper(datasource, neighborhood_composition, similarity, mode)
    return serialize_and_submit_json(resp)


@app.route('/get_similar_neighborhood_to_selection', methods=['POST'])
def get_similar_neighborhood_to_selection():
    post_data = json.loads(request.data)
    datasource = post_data['datasource']
    similarity = post_data['similarity']
    selection_ids = post_data['selectionIds']
    mode = post_data['mode']
    resp = data_model.get_similar_neighborhood_to_selection(datasource, selection_ids, similarity, mode)
    return serialize_and_submit_json(resp)


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
    resp = data_model.get_gated_cells(datasource, filter)
    return serialize_and_submit_json(resp)


@app.route('/get_datasource_description', methods=['GET'])
def get_datasource_description():
    datasource = request.args.get('datasource')
    resp = data_model.get_datasource_description(datasource)
    return serialize_and_submit_json(resp)


@app.route('/get_heatmap_data', methods=['POST'])
def get_heatmap_data():
    post_data = json.loads(request.data)
    selection_ids = post_data['selectionIds']
    datasource = post_data['datasource']
    mode = post_data['mode']
    resp = data_model.get_heatmap_pearson_correlation(datasource, selection_ids, mode)
    return serialize_and_submit_json(resp)


@app.route('/get_neighborhood_by_phenotype', methods=['POST'])
def get_neighborhood_by_phenotype():
    post_data = json.loads(request.data)
    selection_ids = post_data['selectionIds']
    datasource = post_data['datasource']
    phenotype = post_data['phenotype']
    resp = data_model.get_neighborhood_by_phenotype(datasource, phenotype, selection_ids)
    return serialize_and_submit_json(resp)


@app.route('/upload_gates', methods=['POST'])
def upload_gates():
    file = request.files['file']
    if file.filename.endswith('.csv') == False:
        abort(422)
    datasource = request.form['datasource']
    save_path = Path(os.path.join(os.getcwd())) / "minerva_analysis" / "data" / datasource
    if save_path.is_dir() == False:
        abort(422)

    filename = 'uploaded_gates.csv'
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


@app.route('/custom_cluster', methods=['GET'])
def get_custom_clusters():
    # Parse (rect - [x, y, r], channels [string])
    datasource = request.args.get('datasource')
    num_clusters = int(request.args.get('numClusters'))
    mode = request.args.get('mode')
    data_model.create_custom_clusters(datasource, num_clusters, mode)
    resp = data_model.get_neighborhood_list(datasource)
    return serialize_and_submit_json(resp)


@app.route('/get_ome_metadata', methods=['GET'])
def get_ome_metadata():
    datasource = request.args.get('datasource')
    resp = data_model.get_ome_metadata(datasource)
    return serialize_and_submit_json(resp)


@app.route('/download_gating_csv', methods=['POST'])
def download_gating_csv():
    datasource = request.form['datasource']
    filter = json.loads(request.form['filter'])
    channels = json.loads(request.form['channels'])
    fullCsv = json.loads(request.form['fullCsv'])
    if fullCsv:
        csv = data_model.download_gating_csv(datasource, filter, channels)
    else:
        csv = data_model.download_gates(datasource, filter, channels)
    return Response(
        csv.to_csv(index=False),
        mimetype="text/csv",
        headers={"Content-disposition":
                     "attachment; filename=gating_csv.csv"})


@app.route('/get_uploaded_gating_csv_values', methods=['GET'])
def get_gating_csv_values():
    datasource = request.args.get('datasource')
    file_path = Path(os.path.join(os.getcwd())) / "minerva_analysis" / "data" / datasource / 'uploaded_gates.csv'
    if file_path.is_file() == False:
        abort(422)
    csv = pd.read_csv(file_path)
    obj = csv.to_dict(orient='records')
    return serialize_and_submit_json(obj)


@app.route('/get_contour_lines', methods=['POST'])
def get_contour_lines():
    post_data = json.loads(request.data)
    datasource = post_data['datasource']
    selection_ids = post_data['selectionIds']
    resp = data_model.get_contour_line_paths(datasource, selection_ids)
    return serialize_and_submit_json(resp)


@app.route('/get_related_image_data', methods=['GET'])
def get_related_image_data():
    datasource = request.args.get('datasource')
    mode = request.args.get('mode')
    resp = data_model.get_image_scatter(datasource, mode)
    return serialize_and_submit_json(resp)


@app.route('/get_image_search_results', methods=['GET'])
def get_image_search_results():
    datasource = request.args.get('datasource')
    linked_datasource = request.args.get('linkedDatasource')
    neighborhood_query = json.loads(request.args.get('neighborhoodQuery'))
    resp = data_model.search_across_images(datasource, linked_datasource, neighborhood_query)
    return serialize_and_submit_json(resp)


@app.route('/apply_neighborhood_query', methods=['POST'])
def apply_neighborhood_query():
    post_data = json.loads(request.data)
    datasource = post_data['datasource']
    neighborhood_query = post_data['neighborhoodQuery']
    mode = post_data['mode']
    resp = data_model.apply_neighborhood_query(datasource, neighborhood_query, mode)
    return serialize_and_submit_json(resp)


@app.route('/get_axis_order', methods=['GET'])
def get_axis_order():
    datasource = request.args.get('datasource')
    mode = request.args.get('mode')
    resp = data_model.calculate_axis_order(datasource, mode)
    return serialize_and_submit_json(resp)


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
