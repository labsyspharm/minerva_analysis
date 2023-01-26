from minerva_analysis import app, get_config_names
from flask import render_template, send_from_directory
from pathlib import Path
import json
import os


@app.route("/")
def my_index():
    return render_template("index.html", data={'datasource': '', 'datasources': get_config_names()})





@app.route("/upload_page")
def upload_page():
    return render_template("upload.html", data={'datasource': '', 'datasources': get_config_names()})




@app.route('/client/<path:filename>')
def serveClient(filename):
    return send_from_directory(app.config['CLIENT_PATH'], filename, conditional=True)
