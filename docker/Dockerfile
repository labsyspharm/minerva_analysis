FROM python:3.8
RUN apt-get update
RUN apt-get install nginx -y
RUN apt-get install -y python3-opencv
RUN rm -rf /var/lib/apt/lists/*

RUN apt install -y git
RUN git clone https://github.com/labsyspharm/visinity.git
RUN git clone https://github.com/labsyspharm/scope2screen.git
RUN git clone https://github.com/labsyspharm/gating.git

RUN python -m pip -v install \
    Flask==2.1.0 \
    jinja2==3.0.3 \
    werkzeug==2.0.3 \
    itsdangerous==2.0.1 \
    flask-sqlalchemy \
    numpy \
    opencv-python \
    orjson \
    pandas \
    pillow==8.1.1 \
    requests \
    scikit-learn \
    scikit-image \
    scipy \
    tifffile==2021.4.8 \
    waitress \
    zarr==2.10.3 \
    ome-types \
    opencv-python==4.5.3.56 \
    dask \
    hdbscan \
    llvmlite \
    matplotlib \
    numba \
    elementpath==2.3.2 \
    pycave==3.1.3 \
    numpy-indexed \
    ome-types==0.2.9 \
    opencv-python \
    umap-learn \
    xmlschema==1.8.0

COPY . /app
COPY index.html /var/www/html/
COPY scope2screen.png /var/www/html/
COPY visinity.png /var/www/html/
COPY gating.png /var/www/html/
EXPOSE 80
CMD python scope2screen/run.py 8001 & python gating/run.py 8002 & python visinity/run.py 8003 & nginx -g 'daemon off;' & wait

# build the docker image (execute in shell):
# docker build -t minervaanalysis .

# run the docker container (execute in shell):
# docker run --rm -v C:/Users/Rkrueger/Documents/lsp/data:/data -p 8001:8001 -p 8002:8002 -p 8003:8003 minervaanalysis
# docker run --rm -v C:/Users/Rkrueger/Documents/lsp/data:/data -p 8001:8001 -p 8002:8002 -p 8003:8003 -p 8080:80 minervaanalysis
