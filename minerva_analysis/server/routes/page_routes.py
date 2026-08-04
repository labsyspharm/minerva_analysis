from minerva_analysis import app, get_config_names
from flask import render_template, send_from_directory
from pathlib import Path
import json
import os


def template_data(**values):
    data = {
        'datasource': '',
        'datasources': get_config_names(),
        'is_docker': app.config.get('IS_DOCKER', False),
        'base_url': app.config.get('MINERVA_BASE_URL', ''),
    }
    data.update(values)
    return data


@app.route("/")
def my_index():
    return render_template("index.html", data=template_data())


@app.route('/<string:datasource>')
def image_viewer(datasource):
    datasources = get_config_names()
    if datasource not in datasources:
        datasource = ''
    return render_template('index.html', data=template_data(datasource=datasource, datasources=datasources))



@app.route("/upload_page")
def upload_page():
    return render_template("upload.html", data=template_data())




@app.route('/client/<path:filename>')
def serveClient(filename):
    return send_from_directory(app.config['CLIENT_PATH'], filename, conditional=True)
