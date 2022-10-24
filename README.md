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
`git clone https://github.com/labsyspharm/minerva_analysis.git`
#### 2. Checkout Necessary Branch
* **For Gating, run** `git checkout gating`
* Run `git pull` to make sure everything is up to date 



#### 3. Conda Install Instructions. 
##### Install Conda
* Install [miniconda](https://conda.io/miniconda.html) or [conda](https://docs.conda.io/projects/conda/en/latest/user-guide/install/download.html). 
* Create env:  `conda env create -f requirements.yml`

##### Activate Environment
* Active environment: `conda activate minerva_analysis`


##### Start the Server

* `python run.py` - Runs the webserver
##### Start the Server

* Access the tool via `http://localhost:8000/`


#### (4. Node.js installation and packages)
  This step is only needed when you plan to edit js code. The codebase already included bundled js files.
* Install [Node.js](https://nodejs.org/en/), then navigate to `/minerva_analysis/client` and run `npm install` to install all packages listed in package.json.
* Run `npm run start` to package the Javascript, or run `npm run watch` if you plan on editing dependencies


## Packaging/Bundling Code as Executable (for Developers)
Any tagged commit to a branch will trigger a build, where `tag == commit message`. This will appear under releases. Note building may take ~10 min.

Tagging Conventions: All release tags should look like `v{version_number}_{branch_name}`.
