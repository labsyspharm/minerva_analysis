from waitress import serve
from minerva_analysis import app
import multiprocessing
import sys

if __name__ == '__main__':
    multiprocessing.freeze_support()
    print("Server Running")
    serve(app, host='0.0.0.0', port=8000, max_request_body_size=107374182400, max_request_header_size=8589934592)
