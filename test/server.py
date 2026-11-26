#!/usr/bin/env python3
"""Static server for tests with no-store headers, so service-worker update checks see new bytes immediately."""
import http.server, sys
class H(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()
    def log_message(self, *a):
        pass
http.server.ThreadingHTTPServer(('127.0.0.1', 8742), H).serve_forever()
