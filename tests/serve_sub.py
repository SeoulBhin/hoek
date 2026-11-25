"""dist/ 를 http://127.0.0.1:<port>/hoek/ 아래로 내보낸다(GitHub Pages 하위 경로 흉내). 시험·캡처용"""
import functools, http.server, socketserver, threading
from pathlib import Path

DIST = Path(__file__).resolve().parent.parent / "dist"


class Handler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a):
        pass

    def translate_path(self, path):
        path = path.split("?", 1)[0].split("#", 1)[0]
        if not path.startswith("/hoek/"):
            return str(DIST / "__nope__")
        rel = path[len("/hoek/"):] or "index.html"
        return str(DIST / rel)


def start():
    srv = socketserver.ThreadingTCPServer(("127.0.0.1", 0), Handler)
    srv.daemon_threads = True
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return srv, f"http://127.0.0.1:{srv.server_address[1]}/hoek/"
