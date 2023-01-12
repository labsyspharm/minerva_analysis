from flask import render_template, send_from_directory, request, send_file

from minerva_analysis import app, get_config_names, get_config, config_json_path


@app.route("/")
def my_index():
    return render_template("index.html", data={'datasource': '', 'datasources': get_config_names(),
                                               'is_docker': app.config['IS_DOCKER']})


@app.route("/data/config.json", methods=['GET'])
def serve_config():
    return send_file(config_json_path.resolve(), attachment_filename='config.json')


@app.route('/<string:datasource>', methods=['GET'])
def image_viewer(datasource):
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

    return render_template('index.html',
                           data={'datasource': datasource, 'datasources': datasources,
                                 'applyPrevious': apply_previous, 'mode': mode, 'config': config,
                                 'is_docker': app.config['IS_DOCKER']})


@app.route('/compare_neighborhoods/<string:datasource>')
def compare_neighborhoods(datasource):
    datasources = get_config_names()
    if datasource not in datasources:
        datasource = ''

    return render_template('compare_neighborhoods.html', data={'datasource': datasource, 'datasources': datasources,
                                                               'is_docker': app.config['IS_DOCKER']})


@app.route("/upload_page")
def upload_page():
    return render_template("upload.html", data={'datasource': '', 'datasources': get_config_names(),
                                                'is_docker': app.config['IS_DOCKER']})


@app.route('/client/<path:filename>')
def serveClient(filename):
    return send_from_directory(app.config['CLIENT_PATH'], filename, conditional=True)


@app.route('/static/<path:filename>')
def rerouteStatic(filename):
    test = ''
