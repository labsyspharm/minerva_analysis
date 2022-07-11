# Minerva Analysis

![image](https://user-images.githubusercontent.com/31503434/146080160-99048e21-666d-4e48-8135-9c6d5fd41b50.png)


## About
Minerva Analysis an [openseadragon](https://openseadragon.github.io/) based **Muliplex Image Data Visualization and Analysis Toolset**. Sharing a common image viewer codebase (data import, rendering, linkage to tabular data), we currently offer tools for [focus+context-based data exploration](https://github.com/labsyspharm/minerva_analysis/wiki/Scope2Screen), [interactive channel gating](https://github.com/labsyspharm/minerva_analysis/wiki/Gating), [cluster exploration](https://github.com/labsyspharm/minerva_analysis/wiki/ClusterExploration), and [spatial neighborhood analysis](https://github.com/labsyspharm/minerva_analysis/wiki/Neighborhood-Analysis).
Minerva Analysis is built with a python [Flask](http://flask.pocoo.org/) backend and a [Node.js](https://nodejs.org/en/) javascript frontend.

## Executables (for Users)
Releases can be found here:
https://github.com/labsyspharm/minerva_analysis/releases
These are executables for Windows and MacOS that can be run locally without any installations.


## Clone and Run Codebase (for Developers)
#### 1. Checkout Project
`git clone https://github.com/labsyspharm/minerva_analysis.git`

#### 2. Checkout Necessary Branch
* Specific extensions (e.g., gating, scope2screen) are organized in the different branches of this repository (see [extensions in our wiki](https://github.com/labsyspharm/minerva_analysis/wiki/Extensions)).
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

Any tagged commit to a branch will trigger a build. This will appear under releases. Note building may take ~10 min.

**Tagging Conventions:** All release tags should look like `v{version_number}_{branch_name}`.

* Tagging Example:  `git tag "vX.X_scope2screen"` (adds a tag) followed by `git push --tags` (pushes the tag)
