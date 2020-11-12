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

#### 2a. Docker Instructions

##### Install and Run Docker
* Download and Install [Docker Desktop](https://www.docker.com/products/docker-desktop)
* Run the Docker Desktop App

##### Build the Docker Image
* Open a the Command Prompt and navigate to the `cycif_viewer` directory.
* e.g. `cd Documents\cycif_viewer`
* run `docker build --tag cv .` to build the docker image. This may take some time.

##### Run the Docker Container
* Run `docker run --publish 8000:8000 --name cv_container cv` to a container with the docker image

#####  Access the app
* Open your web browser and go to [http://localhost:8000/](http://localhost:8000/) to use the app

#####  Stop the Container
* Run `CTRL+C` to access the terminal and run `docker container stop cv_container` 

##### (Optional) Delete and Rebuild Image
* Delete the Docker container with `docker container rm cv_container`
* Delete the image with `docker image rm cv`
* Update the repository with `git pull`
* Rebuild the image: `docker build --tag cv .` 
* Create and a run a new container `docker run --publish 8000:8000 --name cv_container cv`




#### 2b. Conda Install Instructions. 
##### Install Conda
* Install [miniconda](https://conda.io/miniconda.html) or [conda](https://docs.conda.io/projects/conda/en/latest/user-guide/install/download.html). 
* Create env:  `conda env create -n [myenvname] -f requirements.yml`

##### Node.js installation and packages
* Install [Node.js](https://nodejs.org/en/), then navigate to `/static/frontend` and run `npm install` to install all packages listed in package.json.
* Run `npm run start` to package the Javascript, or run `npm run watch` if you plan on editing dependencies


##### Activate Environment
* Active environment: `conda activate [myenvname]`. 


##### Install libvips
###### Mac/Linux Users:
*  Install the `libvips` CLI w/ homebrew for macOS, `brew install libvips`. Linux users, see instructions on the [libvips page](https://libvips.github.io/libvips/install.html)

###### Windows Users:
* I've included the windows libvips binary in the package for convenience.


##### Start the Server

* `python app.py` - Runs the webserver
##### Start the Server

* Access the tool via `http://localhost:8000/`

