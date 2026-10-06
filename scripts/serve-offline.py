"""Serve the extracted HostRoster app on loopback only, without opening a browser."""
import argparse
import functools
import http.server
from pathlib import Path

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--port', type=int, default=8766, help='Local port (default: 8766)')
args = parser.parse_args()
if not 0 <= args.port <= 65535:
    parser.error('port must be between 0 and 65535')
root = Path(__file__).resolve().parent
if not (root / 'index.html').is_file() or not (root / 'worker.js').is_file():
    parser.error('Run serve.py from the extracted offline bundle containing index.html and worker.js')
class StaticHandler(http.server.SimpleHTTPRequestHandler):
    extensions_map = {**http.server.SimpleHTTPRequestHandler.extensions_map, '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json'}

handler = functools.partial(StaticHandler, directory=str(root))
with http.server.ThreadingHTTPServer(('127.0.0.1', args.port), handler) as server:
    print(f'HostRoster: http://127.0.0.1:{server.server_port}/', flush=True)
    print('Local files only. Keep this window open; press Ctrl+C to stop.', flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
