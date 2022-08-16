from waitress import serve
from minerva_analysis import app
import multiprocessing
import sys

if __name__ == '__main__':
    print (len(sys.argv))
    multiprocessing.freeze_support()
    #use port 8000 if no port is specified via command line argument
    port = 8000 if len(sys.argv) < 2 or not str.isdigit(sys.argv[1]) else sys.argv[1]
    print('Serving on 0.0.0.0:' + str(port) + ' or http://localhost:' + str(port) )
    serve(app, host='0.0.0.0', port=port, max_request_body_size=107374182400, max_request_header_size=8589934592)

