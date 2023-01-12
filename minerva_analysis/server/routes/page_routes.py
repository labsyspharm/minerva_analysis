from minerva_analysis import app, get_config_names
from flask import render_template, send_from_directory
from pathlib import Path
import json
import os


@app.route("/")
def my_index():
    return render_template("index.html", data={'datasource': '', 'datasources': get_config_names(),
                                               'is_docker': app.config['IS_DOCKER']})


@app.route('/<string:datasource>')
def image_viewer(datasource):
    datasources = get_config_names()
    if datasource not in datasources:
        datasource = ''
    return render_template('index.html', data={'datasource': datasource, 'datasources': datasources,
                                               'is_docker': app.config['IS_DOCKER']})



@app.route("/upload_page")
def upload_page():
    return render_template("upload.html", data={'datasource': '', 'datasources': get_config_names(),
                                                'is_docker': app.config['IS_DOCKER']})




@app.route('/client/<path:filename>')
def serveClient(filename):
    return send_from_directory(app.config['CLIENT_PATH'], filename, conditional=True)
