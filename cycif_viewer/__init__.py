from flask import Flask
from pathlib import Path
from flask_sqlalchemy import SQLAlchemy

from numcodecs import compat_ext  # Needed for pyinstaller
from numcodecs import blosc  # Needed for pyinstaller

import os
import json

app = Flask(__name__, template_folder=Path('server/templates'), static_folder='data')
app.config['TEMPLATES_AUTO_RELOAD'] = True
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///server/db.sqlite3'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['CLIENT_PATH'] = app.root_path + '/client/'

config_json_path = Path("cycif_viewer/data") / "config.json"

db = SQLAlchemy(app)


def get_config_names():
    if not os.path.isdir(Path("cycif_viewer/data")):
        os.makedirs(Path("cycif_viewer/data"))

    if not os.path.isfile(config_json_path):
        with open(config_json_path, 'w') as f:
            json.dump({}, f)
            return []
    else:
        with open(config_json_path) as f:
            data = json.load(f)
            # Clean up any old paths in the config file
            for datasource in data:
                # Update Feature SRC
                data[datasource]['featureData'][0]['src'] = \
                    data[datasource]['featureData'][0]['src'].replace('static/data', 'cycif_viewer/data')
                # Update
                data[datasource]['segmentation'] = data[datasource]['segmentation'].replace('static/data',
                                                                                            'cycif_viewer/data')
                test = ''
            test = ''
        return [key for key in data.keys()]


from cycif_viewer.server.routes import page_routes, data_routes, import_routes
from cycif_viewer.server.models import data_model, database_model
