from server.dataFilter import database

import numpy as np
import matplotlib
import matplotlib.pyplot as plt
import time

from skimage import data, transform
from skimage.util import img_as_ubyte
from skimage.morphology import disk
from skimage.filters import rank
from skimage.io import imread
from skimage.color import rgb2gray
from skimage.transform import rescale, resize, downscale_local_mean




def prepSlidingWindow():
    print('hi')


def windowed_histogram_similarity(image, selem, reference_hist, n_bins):
    # Compute normalized windowed histogram feature vector for each pixel
    px_histograms = rank.windowed_histogram(image, selem, n_bins=n_bins)
    #print(px_histograms)

    # Reshape coin histogram to (1,1,N) for broadcast when we want to use it in
    # arithmetic operations with the windowed histograms from the image
    reference_hist = reference_hist.reshape((1, 1) + reference_hist.shape)

    # Compute Chi squared distance metric: sum((X-Y)^2 / (X+Y));
    # a measure of distance between histograms
    X = px_histograms
    Y = reference_hist

    num = (X - Y) ** 2
    denom = X + Y
    denom[denom == 0] = np.infty
    frac = num / denom

    chi_sqr = 0.5 * np.sum(frac, axis=2)

    # Generate a similarity measure. It needs to be low when distance is high
    # and high when distance is low; taking the reciprocal will do this.
    # Chi squared will always be >= 0, add small value to prevent divide by 0.
    similarity = 1 / (chi_sqr + 1.0e-4)

    return similarity


def histogramComparison(x, y, datasource, r, channels):

    tic = time.perf_counter()

    image = imread("server/Montage-25979ON-Cycle1.tif");
    image = rescale(image, 0.5, anti_aliasing=False)
    image = rgb2gray(image)
    img = img_as_ubyte(image)

    # Quantize to 16 levels of greyscale; this way the output image will have a
    # 16-dimensional feature vector per pixel
    quantized_img = img // 16

    # Select the coin from the 4th column, second row.
    # Co-ordinate ordering: [x1,y1,x2,y2]
    x = int(x);
    y = int(y);
    r = int(r);
    coin_coords = [x-r, y-r, x+r, y+r]  # 44 x 44 region
    coin = quantized_img[coin_coords[1]:coin_coords[3],
           coin_coords[0]:coin_coords[2]]

    # Compute coin histogram and normalize
    coin_hist, _ = np.histogram(coin.flatten(), bins=16, range=(0, 16))
    coin_hist = coin_hist.astype(float) / np.sum(coin_hist)

    # Compute a disk shaped mask that will define the shape of our sliding window
    # Example coin is ~44px across, so make a disk 61px wide (2 * rad + 1) to be
    # big enough for other coins too.
    selem = disk(r*2)

    # Compute the similarity across the complete image
    similarity = windowed_histogram_similarity(quantized_img, selem, coin_hist,
                                               coin_hist.shape[0])

    fig, axes = plt.subplots(nrows=2, ncols=2, figsize=(10, 10))

    axes[0, 0].imshow(quantized_img, cmap='gray')
    axes[0, 0].set_title('Quantized image')
    axes[0, 0].axis('off')

    axes[0, 1].imshow(coin, cmap='gray')
    axes[0, 1].set_title('Focus region')
    axes[0, 1].axis('off')

    axes[1, 0].imshow(img, cmap='gray')
    axes[1, 0].imshow(similarity, cmap='hot', alpha=1.0)
    axes[1, 0].set_title('Similarity mask')
    axes[1, 0].axis('off')

    axes[1, 1].imshow(img, cmap='gray')
    axes[1, 1].imshow(similarity, cmap='hot', alpha=0.5)
    axes[1, 1].set_title('Similarity mask and image')
    axes[1, 1].axis('off')

    # axes[1, 1].imshow(rotated_img, cmap='gray')
    # axes[1, 1].imshow(rotated_similarity, cmap='hot', alpha=0.5)
    # axes[1, 1].set_title('Rotated image with overlaid similarity')
    # axes[1, 1].axis('off')

    plt.tight_layout()
    plt.show()

    toc = time.perf_counter()
    print(f"Time in {toc - tic:0.4f} seconds")

    # self.prepSlidingWindow()
    return {'channels': channels}
