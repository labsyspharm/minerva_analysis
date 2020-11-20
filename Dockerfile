FROM nikolaik/python-nodejs:python3.7-nodejs12
RUN apt-get update \
  && apt-get upgrade -y \
  && apt-get -y --no-install-recommends install libblas-dev liblapack-dev libgsf-1-dev libgl1-mesa-glx wget make g++ build-essential libtool libimagequant0 libimagequant-dev libgif-dev \
  && rm -rf /var/lib/apt/lists/*

ENV LIBVIPS_VERSION=8.10.1

RUN cd /tmp && \
    wget "https://github.com/libvips/libvips/releases/download/v${LIBVIPS_VERSION}/vips-${LIBVIPS_VERSION}.tar.gz" && \
    tar xf "vips-${LIBVIPS_VERSION}.tar.gz" && \
    cd "vips-${LIBVIPS_VERSION}" && \
    ./configure && \
    make install && \
    ldconfig /usr/local/lib && \
    apt-get -y --purge autoremove && \
    apt-get -y clean && \
    rm -rf /usr/share/doc /usr/share/man /var/lib/apt/lists/* /root/* /tmp/* /var/tmp/*

WORKDIR /app
COPY . /app
RUN pip install -r Docker_requirements.txt
RUN npm install --prefix static/frontend/
RUN npm run start --prefix static/frontend/

ENTRYPOINT [ "python" ]
CMD [ "app.py" ]

