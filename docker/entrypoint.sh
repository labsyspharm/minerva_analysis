#!/bin/bash
python scope2screen/run.py 8001 &
python gating/run.py 8002 &
#python visinity/run.py 8003 &
nginx -g 'daemon off;' &
#python -m http.server -d /app 8080 &
wait