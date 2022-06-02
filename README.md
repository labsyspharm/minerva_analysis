# Visinity
### Visinity: Visual Spatial Neighborhood Analysis for Multiplexed Tissue Imaging Data

Simon Warchol*, Robert Krueger*, Ajit Johnson Nirmal, Giorgio Gaglia, Jared Jessup, Cecily C. Ritch, John Hoffer, Jeremy Muhlich, Megan L. Burger, Tyler Jacks, Sandro Santagata, Peter K. Sorger, Hanspeter Pfister
(* Indicates equal contribution)

Pre-print [https://doi.org/10.1101/2022.05.09.490039](https://doi.org/10.1101/2022.05.09.490039)



Visinity is part of the [Minerva Analysis](https://github.com/labsyspharm/minerva_analysis/) suite of tools from the
[Lab of Systems Pharmacology](https://labsyspharm.org/) at Harvard Medical School and the [Visual Computing Group](https://vcg.seas.harvard.edu/) at Harvard SEAS.
## About

This is  an [openseadragon](https://openseadragon.github.io/) based **Cellular Image Viewing and Analysis Tool**. 
It is built with a python [Flask](http://flask.pocoo.org/) backend and a [Node.js](https://nodejs.org/en/) javascript frontend.

![InterfaceTeaserFinal](https://user-images.githubusercontent.com/3915140/165777022-580b8b96-07e9-4928-acf4-0f23f418985d.jpg)


Visinity interface. a) Image viewer: multiplex whole-slide tissue images highlighting spatial cell arrangement. b) Cohort view: search, apply, compare spatial patterns across different specimens. c) Neighborhood composition view: visualizes cell types that make up cell neighborhoods; d) UMAP embedding view: encodes cells with similar neighborhood as dots close to each other; e) Correlation matrix: pairwise interactions between cells; f) Comparison \& summary view: different small multiple encodings of extracted patterns. g) Neighborhood search: finds cells with similar neighborhood; h) Interactive clustering: automated detection of neighborhood patterns; i) Annotation panel: save and name patterns;  j) Channel selection: color and combine image channels.

## Example Dataset
### [https://www.synapse.org/#!Synapse:syn30919374/wiki/617796](https://www.synapse.org/#!Synapse:syn30919374/wiki/617796)
## Import
Import requires an image,segmentation mask, single cell quantification, and cell types. See example dataset.

Importing cohort data requires pressing the add linked dataset button and importing all specimens at once
![image](https://user-images.githubusercontent.com/3915140/165776003-4febe424-8ad1-4b71-8f61-012138993f14.png)

Match CSV columns with channels in the image via the GUI. 

For more info about the specific features of the system and their use, see the [pre-print](https://doi.org/10.1101/2022.05.09.490039).

## Executables (for Users)
Releases can be found here:
https://github.com/labsyspharm/Visinity/releases
These are executables for Windows and MacOS that can be run locally without any installations.



## Developer Instructions
#### Checkout Project
`git clone https://github.com/labsyspharm/visinity.git`
####  Conda Install Instructions. 
##### Install Conda
* Install [miniconda](https://conda.io/miniconda.html) or [conda](https://docs.conda.io/projects/conda/en/latest/user-guide/install/download.html). 
* Create env:  `conda env create -f requirements.yml`
##### Activate Environment
* Active environment: `conda activate visinity`
##### Start the Server
* `python run.py` - Runs the webserver
##### Start the Server

* Access the tool via `http://localhost:8000/`

#### Node.js installation and packages
  This step is only needed when you plan to edit js code. The codebase already included bundled js files.
* Install [Node.js](https://nodejs.org/en/), then navigate to `/minerva_analysis/client` and run `npm install` to install all packages listed in package.json.
* Run `npm run start` to package the Javascript, or run `npm run watch` if you plan on editing dependencies


### Packaging/Bundling Code as Executable (for Developers)
Any tagged commit to a branch will trigger a build, where `tag == commit message`. This will appear under releases. Note building may take ~10 min.

Tagging Conventions: All release tags should look like `v{version_number}_{branch_name}`.

### Debugging
npm ssh errors from `viawebgl` can be solved w/
` npm cache clear --force && npm install --no-shrinkwrap --update-binary`