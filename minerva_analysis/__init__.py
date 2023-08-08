from flask import Flask
from pathlib import Path
from flask_sqlalchemy import SQLAlchemy
from appdirs import user_data_dir

from numcodecs import compat_ext  # Needed for pyinstaller
from numcodecs import blosc  # Needed for pyinstaller
import xmlschema  # Needed for pyinstaller

import os
import json
import sys
import multiprocessing

# Initialize sklearn global threadpool controller to avoid deadlock in threaded
# contexts.
import sklearn.utils.fixes
sklearn.utils.fixes.threadpool_limits()

# If you're running the pyinstaller version of the code, create a
# new directory for the data (this will be at ~/ on mac)

#centralizing path across app
cwd_path = Path.cwd()

## uncomment block if not on O2
if getattr(sys, 'frozen', False):
    data_path = Path(Path(sys.executable).parent / 'data')
    multiprocessing.freeze_support()
else:
    data_path = Path("minerva_analysis/data").resolve()

## uncomment block if on O2
# appname = "minerva_analysis"
# appauthor = "lsp"
# data_path = Path(user_data_dir(appname, appauthor)+'/data').resolve()
# if getattr(sys, 'frozen', False):
#     multiprocessing.freeze_support()

# print('Data Path', str(data_path), str((data_path).resolve()))
# Make the Data Path
data_path.mkdir(parents=True, exist_ok=True)
app = Flask(__name__, template_folder=Path('client/templates'), static_folder='data')
app.config['TEMPLATES_AUTO_RELOAD'] = True
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///' + str(data_path) + '/db.sqlite3'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['CLIENT_PATH'] = app.root_path + '/client/'
config_json_path = data_path / "config.json"
db = SQLAlchemy(app)


def get_config():
    if not Path.is_dir(data_path):
        Path.mkdir(data_path)

    if not Path.is_file(config_json_path):
        with open(config_json_path, 'w') as f:
            json.dump({}, f)
            return []
    else:
        with open(config_json_path, 'r+') as f:
            data = json.load(f)
    return data


def get_config_names():
    data = get_config()
    try:
        return [key for key in data.keys()]
    except AttributeError:
        return []


from minerva_analysis.server.routes import page_routes, data_routes, import_routes
from minerva_analysis.server.models import data_model, database_model
