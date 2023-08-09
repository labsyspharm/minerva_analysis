from minerva_analysis import app, get_config_names, get_config, config_json_path
from flask import render_template, send_from_directory, request, send_file

from pathlib import Path
import json
import os

#gater
@app.route("/")
def my_index():
    return render_template("/index.html", data={'datasource': '', 'datasources': get_config_names(),
                                               'is_docker': app.config['IS_DOCKER']})

@app.route("/gater/")
def my_index_gater():
    return render_template("gater/index.html", data={'datasource': '', 'datasources': get_config_names(),
                                               'is_docker': app.config['IS_DOCKER']})

@app.route("/visinity/")
def my_index_visinity():
    return render_template("visinity/index.html", data={'datasource': '', 'datasources': get_config_names(),
                                               'is_docker': app.config['IS_DOCKER']})

@app.route("/scope2screen/")
def my_index_scope2screen():
    return render_template("scope2screen/index.html", data={'datasource': '', 'datasources': get_config_names(),
                                               'is_docker': app.config['IS_DOCKER']})

#visinity
@app.route("/data/config.json", methods=['GET'])
def serve_config_visinity():
    return send_file(config_json_path.resolve(), download_name='config.json')

#gater and scope2screen
# @app.route('/<string:datasource>', methods=['GET'])
# def image_viewer(datasource):
#     datasources = get_config_names()
#     if datasource not in datasources:
#         datasource = ''
#     return render_template('index.html', data={'datasource': datasource, 'datasources': datasources,
#                                                'is_docker': app.config['IS_DOCKER']})

#gater templates
@app.route('/gater/<string:datasource>', methods=['GET'])
def image_viewer_gater(datasource):
    return image_viewer(datasource, 'gater/')

#scope2screen templates
@app.route('/scope2screen/<string:datasource>', methods=['GET'])
def image_viewer_scope2screen(datasource):
    return image_viewer(datasource, 'scope2screen/')

#visinity templates
@app.route('/visinity/<string:datasource>', methods=['GET'])
def image_viewer_visinity(datasource):
    return image_viewer(datasource, 'visinity/')

#generic
@app.route('/<string:datasource>', methods=['GET'])
def image_viewer(datasource, context=''):
    datasources = get_config_names()
    config = get_config()
    if datasource in config:
        config = get_config()[datasource]
    else:
        config = {}
    apply_previous = request.args.get('applyPrevious', default=False)
    mode = request.args.get('mode', default='single')
    if datasource not in datasources:
        datasource = ''

    return render_template(context + 'index.html',
                           data={'datasource': datasource, 'datasources': datasources,
                                 'applyPrevious': apply_previous, 'mode': mode, 'config': config,
                                 'is_docker': app.config['IS_DOCKER']})

#gater
@app.route("/upload_page")
def upload_page():
    return render_template("gater/upload.html", data={'datasource': '', 'datasources': get_config_names(),
                                                'is_docker': app.config['IS_DOCKER']})

#gater
@app.route('/gater/<path:filename>')
def serveGater(filename):
    return send_from_directory(app.config['CLIENT_PATH'], 'gater/' + filename, conditional=True)

#visinity
@app.route('/visinity/<path:filename>')
def serveVisinity(filename):
    return send_from_directory(app.config['CLIENT_PATH'], 'visinity/' + filename, conditional=True)

#scope2screen
@app.route('/scope2screen/<path:filename>')
def serveScope2Screen(filename):
    return send_from_directory(app.config['CLIENT_PATH'], 'scope2screen/' + filename, conditional=True)



#visinity
@app.route('/static/<path:filename>')
def rerouteStatic(filename):
    test = ''

#visinity
@app.route('/compare_neighborhoods/<string:datasource>')
def compare_neighborhoods(datasource):
    datasources = get_config_names()
    if datasource not in datasources:
        datasource = ''

    return render_template('compare_neighborhoods.html', data={'datasource': datasource, 'datasources': datasources,
                                                               'is_docker': app.config['IS_DOCKER']})
