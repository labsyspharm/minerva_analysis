FROM python:3.7-buster
RUN apt-get update \
  && apt-get upgrade -y \
  && apt-get -y --no-install-recommends install libblas-dev liblapack-dev libgsf-1-dev libgl1-mesa-glx wget make g++ build-essential libtool libimagequant0 libimagequant-dev libgif-dev \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY . /app
RUN pip install -r Docker_requirements.txt

ENTRYPOINT [ "python" ]
CMD [ "app.py" ]

