# CyCIF Viewer

## About
This is  an [openseadragon](https://openseadragon.github.io/) based **Cellular Image Viewing and Analysis Tool**. 
It is built with a python [Flask](http://flask.pocoo.org/) backend and a [Node.js](https://nodejs.org/en/) javascript frontend.

### Install
#### 1. Checkout Project
`git clone https://github.com/labsyspharm/cycif_viewer.git`
#### 2. Python environment installation
* Install [miniconda](https://conda.io/miniconda.html) or [conda](https://docs.conda.io/projects/conda/en/latest/user-guide/install/download.html). 
* Create env:  `conda env create -n [myenvname] -f requirements.yml` 
#### 3. Node.js installation and packages
* Install [Node.js](https://nodejs.org/en/), then navigate to `/static/frontend` and run `npm install` to install all packages listed in package.json.
* Run `npm run start` to package the Javascript, or run `npm run watch` if you plan on editing dependencies
#### 4. Activate Environment
* Active environment: `conda activate [myenvname]`. 
#### 5. Install libvips
##### Mac/Linux Users:
*  Install the `libvips` CLI w/ homebrew for macOS, `brew install libvips`. Linux users, see instructions on the [libvips page](https://libvips.github.io/libvips/install.html)
##### Windows Users:
* I've included the windows libvips binary in the package for convenience.
#### 6. Start the Server
* Navigate to your project root folder and run your server with `waitress`
* `python app.py`

