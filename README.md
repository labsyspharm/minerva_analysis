# Neighborhood Viewer

## About
This is  an [openseadragon](https://openseadragon.github.io/) based **Cellular Image Viewing and Analysis Tool**. 
It is built with a python [Flask](http://flask.pocoo.org/) backend, and a [Node.js](https://nodejs.org/en/) javascript frontend.

### Install
#### 1. Checkout Project
`git clone https://github.com/simonwarchol/neighborhood_viewer.git`
#### 2. Python environment installation
* Install [miniconda](https://conda.io/miniconda.html) or [conda](https://docs.conda.io/projects/conda/en/latest/user-guide/install/download.html). 
* Create env:  `conda env create -n [myenvname] -f requirements.yml` 
#### 3. Node.js installation and packages
* Install [Node.js](https://nodejs.org/en/), then navigate to /static and run `npm install` to install all packages listed in package.json.
* Run `npm run start` to package the Javascript, or run `npm run watch` if you plan on editing dependencies
#### 4. Run Server
* Active environment: `conda activate [myenvname]`. Navigate to your project root folder and run your server: `python.exe -m flask run`
* `python-m flask run` 
* The tool is by default available http://127.0.0.1:5000/ 


