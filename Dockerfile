FROM python:3.7

RUN apt-get update && \
    apt-get install -y python3-opencv && \
    rm -rf /var/lib/apt/lists/*

RUN python -m pip install \
    Flask==1.1.2 \
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
    opencv-python==4.5.3.56

COPY . /app

CMD ["python", "/app/run.py"]
