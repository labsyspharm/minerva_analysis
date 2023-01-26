# CRUD for Datasources

from minerva_analysis import app, get_config_names, config_json_path, data_path, cwd_path
from minerva_analysis.server.utils import mostFrequentLongestSubstring, pre_normalization
from minerva_analysis.server.models import data_model

from flask import render_template, request, Response, jsonify
from pathlib import Path
from pathlib import PurePath

import werkzeug.datastructures as wz
import numpy as np
import pandas as pd
import shutil
import csv
import json
import orjson
import os
from os import walk
import io

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
                # if we have a fully user specified data upload
                if request.form.get('mcmicro_name') is None:
                    #dataset name
                    datasetName = request.form['name']

                    #label file
                    labelFile = request.form.get('label_file')
                    labelFile = labelFile.replace('"', '') # remove " characters
                    labelFile = Path(labelFile)
                    labelName = os.path.splitext(labelFile.name)[0]

                    #csv file
                    csvPath = request.form.get('csv_file');
                    csvPath = csvPath.replace('"', '') # remove " characters
                    csvPath = Path(csvPath)
                    pathsSplit = PurePath(csvPath).parts
                    csvName = pathsSplit[len(pathsSplit) - 1]

                    #channel file
                    channelFile = request.form.get('channel_file')
                    channelFile = channelFile.replace('"', '') # remove " characters
                    channelFile = Path(channelFile)

                # if a mcmicro output structure is used
                else:
                    directory = request.form['mcmicro_output_folder']
                    pathsSplit = PurePath(directory).parts
                    mcmicroDirName = pathsSplit[len(pathsSplit)-1]

                    #dataset name is optional, if not provided mcmicro name is used
                    datasetName = mcmicroDirName
                    if request.form.get('mcmicro_name') != '':
                        datasetName = request.form['mcmicro_name']

                    # get label file from user specified path
                    labelName = request.form['masks']
                    labelFolder = str(PurePath('unmicst-' + mcmicroDirName, labelName + '.ome.tif'))
                    labelFile = PurePath(directory, 'segmentation', labelFolder)

                    # also check for older seg file format (.tif)
                    if not Path(directory, 'segmentation', labelFolder).is_file():
                        labelFolder = str(PurePath('unmicst-' + mcmicroDirName, labelName + '.tif'))
                        labelFile = PurePath(directory, 'segmentation', labelFolder)

                    # get csv file from user specified path
                    csvName = 'unmicst-' + mcmicroDirName + '_' + labelName + '.csv' # could use labelName to have dynamic csv but usually only cell available.
                    csvPath = str(PurePath(directory, 'quantification', csvName))

                    # get channel file from user specified path
                    channelFile = PurePath(directory, 'registration', mcmicroDirName + '.ome.tif')

                #further processing
                file_path = str(PurePath(Path.cwd(), data_path, datasetName))
                if not Path(file_path).exists():
                    Path(file_path).mkdir()
                total_tasks = 2


                # Process CSV File

                #open original csv location
                csvFile = [open(csvPath)]
                # file path to write to on server
                f = open(str(Path(file_path) / csvName), 'w')
                # write to new location on server
                f.write(csvFile[0].read())
                # read field names from new server location
                with open(csvPath, 'r') as infile:
                    reader = csv.DictReader(infile)
                    csvHeader = reader.fieldnames

                # Process Channel File
                current_task = "Converting OME-TIFF Channels (This Will Take a While)"
                channel_info = data_model.convertOmeTiff(channelFile, isLabelImg=False)
                channelFileNames.extend(channel_info['channel_names'])
                completed_task += 1

                #Process Segmentation File
                current_task = "Converting Segmentation Mask"
                label_info = data_model.convertOmeTiff(labelFile, channelFilePath=channelFile, dataDirectory=file_path, isLabelImg=True)
                completed_task += 1
                current_task = total_tasks
                current_task = 'Complete'
                config_data = {}
                full_csv_header = []

                # now iterate fields for the config overview
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
    test_data['new'] = True
    test_data['datasources'] = get_config_names()

    return render_template('channel_match.html', data=test_data)


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

@app.route('/get_mc_segmentation_file_list', methods=['POST'])
def list_tif_files_in_dir():
    # return all seg files found in the seg subfolder (mc micro specific)
    files = []

    #path and type information from upload
    post_data = json.loads(request.data)
    if 'path' in post_data:
        path = Path(post_data['path'], "segmentation");

        #for segmentation, mcmicro specifics
        mask_types = ["cell", "cellRing", "cyto", "cytoRing", "nuclei", "nucleiRing"]

        if path.is_dir():
            for (dirpath, dirnames, filenames) in walk(path):
                for (file) in filenames:
                    file = file.split('.')
                    if file[0] in mask_types:
                        files.append(file[0])
            print(files)
    else:
        print('error in segmentation path');
    return serialize_and_submit_json(files)

@app.route('/check_mc_csv_file_existence', methods=['POST'])
def check_mc_csv_file_existence():
    # path and type information from upload
    post_data = json.loads(request.data)
    if 'path' in post_data:
        if 'mask' in post_data:
            #get path and last bit which defines the dirname
            mask = post_data['mask']
            directory = Path(post_data['path'])
            pathsSplit = PurePath(directory).parts
            mcmicroDirName = pathsSplit[len(pathsSplit) - 1]

            # check if csv file exists
            csvName = 'unmicst-' + mcmicroDirName + '_' + mask + '.csv'
            csvPath = Path(directory, 'quantification', csvName)

            if csvPath.is_file():
                return serialize_and_submit_json(True)
    return serialize_and_submit_json(False)

@app.route('/check_mc_channel_file_existence', methods=['POST'])
def check_mc_channel_file_existence():
    # path and type information from upload
    post_data = json.loads(request.data)
    if 'path' in post_data:
            #get path and last bit which defines the dirname
            directory = Path(post_data['path'])
            try:
                pathsSplit = PurePath(directory).parts
                mcmicroDirName = pathsSplit[len(pathsSplit) - 1]

                # check if channel file exists
                channelFile = Path(directory, 'registration', mcmicroDirName + '.ome.tif')

                if channelFile.is_file():
                    return serialize_and_submit_json(True)
            except Exception as e:
                return serialize_and_submit_json(False)
    return serialize_and_submit_json(False)

@app.route('/check_file_existence', methods=['POST'])
def check_file_existence():
    # path and type information from upload
    post_data = json.loads(request.data)
    if 'path' in post_data:
        path = Path(post_data['path'])
        if path.is_file():
            return serialize_and_submit_json(True)
        return serialize_and_submit_json(False)

@app.route('/check_path_existence', methods=['POST'])
def check_path_existence():
    # path and type information from upload
    post_data = json.loads(request.data)
    if 'path' in post_data:
        path = Path(post_data['path'])
        # if full path exists
        if path.is_dir():
            return serialize_and_submit_json(True)
        # if path does not exist
        return serialize_and_submit_json(False)

@app.route('/dataset_existence', methods=['POST'])
def check_dataset_exists():
    # path and type information from upload
    post_data = json.loads(request.data)
    if 'dataset_name' in post_data:
        dataset_name = Path(post_data['dataset_name'])
        # if path exists as a relative path inside the data folder
        path = Path(Path.cwd(), data_path, dataset_name);
        if not path.is_dir() or dataset_name.name == '':
            return serialize_and_submit_json(False)
    return serialize_and_submit_json(True)

@app.route('/init_datasource', methods=['GET'])
def init_datasource():
    datasource = request.args.get('datasource')
    data_model.init(datasource)
    resp = jsonify(success=True)
    return resp


def serialize_and_submit_json(data):
    response = app.response_class(
        response=orjson.dumps(data, option=orjson.OPT_SERIALIZE_NUMPY),
        mimetype='application/json'
    )
    return response

