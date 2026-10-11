from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import os
os.chdir(os.path.dirname(os.path.abspath(__file__)))
port = int(os.environ.get("PORT", "8080"))
server = ThreadingHTTPServer(("0.0.0.0", port), SimpleHTTPRequestHandler)
print(f"ELEVEN Football Reality Lab listening on 0.0.0.0:{port}", flush=True)
server.serve_forever()
