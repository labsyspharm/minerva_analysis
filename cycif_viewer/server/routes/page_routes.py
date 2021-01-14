from cycif_viewer import app, get_config_names
from flask import render_template, send_from_directory

@app.route("/")
def my_index():
    return render_template("index.html", data={'datasource': '', 'datasources': get_config_names()})


@app.route('/config')
def get_config():
    if not os.path.isdir(Path("data")):
        os.makedirs(Path("data"))
    if not os.path.isfile(config_json_path):
        with open(config_json_path, 'w') as f:
            json.dump({}, f)
            return []
    with open('data/config.json') as f:
        data = json.load(f)
    return data;

@app.route('/<string:datasource>')
def image_viewer(datasource):
    datasources = get_config_names()
    if datasource not in datasources:
        datasource = ''
    # if datasource != '':
    #     test = load_database(datasource)
    return render_template('index.html', data={'datasource': datasource, 'datasources': datasources})


@app.route("/upload_page")
def upload_page():
    return render_template("upload.html", data={'datasource': '', 'datasources': get_config_names()})




@app.route('/client/<path:filename>')
def serveClient(filename):
    return send_from_directory(app.config['CLIENT_PATH'], filename, conditional=True)
