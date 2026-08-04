import http.server
import socketserver
import os
PORT = 3737
DIRECTORY = os.path.dirname(os.path.abspath(__file__))
class CustomHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)
if __name__ == "__main__":
    print(f"Starting server at http://localhost:{PORT}")
    with socketserver.TCPServer(("", PORT), CustomHandler) as httpd:
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nServer stopped.")
