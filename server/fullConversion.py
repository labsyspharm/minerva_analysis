from PIL import Image
import timeit
import os

# set Libvips path for windows. If mac, please run `brew install vips`
if os.name == 'nt':
    vipshome = os.path.dirname(os.path.abspath(__file__)) + r"\..\static\external\vips-dev-8.10\bin"
    os.environ['PATH'] = vipshome + ';' + os.environ['PATH']

import shutil
from pathlib import Path
import pyvips
import numpy as np
import cv2
from skimage.io import imread
import tifffile as tf
from PIL import Image
import os
import re
import zarr

Image.MAX_IMAGE_PIXELS = 1000000000


def convertTifToPyramid(channel_img, destFile, isLabelImg):
    img_dim = channel_img.shape[:2]
    print('img shape', img_dim, channel_img.dtype)
    channel_img = channel_img.astype('uint32')
    imgR = ((channel_img >> 16) % 256).astype('uint8')
    imgG = ((channel_img >> 8) % 256).astype('uint8')  # high bits
    imgB = (channel_img % 256).astype('uint8')  # low bits
    channel_img = cv2.merge((imgB, imgG, imgR))

    if channel_img is not None:
        print('Destfile', destFile)
        cv2.imwrite(destFile + '.png', channel_img)  # [cv2.IMWRITE_PNG_COMPRESSION, 9]
        image = pyvips.Image.new_from_file(destFile + '.png', access='sequential')
        # Remove any existing directory with the name of the channel
        if os.path.exists(destFile):
            shutil.rmtree(destFile)
        if not isLabelImg:
            image.dzsave(destFile, tile_size=128, overlap=2, suffix='.png')
        else:
            image.dzsave(destFile, tile_size=128, overlap=2, region_shrink='nearest', suffix='.png')


def convertOmeTiff(filePath, channelFilePath=None, dataDirectory=None, isLabelImg=False):
    channel_info = {}
    channelNames = []
    if isLabelImg == False:
        channel_io = tf.TiffFile(str(filePath), is_ome=False)
        channels = zarr.open(channel_io.series[0].aszarr())
        channel_info['maxLevel'] = len(channels)
        shape = channels[0].shape
        channel_info['height'] = shape[1]
        channel_info['width'] = shape[2]
        channel_info['num_channels'] = shape[0]
        for i in range(shape[0]):
            channelName = re.sub(r'\.ome|\.tiff|\.tif|\.png', '', filePath.name) + "_" + str(i)
            channelNames.append(channelName)
        channel_info['channel_names'] = channelNames
        return channel_info
    else:
        channel_io = tf.TiffFile(str(channelFilePath), is_ome=False)
        channels = zarr.open(channel_io.series[0].aszarr())
        seg = tf.imread(filePath, is_ome=False)
        directory = Path(dataDirectory + "/" + filePath.name + ".zarr")
        store = zarr.DirectoryStore(directory)
        g = zarr.group(store=store, overwrite=True)
        for i in range(len(channels)):
            shape = channels[i].shape
            shape = (shape[-2], shape[-1])
            chunks = channels[i].chunks
            chunks = (chunks[-2], chunks[-1])
            data = seg
            print(shape)
            data = np.array(Image.fromarray(data).resize((shape[-1], shape[-2]), Image.NEAREST))
            print(np.shape(data))
            data = zarr.array(data)
            g.create_dataset(str(i), data=data, shape=shape, chunks=(1024, 1024), dtype=seg.dtype)
        return {'segmentation': str(directory)}
    # file_path = str(Path(filePath) / fileName)
    # ome = tf.imread(file_path, is_ome=True)
    # for channel in range(np.shape(ome)[0]):
    #     img = ome[channel, :, :]
    #
    #     channel_path = str(Path(filePath) / channelName)
    #     convertTifToPyramid(img, channel_path, isLabelImg)
    #     channelNames.append(channelName)
    # return channelNames


def convertChannel(filePath, isLabelImg):
    channel_img = imread(filePath)
    channel_img = np.squeeze(channel_img)  # Remove any unnecessary single dimensions
    channelPath = re.sub(r'\.ome|\.tiff|\.tif|\.png', '', filePath)
    convertTifToPyramid(channel_img, channelPath, isLabelImg)
