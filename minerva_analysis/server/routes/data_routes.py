from minerva_analysis import app
from flask import make_response, render_template, request, Response, jsonify, abort, send_file
import io
from PIL import Image
from minerva_analysis import data_path, get_config
from minerva_analysis.server.models import data_model
from pathlib import Path
from time import time
import pandas as pd
import gzip
import json
import orjson
import os
from flask_sqlalchemy import SQLAlchemy


@app.route('/init_database', methods=['GET'])
def init_database():
    datasource = request.args.get('datasource')
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


@app.route('/get_channel_names', methods=['GET'])
def get_channel_names():
    datasource = request.args.get('datasource')
    shortnames = bool(request.args.get('shortNames'))
    resp = data_model.get_channel_names(datasource, shortnames)
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

@app.route('/get_database_description', methods=['GET'])
def get_database_description():
    datasource = request.args.get('datasource')
    resp = data_model.get_datasource_description(datasource)
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


@app.route('/get_ome_metadata', methods=['GET'])
def get_ome_metadata():
    datasource = request.args.get('datasource')
    resp = data_model.get_ome_metadata(datasource).json()
    # OME-Types handles jsonify itself, so skip the orjson conversion
    response = app.response_class(
        response=resp,
        mimetype='application/json'
    )
    return response


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
    response = app.response_class(
        response=orjson.dumps(data, option=orjson.OPT_SERIALIZE_NUMPY),
        mimetype='application/json'
    )
    return response
