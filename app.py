from flask import Flask, render_template, request, Response, jsonify, abort
from server import mostFrequentLongestSubstring, fullConversion, pre_normalization, dataFilter
import os
import csv
from pathlib import Path
from waitress import serve
import shutil

from time import time
from scipy.spatial import cKDTree
import numpy as np
import pandas as pd
import json
import orjson

app = Flask(__name__)

config_json_path = Path("static/data") / "config.json"


@app.route("/")
def my_index():
    return render_template("index.html", data={'datasource': '', 'datasources': get_config_names()})


@app.route('/<string:datasource>')
def image_viewer(datasource):
    datasources = get_config_names()
    if datasource not in datasources:
        datasource = ''
    # if datasource != '':
    #     test = load_database(datasource)
    return render_template('index.html', data={'datasource': datasource, 'datasources': datasources})


def get_config_names():
    if not os.path.isdir(Path("static/data")):
        os.makedirs(Path("static/data"))

    if not os.path.isfile(config_json_path):
        with open(config_json_path, 'w') as f:
            json.dump({}, f)
            return []
    else:
        with open(config_json_path) as f:
            data = json.load(f)
        return [key for key in data.keys()]


@app.route("/upload_page")
def upload_page():
    return render_template("upload.html", data={'datasource': '', 'datasources': get_config_names()})


# Import / Upload Methods from Facetto
total_tasks = 100
completed_task = 0
current_task = ''


@app.route('/edit_config', methods=['GET'])
def edit_config_with_request_object():
    config_name = request.args.get("config")
    return edit_config_with_config_name(config_name)


@app.route('/edit_config/<string:config_name>')
def edit_config_with_request_name(config_name):
    return edit_config_with_config_name(config_name)


@app.route('/delete/<string:config_name>')
def delete_with_datasource_name(config_name):
    global config_json_path

    path = str(Path('static/data') / config_name)
    if os.path.exists(path):
        shutil.rmtree(path)
    with open(config_json_path, "r+") as configJson:
        config_data = json.load(configJson)
        del config_data[config_name]
        configJson.seek(0)  # <--- should reset file position to the beginning.
        json.dump(config_data, configJson, indent=4)
        configJson.truncate()
    return render_template("index.html", data={'datasource': '', 'datasources': get_config_names()})


def edit_config_with_config_name(config_name):
    data = {}
    global config_json_path
    with open(config_json_path, "r+") as configJson:
        config_csv = json.load(configJson)
        config_data = config_csv[config_name]
        data['datasetName'] = config_name
        # test_data['channelFileNames'] = ['channel_01', 'channel_02']
        data['normCsvName'] = config_data['clusterData']
        data['csvName'] = config_data['featureData'][0]['src'].split("/")[-1]

        if 'shapes' in config_data:
            data['shapes'] = config_data['shapes']

        if 'activeChannel' in config_data:
            data['activeChannel'] = config_data['activeChannel']

        if 'normalization' in config_data['featureData'][0]:
            data['normalization'] = config_data['featureData'][0]['normalization']

        csvHeaders = []
        channelFileNames = []
        if 'idField' in config_data['featureData'][0]:
            data['idField'] = True
            elem = {}
            elem['fullName'] = config_data['featureData'][0]['idField']
            elem['displayName'] = config_data['featureData'][0]['idField']
            csvHeaders.append(elem)
            channelFileNames = ['ID']
        else:
            data['idField'] = False;
        # add x cord
        elem = {}
        elem['fullName'] = config_data['featureData'][0]['xCoordinate']
        elem['displayName'] = config_data['featureData'][0]['xCoordinate']
        csvHeaders.append(elem)
        # add y cord
        elem = {}
        elem['fullName'] = config_data['featureData'][0]['yCoordinate']
        elem['displayName'] = config_data['featureData'][0]['yCoordinate']
        csvHeaders.append(elem)
        # Start with the required channels
        channelFileNames.extend(['Area', 'X Position', 'Y Position'])

        for i in range(len(config_data['imageData'])):
            elem = config_data['imageData'][i]
            channelName = elem['src'].split("/")[-1].replace('.dzi', '')
            header = {}
            header['fullName'] = elem['fullname']
            header['displayName'] = elem['name']
            # Special handling for label channel
            if i == 0:
                data['labelName'] = channelName
                if data['idField']:
                    csvHeaders.insert(1, header)
                else:
                    csvHeaders.insert(0, header)
            else:
                channelFileNames.append(channelName)
                csvHeaders.append(header)

        data['csvHeader'] = csvHeaders
        header_full_names = [elem['displayName'] for elem in csvHeaders]
        data['substring'] = mostFrequentLongestSubstring.find_substring(header_full_names)
        data['channelFileNames'] = channelFileNames
        data['datasources'] = [key for key in config_csv.keys()]
        return render_template('channel_match.html', data=data)


@app.route('/upload', methods=['GET', 'POST'])
def upload_file_page():
    global total_tasks
    global completed_task
    global current_task
    total_tasks = 1
    completed_task = 0
    current_task = "Uploading"
    datasetName = None
    csvName = ''
    channelFileNames = ['ID', 'Area', 'X Position', 'Y Position']
    labelName = ''
    csvHeader = None
    if request.method == 'POST':
        try:
            if request.form['action'] == 'Upload':
                if request.form.get('name') is None or not request.form.get('name'):
                    raise Exception("Please Name Dataset")
                else:
                    datasetName = request.form['name']
                    file_path = str(Path(os.path.join(os.getcwd())) / "static" / "data" / datasetName)
                    if not os.path.exists(file_path):
                        os.makedirs(file_path)

                    csvFile = request.files.getlist("csv_file")
                    if len(csvFile) > 1:
                        raise Exception("Please only Upload Only 1 CSV")
                    elif len(csvFile) == 0:
                        raise Exception("Please Upload a CSV")

                    labelFile = request.files.getlist("label_file")
                    if len(labelFile) > 1:
                        raise Exception("Please only Upload Only 1 Label File")

                    channel_files = request.files.getlist("channel_files")
                    if len(channel_files) == 0:
                        raise Exception("Please Upload a Channel File")

                    total_tasks = len(labelFile) + len(channel_files)
                    # Process CSV
                    for file in csvFile:
                        # Upload CSV
                        csvName = file.filename
                        csvPath = str(Path(file_path) / csvName)
                        file.save(csvPath)
                        with open(csvPath, 'r') as infile:
                            reader = csv.DictReader(infile)
                            csvHeader = reader.fieldnames

                    #  Process Label
                    for file in labelFile:
                        # Upload Label
                        name, ext = os.path.splitext(file.filename)
                        path_str = str(Path(file_path) / file.filename)
                        file.save(path_str)
                        # Converting Label
                        current_task = "Converting Label File"
                        fullConversion.convertChannel(path_str, True)
                        os.remove(path_str)  # remove the raw file after converting it
                        labelName = name
                        completed_task += 1

                    # Process Channel Files
                    channel_files = request.files.getlist("channel_files")
                    if len(channel_files) == 0:
                        raise Exception("Please Upload a Channel File")
                    if any('.ome' in file.filename for file in channel_files) or len(channel_files) == 1 :
                        if len(channel_files) > 1:
                            raise Exception("Please Only Upload One Channel .ome.tif ")
                        else:
                            path_str = str(Path(file_path) / channel_files[0].filename)
                            channel_files[0].save(path_str)
                            current_task = "Converting OME-TIFF Channels (This Will Take a While)"
                            channelFileNames.extend(fullConversion.convertOmeTiff(file_path, channel_files[0].filename,
                                                                                  False))
                            os.remove(path_str)  # remove the raw file after converting it
                            completed_task += 1
                    else:
                        for file_number in range(len(channel_files)):
                            file = channel_files[file_number]
                            path_str = str(Path(file_path) / file.filename)
                            file.save(path_str)
                            os.remove(path_str)  # remove the raw file after converting it
                            current_task = "Converting Channel 1 of " + str(len(channel_files))
                            fullConversion.convertChannel(path_str, False)
                            name, ext = os.path.splitext(file.filename)
                            channelFileNames.append(name)
                            completed_task += 1
                    current_task = total_tasks
                    current_task = 'Complete'
                    config_data = {}
                    full_csv_header = []
                    for header in csvHeader:
                        elem = {}
                        elem['fullName'] = header
                        full_csv_header.append(elem)
                    # (full_csv_header, channelFileNames) = fuzzyColumnMatch.fuzzyColumnMatch(full_csv_header,
                    #                                                                         channelFileNames)
                    config_data['csvHeader'] = full_csv_header
                    header_full_names = [elem['fullName'] for elem in full_csv_header]
                    config_data['substring'] = mostFrequentLongestSubstring.find_substring(header_full_names)
                    config_data['datasetName'] = datasetName
                    config_data['channelFileNames'] = channelFileNames
                    config_data['csvName'] = csvName
                    config_data['labelName'] = labelName
                    config_data['datasources'] = get_config_names()
                    config_data['datasources'].append(datasetName)
                    return render_template('channel_match.html', data=config_data)
        except Exception as e:
            completed_task = -1
            current_task = str(e)
            return render_template('index.html')
            # Now Edit Config.Json With my my Data
    print("Finished Updating Config.json")
    return render_template('index.html')


@app.route('/progress')
def progress():
    def generate():
        global total_tasks
        global completed_task
        global current_task
        data = {}
        # Error Handling
        if current_task == -1:
            data['percentage'] = -1
            data['currentTask'] = current_task
        else:
            if total_tasks == 0:
                total_tasks = 100
            percentage = int((completed_task / total_tasks) * 100)
            data['percentage'] = percentage
            data['currentTask'] = current_task
        print("Percentage:", percentage, completed_task, total_tasks, current_task)
        yield "data:" + json.dumps(data) + "\n\n"

    return Response(generate(), mimetype='text/event-stream')


# Matches channels to CSV Headers
@app.route('/channel-test')
def channel():
    test_data = {}
    test_data['csvHeader'] = ['A488_background_none_1Nuclei', 'A555_background_none_2Nuclei', 'A555_Alexa555_18Nuclei',
                              'A647_background_none_3Nuclei', 'CATENIN_Alexa647_19Nuclei', 'CD3_Alexa555_10Nuclei',
                              'CD45RO_Alexa488_13Nuclei', 'CD45_Alexa555_30Nuclei', 'CD4_Alexa488_9Nuclei',
                              'CD8_Alexa647_11Nuclei', 'DNA2_Hoechst33342_4Nuclei', 'DNA3_Hoechst33342_8Nuclei',
                              'DNA4_Hoechst33342_12Nuclei', 'DNA5_Hoechst33342_16Nuclei', 'DNA6_Hoechst33342_20Nuclei',
                              'DNA7_Hoechst33342_24Nuclei', 'DNA8_Hoechst33342_28Nuclei', 'DNA9_Hoechst33342_32Nuclei',
                              'DNA_Hoechst33342_0Nuclei', 'ECAD_Alexa488_17Nuclei', 'FOXP3_Alexa555_14Nuclei',
                              'HES1_Alexa647_27Nuclei', 'KERATIN_Alexa555_26Nuclei', 'KI67_Alexa488_5Nuclei',
                              'MITF_Alexa488_25Nuclei', 'NGFR_Alexa647_23Nuclei', 'PD1_Alexa647_15Nuclei',
                              'PDL1_Alexa647_7Nuclei', 'S100_Alexa488_33Nuclei', 'SMA_Alexa647_35Nuclei',
                              'VEGFR2_Alexa555_34Nuclei', 'VIMENTIN_Alexa555_6Nuclei', 'cJUN_Alexa488_21Nuclei',
                              'pERKz_Alexa647_31Nuclei', 'pRB_Alexa555_22Nuclei', 'pS6_Alexa488_29Nuclei',
                              'NucleusArea', 'CellPosition_X', 'CellPosition_Y']
    test_data['datasetName'] = 'channelConfigs'
    test_data['substring'] = mostFrequentLongestSubstring.find_substring(test_data['csvHeader'])
    test_data['channelFileNames'] = ['ID', 'Area', 'X Position', 'Y Position', 'channel_01', 'channel_02']
    test_data['normCsvName'] = 'segResultsRF_norm.csv'
    test_data['csvName'] = 'segResultsRF.csv'
    test_data['labelName'] = 'nucleiLabelRF'
    test_data['datasources'] = get_config_names()

    return render_template('channel_match.html', data=test_data)


@app.route('/save_config', methods=['POST'])
def save_config():
    global config_json_path
    try:
        originalData = request.json['originalData']
        datasetName = originalData['datasetName']
        csvName = originalData['csvName']
        headerList = request.json['headerList']
        normalizeCsv = request.json['normalizeCsv']
        if normalizeCsv:
            print("Normalizing CSV")
            skip_columns = []
            for i in range(int(len(headerList) / 3)):
                column_name = headerList[i * 3]['value']
                normalize_column = headerList[i * 3 + 2]['value']
                if normalize_column != 'on':
                    skip_columns.append(column_name)
            name, ext = os.path.splitext(csvName)
            normCsvName = "{name}_norm{ext}".format(name=name, ext=ext)
            file_path = str(Path(os.path.join(os.getcwd())) / "static" / "data" / datasetName)
            csvPath = str(Path(file_path) / csvName)
            normPath = str(Path(file_path) / normCsvName)
            pre_normalization.preNormalize(csvPath, normPath, skip_columns=skip_columns)
            print("Finished Normalizing CSV")
        elif 'normalizeCsvName' in request.json:
            normCsvName = request.json['normalizeCsvName']

        headerList = [x for x in zip(headerList[1::3], headerList[0::3])]
        channelList = originalData['channelFileNames']
        with open(config_json_path, "r+") as configJson:
            configData = json.load(configJson)
            configData[datasetName] = {}
            configData[datasetName]['shapes'] = ''
            configData[datasetName]['clusterData'] = normCsvName
            configData[datasetName]['activeChannel'] = ''
            configData[datasetName]['featureData'] = [{}]
            configData[datasetName]['featureData'][0]['normalization'] = 'none'
            configData[datasetName]['featureData'][0]['xCoordinate'] = headerList[1][1]['value']
            configData[datasetName]['featureData'][0]['yCoordinate'] = headerList[2][1]['value']

            # If optional id field
            if 'idField' in request.json:
                channelList.pop(0)
                configData[datasetName]['featureData'][0]['idField'] = request.json['idField'][1]['value']

            if 'shapes' in originalData:
                configData[datasetName]['shapes'] = originalData['shapes']

            if 'activeChannel' in originalData:
                configData[datasetName]['activeChannel'] = originalData['activeChannel']

            if 'normalization' in originalData:
                configData[datasetName]['featureData'][0]['normalization'] = originalData['normalization']

            configData[datasetName]['featureData'][0]['src'] = "/static/data/" + datasetName + "/" + csvName
            # Adding the Label Channel as the First Label
            configData[datasetName]['imageData'] = [{}]
            #
            configData[datasetName]['imageData'][0]['name'] = headerList[0][1]['value']
            configData[datasetName]['imageData'][0]['fullname'] = 'Area'
            if 'labelName' in originalData and originalData['labelName'] != '':
                configData[datasetName]['imageData'][0]['src'] = "/static/data/" + datasetName + "/" + originalData[
                    'labelName'] + ".dzi"
            else:
                configData[datasetName]['imageData'][0]['src'] = ''
            channelList = channelList[3:]
            for i in range(len(channelList)):
                channel = channelList[i]
                channelData = {}
                channelData['src'] = "/static/data/" + datasetName + "/" + channel + ".dzi"
                channelData['name'] = headerList[i + 3][0]['value']
                channelData['fullname'] = headerList[i + 3][1]['value']
                configData[datasetName]['imageData'].append(channelData)
            configJson.seek(0)  # <--- should reset file position to the beginning.
            json.dump(configData, configJson, indent=4)
            configJson.truncate()
            dataFilter.load_db(datasetName, reload=True)
            resp = jsonify(success=True)
            return resp

    except Exception as e:
        resp = jsonify(success=False)
        return resp


# End of Facetto code

@app.route('/init_database', methods=['GET'])
def init_database():
    datasource = request.args.get('datasource')
    dataFilter.init(datasource)
    resp = jsonify(success=True)
    return resp


@app.route('/get_nearest_cell', methods=['GET'])
def get_nearest_cell():
    x = float(request.args.get('point_x'))
    y = float(request.args.get('point_y'))
    datasource = request.args.get('datasource')
    resp = dataFilter.query_for_closest_cell(x, y, datasource)
    return serialize_and_submit_json(resp)


# Gets a row based on the index
@app.route('/get_database_row', methods=['GET'])
def get_database_row():
    datasource = request.args.get('datasource')
    row = int(request.args.get('row'))
    resp = dataFilter.get_row(row, datasource)
    return serialize_and_submit_json(resp)


@app.route('/get_channel_names', methods=['GET'])
def get_channel_names():
    datasource = request.args.get('datasource')
    shortnames = bool(request.args.get('shortNames'))
    resp = dataFilter.get_channel_names(datasource, shortnames)
    return serialize_and_submit_json(resp)


@app.route('/get_phenotypes', methods=['GET'])
def get_phenotypes():
    datasource = request.args.get('datasource')
    resp = dataFilter.get_phenotypes(datasource)
    return serialize_and_submit_json(resp)


@app.route('/get_color_scheme', methods=['GET'])
def get_color_scheme():
    datasource = request.args.get('datasource')
    refresh = request.args.get('refresh') == 'true'
    resp = dataFilter.get_color_scheme(datasource, refresh)
    return serialize_and_submit_json(resp)


@app.route('/get_neighborhood', methods=['GET'])
def get_neighborhood():
    x = float(request.args.get('point_x'))
    y = float(request.args.get('point_y'))
    max_distance = float(request.args.get('max_distance'))
    datasource = request.args.get('datasource')
    resp = dataFilter.get_neighborhood(x, y, datasource, r=max_distance)
    return serialize_and_submit_json(resp)


@app.route('/get_num_cells_in_circle', methods=['GET'])
def get_num_cells_in_circle():
    datasource = request.args.get('datasource')
    x = float(request.args.get('point_x'))
    y = float(request.args.get('point_y'))
    r = float(request.args.get('radius'))
    resp = dataFilter.get_number_of_cells_in_circle(x, y, datasource, r=r)
    return serialize_and_submit_json(resp)


@app.route('/get_gated_cell_ids', methods=['GET'])
def get_gated_cell_ids():
    datasource = request.args.get('datasource')
    filter = json.loads(request.args.get('filter'))
    resp = dataFilter.get_gated_cells(datasource, filter)
    return serialize_and_submit_json(resp)


@app.route('/get_database_description', methods=['GET'])
def get_database_description():
    datasource = request.args.get('datasource')
    resp = dataFilter.get_database_description(datasource)
    return serialize_and_submit_json(resp)


@app.route('/upload_gates', methods=['POST'])
def upload_gates():
    file = request.files['file']
    if file.filename.endswith('.csv') == False:
        abort(422)
    datasource = request.form['datasource']
    save_path = Path(os.path.join(os.getcwd())) / "static" / "data" / datasource
    if save_path.is_dir() == False:
        abort(422)

    filename = 'uploaded_gates.csv'
    file.save(Path(save_path / filename))
    resp = jsonify(success=True)
    return resp


@app.route('/get_rect_cells', methods=['GET'])
def get_rect_cells():
    # Parse (rect - [x, y, r], channels [string])
    datasource = request.args.get('datasource')
    rect = [float(x) for x in request.args.get('rect').split(',')]
    channels = request.args.get('channels')

    # Retrieve cells - FIXME: Too slow - jam is stalling image loading
    resp = dataFilter.get_rect_cells(datasource, rect, channels)
    print('Neighborhood size:', len(resp))
    return serialize_and_submit_json(resp)


@app.route('/download_gating_csv', methods=['POST'])
def download_gating_csv():
    datasource = request.form['datasource']
    filter = json.loads(request.form['filter'])
    channels = json.loads(request.form['channels'])
    fullCsv = json.loads(request.form['fullCsv'])
    if fullCsv:
        csv = dataFilter.download_gating_csv(datasource, filter, channels)
    else:
        csv = dataFilter.download_gates(datasource, filter, channels)
    return Response(
        csv.to_csv(index=False),
        mimetype="text/csv",
        headers={"Content-disposition":
                     "attachment; filename=gating_csv.csv"})


@app.route('/get_uploaded_gating_csv_values', methods=['GET'])
def get_gating_csv_values():
    datasource = request.args.get('datasource')
    file_path = Path(os.path.join(os.getcwd())) / "static" / "data" / datasource / 'uploaded_gates.csv'
    if file_path.is_file() == False:
        abort(422)
    csv = pd.read_csv(file_path)
    obj = csv.to_dict(orient='records')
    return serialize_and_submit_json(obj)


def serialize_and_submit_json(data):
    response = app.response_class(
        response=orjson.dumps(data, option=orjson.OPT_SERIALIZE_NUMPY),
        mimetype='application/json'
    )
    return response


if __name__ == "__main__":
    app.config['TEMPLATES_AUTO_RELOAD'] = True
    # 100 GB file Max
    serve(app, host='0.0.0.0', port=8000, max_request_body_size=107374182400)
