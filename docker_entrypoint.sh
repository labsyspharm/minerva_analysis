#!/bin/bash
python scope2screen/run.py 8001 true &
python gater/run.py 8002 true &
python visinity/run.py 8003 true &
python app/run.py 8080 true &
wait