# Gater | Minerva Analysis

![](./minerva_analysis/client/src/img/logo_with_text.svg)

## About
This is  an [openseadragon](https://openseadragon.github.io/) based **Cellular Image Viewing and Analysis Tool**. 
It is built with a python [Flask](http://flask.pocoo.org/) backend and a [Node.js](https://nodejs.org/en/) javascript frontend.

## Executables (for Users)
Releases can be found here:
https://github.com/labsyspharm/minerva_analysis/releases
These are executables for Windows and MacOS that can be run locally without any installations.


## Running as a Docker container
**Note:** When running on an ARM machine (e.g. M1 Macbook), build the image with `docker build --platform linux/amd64 -t gating .`
* Build image: `docker build -t gating .` 
* Run image with mounted path: `docker run --rm -dp 8000:8000 -v [source path]:/[target path] gating`

where
* `--rm` cleans up the container after it finishes executing
* `-v` mounts the "present working directory" (containing your data) to be `/data` inside the container. This is necessary in order to import your data via the import page.
* `-dp` forwards the port 8000

Once the container is running, go to `http://localhost:8000/` in your web browser. 
To import your imaging files in the import gui type in the mounted `/data/..`

## Clone and Run Codebase (for Developers)
#### 1. Checkout Project
* `git clone https://github.com/labsyspharm/minerva_analysis.git`
* `cd minerva_analysis`
#### 2. Checkout Necessary Branch
* **For Gating, run** `git checkout gating`
* Run `git pull` to make sure everything is up to date 



#### 3. Conda Install Instructions. 
##### Install Conda
* Install [miniconda](https://conda.io/miniconda.html) or [conda](https://docs.conda.io/projects/conda/en/latest/user-guide/install/download.html). 
* Create env:  `conda env create -f requirements.yml`

##### Activate Environment
* Active environment: `conda activate minerva`


##### Start the Server

* `python run.py` - Runs the webserver
##### Start the Server

* Access the tool via `http://localhost:8000/`

## Running in Jupyter notebooks

Install the package into the same environment as Jupyter:

```bash
pip install -e ".[jupyter]"
```

For local notebooks, use:

```python
from minerva_analysis.jupyter import MinervaViewer

MinervaViewer(datasource="my_dataset", data_dir="path/to/minerva_data")
```

For JupyterHub or remote notebooks with `jupyter-server-proxy` enabled, use:

```python
MinervaViewer(datasource="my_dataset", data_dir="path/to/minerva_data", proxy=True)
```

Datasets can also be registered directly from notebook-visible files:

```python
viewer = MinervaViewer.from_files(
    name="my_dataset",
    image="/path/to/image.ome.tif",
    segmentation="/path/to/segmentation.ome.tif",
    features="/path/to/cells.csv",
    x="X_centroid",
    y="Y_centroid",
    id_column="CellID",
    data_dir="path/to/minerva_data",
    proxy=True,
)
viewer
```

## Baseline smoke test

Before upgrading dependencies or changing the viewer/server boundary, run the local `orion2` baseline:

```bash
python -m tests.baseline_orion2
```

The test checks Flask app import, `/config`, the viewer page, metadata JSON, channel metadata, and one image tile plus one segmentation tile. It skips with a clear message if the local `orion2` datasource or exemplar files are not available.


#### (4. Node.js installation and packages)
  This step is only needed when you plan to edit js code. The codebase already included bundled js files.
* Install [Node.js](https://nodejs.org/en/), then navigate to `/minerva_analysis/client` and run `npm install` to install all packages listed in package.json.
* Run `npm run start` to package the Javascript, or run `npm run watch` if you plan on editing dependencies


## Packaging/Bundling Code as Executable (for Developers)
Any tagged commit to a branch will trigger a build, where `tag == commit message`. This will appear under releases. Note building may take ~10 min.

Tagging Conventions: All release tags should look like `v{version_number}_{branch_name}`.
