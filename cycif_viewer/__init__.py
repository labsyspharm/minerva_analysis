from flask import Flask
from pathlib import Path
from flask_sqlalchemy import SQLAlchemy

import os
import json

app = Flask(__name__)
app.config['TEMPLATES_AUTO_RELOAD'] = True
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///db.sqlite3'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

config_json_path = Path("cycif_viewer/static/data") / "config.json"

db = SQLAlchemy(app)


def get_config_names():
    if not os.path.isdir(Path("cycif_viewer/static/data")):
        os.makedirs(Path("cycif_viewer/static/data"))

    if not os.path.isfile(config_json_path):
        with open(config_json_path, 'w') as f:
            json.dump({}, f)
            return []
    else:
        with open(config_json_path) as f:
            data = json.load(f)
        return [key for key in data.keys()]


from cycif_viewer.views import pages, data_view, source
from cycif_viewer.models import data_model, database
