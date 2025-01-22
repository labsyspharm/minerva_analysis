FROM python:3.9.15

RUN apt-get update && \
    apt-get install -y python3-opencv && \
    rm -rf /var/lib/apt/lists/*

RUN python -m pip install \
    Flask==2.2.2 \
    jinja2 \
    werkzeug==2.2.2 \
    itsdangerous==2.1.2 \
    flask-sqlalchemy==3.0.2 \
    numpy==1.26.4 \
    opencv-python \
    orjson \
    pandas \
    pillow==8.1 \
    requests \
    scikit-learn==1.2.2 \
    scikit-image \
    scipy \
    tifffile==2021.4.8 \
    waitress \
    zarr==2.10 \
    ome-types \
    matplotlib \
    appdirs \
    xmlschema

COPY . /app

CMD ["python", "/app/run.py"]