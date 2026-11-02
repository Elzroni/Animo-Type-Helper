"""Runs the Aniimo helper on this computer using Python's built-in web server."""
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
import os, threading, webbrowser

os.chdir(Path(__file__).resolve().parent)
port = 8765
class Handler(SimpleHTTPRequestHandler):
    def log_message(self, fmt, *args):
        print(fmt % args)

try:
    server = ThreadingHTTPServer(('127.0.0.1', port), Handler)
except OSError:
    print('Port 8765 is already being used. If the app is already open, visit http://localhost:8765')
    input('Press Enter to close...')
else:
    print('Aniimo Type Helper is running at http://localhost:8765')
    print('Keep this window open while using the app. Close it to stop the server.')
    threading.Timer(1.0, lambda: webbrowser.open('http://localhost:8765')).start()
    try: server.serve_forever()
    except KeyboardInterrupt: pass
