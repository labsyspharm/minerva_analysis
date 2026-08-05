# Minerva Analysis Project Guide

Use this guide when working on the `minerva_analysis` repository. It captures the project shape, high-risk boundaries, and validation workflows so a new coding agent can become useful quickly.

## What This Project Is

Minerva Analysis, also called Gater in older docs, is an OpenSeadragon-based cellular image viewing and analysis tool. It has a Python Flask/Waitress backend and a JavaScript/Webpack frontend.

The core application serves multiresolution microscopy image tiles, segmentation/label tiles, feature CSV-backed cell data, gating/lasso/nearest-cell analysis, and viewer pages. It now also supports Jupyter notebooks through an iframe-backed sidecar Flask server, exposed directly on localhost or through `jupyter-server-proxy`.

Important user-facing modes:

- Desktop/local web app: `python run.py`, then open `http://localhost:8000/`.
- Notebook app: `from minerva_analysis.jupyter import MinervaViewer`.
- Remote Jupyter/JupyterHub: use `MinervaViewer(..., proxy=True)` with `jupyter-server-proxy`.
- PyPI/package install: `pip install "minerva-analysis[jupyter]"` should work without conda, while conda/uv remain useful for development.
- Frontend development: edit `minerva_analysis/client/src`, then run `npm run start` to regenerate bundled assets in `minerva_analysis/client/dist`.

## Repository Map

Top-level files:

- `pyproject.toml`: Python package metadata, dependencies, extras, console script, Jupyter server proxy entry point, package data.
- `requirements.yml`: Conda bootstrap environment for local development. Conda owns the interpreter; pip/uv installs the package.
- `requirements-dev.lock.txt`: uv-generated Python dependency lock for dev/Jupyter extras.
- `run.py`: legacy/local desktop server entry point. Keep this working.
- `Dockerfile`: Docker runtime, currently Python 3.13.
- `MANIFEST.in` and `[tool.setuptools.package-data]`: packaging inclusion for frontend assets/templates/shaders.
- `README.md`: user-facing usage notes.
- `tests/baseline_orion2.py`: main local smoke test using the `orion2` datasource when available.

Python package:

- `minerva_analysis/__init__.py`: creates the Flask app, configures `data_path`, SQLite path, package paths, base URL, notebook iframe headers, and imports routes/models.
- `minerva_analysis/server_cli.py`: notebook-friendly sidecar CLI, exposed as `minerva-analysis-server`.
- `minerva_analysis/jupyter.py`: notebook display API and subprocess lifecycle for sidecar servers.
- `minerva_analysis/proxy.py`: `jupyter-server-proxy` launcher entry point.
- `minerva_analysis/datasource.py`: programmatic datasource registration for notebooks and scripts.
- `minerva_analysis/server/models/data_model.py`: core tile, metadata, CSV, zarr/OME-TIFF, segmentation, GMM, and spatial-query behavior. Treat this as high-risk.
- `minerva_analysis/server/models/database_model.py`: SQLite models.
- `minerva_analysis/server/routes/page_routes.py`: viewer/upload/page routes.
- `minerva_analysis/server/routes/data_routes.py`: JSON/data/tile/query/download routes.
- `minerva_analysis/server/routes/import_routes.py`: upload/import flow routes.
- `minerva_analysis/server/utils/*`: conversion, pyramid, normalization, and image utility code.

Frontend:

- `minerva_analysis/client/package.json`: Webpack 5 frontend dependencies and scripts.
- `minerva_analysis/client/webpack.config.js`: JS/CSS/shader bundling config.
- `minerva_analysis/client/src/js/main.js`: app initialization.
- `minerva_analysis/client/src/js/services/dataLayer.js`: client API layer for server data/metadata/tile configuration.
- `minerva_analysis/client/src/js/views/imageViewer.js`: OpenSeadragon viewer, tile loading, cache behavior, overlays, channel rendering.
- `minerva_analysis/client/src/js/views/csvGatingList.js`: CSV/gating UI behavior.
- `minerva_analysis/client/src/js/views/lensingFilters/*`: lasso, nearest cells, channel relationship views, segmentation outlines.
- `minerva_analysis/client/templates/*.html`: Flask templates. `base.html` is especially important for base URL and frontend asset loading.
- `minerva_analysis/client/dist/vendor_bundle.js`: built frontend bundle that must be included in packages.

Generated/local-only directories:

- `build/`, `dist/`, `minerva_analysis.egg-info/`, `minerva_analysis-<version>/`, `__pycache__/`, `.pytest_cache/`, `node_modules/`, and `minerva_analysis/data/` are generated or local data. Do not commit them unless explicitly asked and justified.

## Core Architecture

The Flask app is created at import time in `minerva_analysis/__init__.py`.

Data root selection:

- `MINERVA_DATA_PATH` wins when set.
- Frozen/PyInstaller apps use a `data` directory next to the executable.
- Default development mode uses `minerva_analysis/data`.

The selected data root contains:

- `config.json`: datasource definitions.
- `db.sqlite3`: local SQLite database.
- datasource directories and generated pyramids/tiles as needed.

Tile and metadata flow:

- The browser loads a datasource page such as `/orion2`.
- The frontend requests `/config`, metadata, channel names, OME metadata, and `/generated/data/<datasource>/<channel>/<level>/<x>_<y>.png` tiles.
- Python routes delegate most tile/metadata behavior to `server/models/data_model.py`.
- Segmentation is represented as an image channel in `config.json` plus `segmentation` metadata. The first `imageData` entry often points to the label/area channel.

Notebook flow:

- `MinervaViewer` starts `python -m minerva_analysis.server_cli` in a subprocess bound to `127.0.0.1`.
- Direct local notebooks use iframe URLs like `http://127.0.0.1:<port>/<datasource>`.
- Remote/JupyterHub notebooks use proxy URLs like `<jupyter_base>/proxy/<port>/<datasource>`.
- `MINERVA_BASE_URL` makes Flask templates and frontend requests base-url aware.
- `MINERVA_NOTEBOOK_MODE=1` enables same-origin iframe-friendly headers.

Datasource registration:

- Use `register_datasource(...)` in `minerva_analysis/datasource.py`.
- It writes/updates `config.json` under the selected `data_dir`.
- It uses `data_model.convertOmeTiff(...)` for image and segmentation metadata.
- `copy=False` stores absolute paths and is preferred for large files on remote servers.

## Common Tasks And Where To Work

For notebook support:

- Start in `minerva_analysis/jupyter.py`, `minerva_analysis/server_cli.py`, `minerva_analysis/proxy.py`, and `minerva_analysis/__init__.py`.
- Then check `client/templates/base.html` and URL construction in frontend services.
- Preserve `python run.py` behavior while changing notebook/server-proxy behavior.

For PyPI packaging:

- Start in `pyproject.toml`, `MANIFEST.in`, and package data under `minerva_analysis/client`.
- Use `uv build` as the canonical package build.
- Verify the built wheel from outside the repo so imports come from `site-packages`, not the checkout.
- Ensure templates, `client/dist/vendor_bundle.js`, shaders, CSS, images, and external OpenSeadragon assets are included.

For tile or segmentation bugs:

- Start with browser console URLs and `server/routes/data_routes.py`.
- Then inspect `server/models/data_model.py`, especially OME/zarr level selection, channel names, label image handling, and generated tile paths.
- On the frontend, inspect `client/src/js/services/dataLayer.js` and `client/src/js/views/imageViewer.js`.
- Be careful with cache behavior: a symptom that only resolves after hard refresh can be frontend cache ordering, stale bundle, or request timing.

For gating/lasso/nearest-cell/query behavior:

- Server side: `server/routes/data_routes.py`, `server/models/data_model.py`, `server/models/database_model.py`.
- Frontend side: `client/src/js/views/csvGatingList.js` and `client/src/js/views/lensingFilters/*`.
- Confirm CSV download payloads and query endpoints after changes.

For frontend dependency or UI work:

- Work in `minerva_analysis/client`.
- Run `npm install` after dependency changes.
- Run `npm run start` to regenerate `client/dist/vendor_bundle.js`.
- Browser tests are legacy and may fail old behavioral assertions; do not assume `npm test` is fully green without checking current notes.

For Python dependency modernization:

- Prefer Python 3.13. Python 3.12 is the fallback target.
- Use the `minerva` conda env for local work. A stale/broken `minerva_analysis` env may exist on some machines; do not use it unless the user explicitly says it has been repaired.
- Use uv for pip resolution/builds, not hand-edited lock files.
- Keep `requires-python = ">=3.12,<3.14"` unless a real dependency forces a narrower range.

## Validation Commands

Run from the repository root unless noted.

Core Python baseline:

```powershell
conda run -n minerva python -m tests.baseline_orion2
```

Python import/compile sanity:

```powershell
conda run -n minerva python -m compileall -q minerva_analysis tests
```

Local server:

```powershell
conda run -n minerva python run.py
```

Open:

```text
http://localhost:8000/orion2
```

Frontend build:

```powershell
cd minerva_analysis/client
npm run start
```

Frontend tests:

```powershell
cd minerva_analysis/client
npm test
```

Known caveat: after the modernization work, TypeScript and Webpack/Karma bundling worked, but several legacy browser assertions were still failing. Treat those as a separate test-maintenance task unless the current branch has fixed them.

Package build:

```powershell
conda run -n minerva uv build
```

Package install probe:

```powershell
conda create -n minerva_piptest -c conda-forge python=3.13 pip
conda activate minerva_piptest
python -m pip install --upgrade pip
python -m pip install dist/minerva_analysis-1.0.2-py3-none-any.whl
python -c "from minerva_analysis.jupyter import MinervaViewer; print(MinervaViewer.__name__)"
minerva-analysis-server --help
```

When testing wheel imports, run Python from outside the repo. If cwd is the checkout, Python may import the local package instead of the installed wheel.

Notebook smoke:

```python
from minerva_analysis.jupyter import MinervaViewer

MinervaViewer(datasource="orion2", data_dir="path/to/minerva_data")
```

Remote/JupyterHub smoke:

```python
MinervaViewer(datasource="orion2", data_dir="path/to/minerva_data", proxy=True)
```

## Important Invariants

- `python run.py` must keep working for existing desktop/Docker users.
- Notebook support should remain iframe-backed and server-proxied, not a pure ipywidget rewrite.
- The sidecar server should bind to `127.0.0.1`; Jupyter proxy provides authenticated browser access.
- Datasource registration should not copy large OME-TIFF/zarr files by default.
- Do not break absolute-path datasets in `config.json`; many remote datasets will live outside the package directory.
- Keep package data complete. A pip-installed wheel must serve templates, built JS, shaders, CSS, images, and OpenSeadragon external files.
- Avoid committing generated local data/build artifacts.
- Treat `server/models/data_model.py` and `client/src/js/views/imageViewer.js` as high-risk: small changes can affect tile rendering, segmentation visibility, zoom behavior, and analysis queries.
- If changing URL construction, test both root mode `/` and proxied notebook mode `/proxy/<port>/`.
- If changing segmentation, test both zoomed-out and zoomed-in display, first normal page load, and browser hard-refresh behavior.

## Current Dependency Policy

Python:

- Primary target: Python 3.13.
- Fallback: Python 3.12.
- Package metadata allows `>=3.12,<3.14`.
- Flask stack is modernized to Flask 3.x.
- Scientific stack is modernized around NumPy 2.x and current pandas/scikit/skimage/tifffile/zarr.
- zarr is currently allowed as `>=3`; zarr/OME paths remain high-risk and need baseline tile tests after changes.

Frontend:

- Webpack 5 is used.
- Bootstrap is at 4.6.2. Do not jump to Bootstrap 5 as an incidental change.
- jQuery is 3.7.x, D3 is 7.x, FontAwesome is 7.x.
- Browser-side `node-fetch` was removed in favor of native `fetch`.
- The source is not React. Do not describe or treat it as a React app.

## Known Sharp Edges

- `uv build` can create `minerva_analysis.egg-info/` and versioned unpack directories. These are generated.
- Building or installing from the live Dropbox checkout on Windows may hit file-lock issues. A clean temp archive/clone is a better PyPI simulation.
- Running import probes from the repo root can accidentally import the checkout instead of the wheel.
- Missing segmentation tiles may show as browser console messages like `/generated/data/<dataset>/<label-channel>/<level>/<x>_<y>.png`. Confirm whether the tile is truly absent, computed lazily, or blocked by stale frontend cache.
- A segmentation overlay that appears only after hard refresh suggests frontend cache/timing/base-url behavior, not necessarily bad source data.
- `minerva_analysis/data/` is local runtime data. It may contain large datasets and should not be swept into commits.
- Existing uncommitted changes may be user work. Do not revert them unless explicitly asked.

## Git And Release Notes

- Main active remote for current work may be `nirmallab` at `https://github.com/nirmallab/minerva_analysis.git`.
- Upstream/original remote may also exist as `origin` at `https://github.com/labsyspharm/minerva_analysis.git`.
- Check branch and remote before pushing.
- The current package version in `pyproject.toml` and frontend `package.json` is `1.0.2`.
- For PyPI readiness, prefer this order:
  1. Run `python -m tests.baseline_orion2`.
  2. Run `npm run start` if frontend changed.
  3. Run `uv build`.
  4. Install the generated wheel into a fresh env and import from outside the repo.
  5. Verify `minerva-analysis-server --help`.

## Agent Operating Notes

- Read the relevant server and frontend files before changing behavior; this project has coupled Python/JS paths.
- Keep edits narrow and preserve old usage paths unless explicitly migrating them.
- Use `rg`/`rg --files` for code discovery.
- Use `apply_patch` for hand edits.
- Before committing, inspect `git status --short` and avoid generated artifacts.
- When reporting results, mention which validation commands were actually run and which were not.
