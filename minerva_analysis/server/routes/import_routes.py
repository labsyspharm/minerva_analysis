# CRUD for Datasources

from minerva_analysis import app, get_config_names, config_json_path, data_path, cwd_path
from minerva_analysis.server.utils import mostFrequentLongestSubstring, pre_normalization
from minerva_analysis.server.models import data_model

from flask import render_template, request, Response, jsonify
from pathlib import Path
from pathlib import PurePath

import numpy as np
import pandas as pd
import shutil
import csv
import json
import os

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

    path = str(data_path / config_name)
    if Path(path).exists():
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
        data['csvName'] = config_data['featureData'][0]['src'].split("/")[-1]
        if 'celltypeData' in config_data['featureData'][0]:
            data['celltypeData'] = config_data['featureData'][0]['celltypeData']

        if 'shapes' in config_data:
            data['shapes'] = config_data['shapes']

        if 'activeChannel' in config_data:
            data['activeChannel'] = config_data['activeChannel']

        if 'normalization' in config_data['featureData'][0]:
            data['normalization'] = config_data['featureData'][0]['normalization']

        if 'isTransformed' in config_data['featureData'][0]:
            data['isTransformed'] = config_data['featureData'][0]['isTransformed']

        if 'clusterData' in config_data:
            data['normCsvName'] = config_data['clusterData']

        if 'maxLevel' in config_data:
            data['maxLevel'] = config_data['maxLevel']
        if 'height' in config_data:
            data['height'] = config_data['height']

        if 'width' in config_data:
            data['width'] = config_data['width']

        if 'segmentation' in config_data:
            data['segmentation'] = config_data['segmentation']

        if 'channelFile' in config_data:
            data['channelFile'] = config_data['channelFile']

        if 'num_channels' in config_data:
            data['num_channels'] = config_data['num_channels']

        if 'tileHeight' in config_data:
            data['tileHeight'] = config_data['tileHeight']

        if 'tileWidth' in config_data:
            data['tileWidth'] = config_data['tileWidth']

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
        # add cell type
        if 'celltypeData' in config_data['featureData'][0]:
            elem = {}
            elem['fullName'] = config_data['featureData'][0]['celltype']
            elem['displayName'] = config_data['featureData'][0]['celltype']
            csvHeaders.append(elem)

        # Start with the required channels
        if 'celltypeData' in config_data['featureData'][0]:
            channelFileNames.extend(['Area', 'X Position', 'Y Position', 'Cell Type'])
        else:
            channelFileNames.extend(['Area', 'X Position', 'Y Position'])

        for i in range(len(config_data['imageData'])):
            elem = config_data['imageData'][i]
            channelName = elem['src'].split("/")[-2]
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
    celltypeName = ''
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
                    file_path = str(PurePath(Path.cwd(), data_path, datasetName))
                    if not Path(file_path).exists():
                        Path(file_path).mkdir()

                    csvFile = request.files.getlist("csv_file")
                    if len(csvFile) > 1:
                        raise Exception("Please only Upload Only 1 CSV")
                    elif len(csvFile) == 0:
                        raise Exception("Please Upload a CSV")

                    celltypeFile = request.files.getlist("celltype_file")
                    if len(celltypeFile) > 1:
                        raise Exception("Please only Upload Only 1 Cell Type File")
                    elif len(celltypeFile) == 1:
                        channelFileNames.extend(['Cell Type'])

                    labelFile = request.form.get('label_file')
                    if labelFile.startswith('"'):
                        labelFile = labelFile[1:]
                    if labelFile.endswith('"'):
                        labelFile = labelFile[:-1]
                    labelFile = Path(labelFile)

                    labelName = os.path.splitext(labelFile.name)[0]

                    channelFile = request.form.get('channel_file')
                    if channelFile.startswith('"'):
                        channelFile = channelFile[1:]
                    if channelFile.endswith('"'):
                        channelFile = channelFile[:-1]
                    channelFile = Path(channelFile)

                    total_tasks = 2
                    # Process CSV
                    for file in csvFile:
                        # Upload CSV
                        csvName = file.filename
                        csvPath = str(Path(file_path) / csvName)
                        file.save(csvPath)
                        with open(csvPath, 'r') as infile:
                            reader = csv.DictReader(infile)
                            csvHeader = reader.fieldnames

                    # Process Cell Type File
                    if len(celltypeFile) == 1 and celltypeFile[0].filename != '':
                        for file in celltypeFile:
                            # Upload Cell Type File
                            celltypeName = file.filename
                            celltypePath = str(Path(file_path) / celltypeName)
                            file.save(celltypePath)

                    # Process Channel File

                    current_task = "Converting OME-TIFF Channels (This Will Take a While)"
                    channel_info = data_model.convertOmeTiff(channelFile, isLabelImg=False)
                    channelFileNames.extend(channel_info['channel_names'])
                    completed_task += 1

                    current_task = "Converting Segmentation Mask"
                    label_info = data_model.convertOmeTiff(labelFile, channelFilePath=channelFile,
                                                           dataDirectory=file_path,
                                                           isLabelImg=True)
                    completed_task += 1

                    current_task = total_tasks
                    current_task = 'Complete'
                    config_data = {}
                    full_csv_header = []
                    for header in csvHeader:
                        elem = {}
                        elem['fullName'] = header
                        full_csv_header.append(elem)

                    config_data['csvHeader'] = full_csv_header
                    header_full_names = [elem['fullName'] for elem in full_csv_header]
                    config_data['substring'] = mostFrequentLongestSubstring.find_substring(header_full_names)
                    config_data['datasetName'] = datasetName

                    config_data['maxLevel'] = channel_info['maxLevel']
                    config_data['height'] = channel_info['height']
                    config_data['width'] = channel_info['width']
                    config_data['segmentation'] = label_info['segmentation']

                    config_data['num_channels'] = channel_info['num_channels']
                    config_data['tileHeight'] = channel_info['tileHeight']
                    config_data['tileWidth'] = channel_info['tileWidth']

                    config_data['datasetName'] = datasetName
                    config_data['channelFileNames'] = channelFileNames
                    config_data['csvName'] = csvName
                    if len(celltypeFile) == 1:
                        config_data['celltypeData'] = celltypeName
                    config_data['channelFile'] = str(channelFile)
                    config_data['new'] = True
                    config_data['labelName'] = labelName
                    config_data['datasources'] = get_config_names()
                    config_data['datasources'].append(datasetName)

                    datasource = pd.read_csv(csvPath)
                    listNotMarkers = ['CellID', 'X_centroid', 'Y_centroid', 'Area', 'MajorAxisLength', 'MinorAxisLength', 'Eccentricity', 'Solidity', 'Extent', 'Orientation', 'column_centroid', 'row_centroid', 'phenotype']
                    listImageData = [name for name in header_full_names if name not in listNotMarkers]
                    datasourceImageData = datasource[[*listImageData]]
                    if np.mean(np.mean(datasourceImageData)) < 15:
                        config_data["isTransformed"] = True
                    else:
                        config_data["isTransformed"] = False

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


@app.route('/save_config', methods=['POST'])
def save_config():
    global config_json_path
    try:
        originalData = request.json['originalData']
        datasetName = originalData['datasetName']
        csvName = originalData['csvName']
        if 'celltypeData' in originalData:
            celltypeName = originalData['celltypeData']
        idList = request.json['idField']
        headerList = request.json['headerList']

        isTransformed = originalData['isTransformed']
        transformData = request.json['transformData']
        if not isTransformed and transformData:
            print("Transforming Data")
            skip_columns = []
            if idList[2]['value'] != 'on':
                skip_columns.append(idList[0]['value'])
            for i in range(int(len(headerList) / 3)):
                column_name = headerList[i * 3]['value']
                normalize_column = headerList[i * 3 + 2]['value']
                if normalize_column != 'on':
                    skip_columns.append(column_name)
            file_path = str(Path(cwd_path, data_path, datasetName))
            csvPath = str(Path(file_path) / csvName)
            # pre_normalization.preNormalize(csvPath, normPath, skip_columns=skip_columns)
            data_model.logTransform(csvPath, skip_columns=skip_columns)
            print("Finished Transforming Data")
        # elif 'normalizeCsvName' in request.json:
        #     normCsvName = request.json['normalizeCsvName']
        # else:
        #     normCsvName = None
        if 'normalizeCsvName' in request.json:
            normCsvName = request.json['normalizeCsvName']
        else:
            normCsvName = None

        headerList = [x for x in zip(headerList[1::3], headerList[0::3])]
        channelList = originalData['channelFileNames']
        with open(config_json_path, "r+") as configJson:
            configData = json.load(configJson)
            configData[datasetName] = {}
            configData[datasetName]['shapes'] = ''
            if normCsvName:
                configData[datasetName]['clusterData'] = normCsvName
            configData[datasetName]['activeChannel'] = ''
            configData[datasetName]['featureData'] = [{}]
            configData[datasetName]['featureData'][0]['normalization'] = 'none'
            if 'celltypeData' in originalData:
                configData[datasetName]['featureData'][0]['celltypeData'] = str(data_path / datasetName / celltypeName)
                configData[datasetName]['featureData'][0]['celltype'] = headerList[3][1]['value']
            configData[datasetName]['featureData'][0]['xCoordinate'] = headerList[1][1]['value']
            configData[datasetName]['featureData'][0]['yCoordinate'] = headerList[2][1]['value']

            # If optional id field
            if 'idField' in request.json:
                channelList.pop(0)
                configData[datasetName]['featureData'][0]['idField'] = request.json['idField'][1]['value']

            if 'shapes' in originalData:
                configData[datasetName]['shapes'] = originalData['shapes']

            if 'height' in originalData:
                configData[datasetName]['height'] = originalData['height']

            if 'width' in originalData:
                configData[datasetName]['width'] = originalData['width']

            if 'maxLevel' in originalData:
                configData[datasetName]['maxLevel'] = originalData['maxLevel']

            if 'num_channels' in originalData:
                configData[datasetName]['num_channels'] = originalData['num_channels']

            if 'tileWidth' in originalData:
                configData[datasetName]['tileWidth'] = originalData['tileWidth']

            if 'tileHeight' in originalData:
                configData[datasetName]['tileHeight'] = originalData['tileHeight']

            if 'segmentation' in originalData:
                configData[datasetName]['segmentation'] = originalData['segmentation']

            if 'channelFile' in originalData:
                configData[datasetName]['channelFile'] = originalData['channelFile']

            if 'activeChannel' in originalData:
                configData[datasetName]['activeChannel'] = originalData['activeChannel']

            if 'normalization' in originalData:
                configData[datasetName]['featureData'][0]['normalization'] = originalData['normalization']

            if isTransformed or transformData:
                configData[datasetName]['featureData'][0]['isTransformed'] = True
            else:
                configData[datasetName]['featureData'][0]['isTransformed'] = False

            configData[datasetName]['featureData'][0][
                'src'] = str(data_path / datasetName / csvName)
            # Adding the Label Channel as the First Label
            configData[datasetName]['imageData'] = [{}]
            #
            configData[datasetName]['imageData'][0]['name'] = headerList[0][1]['value']
            configData[datasetName]['imageData'][0]['fullname'] = 'Area'
            if 'labelName' in originalData and originalData['labelName'] != '':
                configData[datasetName]['imageData'][0]['src'] = "/generated/data/" + datasetName + "/" + originalData[
                    'labelName'] + "/"
            else:
                configData[datasetName]['imageData'][0]['src'] = ''

            if 'celltypeData' in originalData:
                channelList = channelList[4:]
            else:
                channelList = channelList[3:]

            if 'celltypeData' in originalData:
                channelStart = 4
            else:
                channelStart = 3
            for i in range(len(channelList)):
                channel = channelList[i]
                channelData = {}
                channelData['src'] = "/generated/data/" + datasetName + "/" + channel + "/"
                channelData['name'] = headerList[i + channelStart][0]['value']
                channelData['fullname'] = headerList[i + channelStart][1]['value']
                configData[datasetName]['imageData'].append(channelData)
            configJson.seek(0)  # <--- should reset file position to the beginning.
            json.dump(configData, configJson, indent=4)
            configJson.truncate()
            data_model.load_datasource(datasetName, reload=True)
            resp = jsonify(success=True)
            return resp

    except Exception as e:
        resp = jsonify(success=False)
        return resp
