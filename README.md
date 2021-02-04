# CyCIF Viewer

## About
This is  an [openseadragon](https://openseadragon.github.io/) based **Cellular Image Viewing and Analysis Tool**. 
It is built with a python [Flask](http://flask.pocoo.org/) backend and a [Node.js](https://nodejs.org/en/) javascript frontend.

### Install
#### 1. Checkout Project
`git clone https://github.com/labsyspharm/cycif_viewer.git`
#### 2. Checkout Necessary Branch
* **For Gating, run** `git checkout gating`
* Run `git pull` to make sure everything is up to date 



#### 2. Conda Install Instructions. 
##### Install Conda
* Install [miniconda](https://conda.io/miniconda.html) or [conda](https://docs.conda.io/projects/conda/en/latest/user-guide/install/download.html). 
* Create env:  `conda env create -f requirements.yml`

##### Activate Environment
* Active environment: `conda activate cycif_viewer`


##### Start the Server

* `python run.py` - Runs the webserver
##### Start the Server

* Access the tool via `http://localhost:8000/`


### Packaging (Bundling as Executable)

##### Windows

* Create alternative conda env without mkl: `conda create --name nomkl`
* Active environment: `conda activate nomkl`
* Run `pip install -r requirements.txt`
* Run `package_win.bat`

##### MacOS

* Create env:  `conda env create -f requirements.yml`
* Active environment: `conda activate cycif_viewer`
* Run `bash package_mac.sh`

### Executables

Releases can be found here:
https://github.com/labsyspharm/cycif_viewer/releases
These are executables for Windows and MacOS that can be run locally without any installations.
