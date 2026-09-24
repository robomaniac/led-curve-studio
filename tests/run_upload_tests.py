#!/usr/bin/env python3
"""Run the real app's upload code in an isolated, headless Chromium browser.

No packages or hardware are needed. Requires Python 3 and Chrome/Chromium/Edge.
Run from the repository root: python tests/run_upload_tests.py
"""
import argparse
import functools
import json
import os
from pathlib import Path
import shutil
import signal
import subprocess
import sys
import tempfile
import threading
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

ROOT = Path(__file__).resolve().parents[1]


def find_browser(explicit):
    candidates = [explicit, os.environ.get("CHROME_BINARY")]
    for variable in ("PROGRAMFILES", "PROGRAMFILES(X86)", "LOCALAPPDATA"):
        base = os.environ.get(variable, "")
        if base:
            candidates.extend([
                str(Path(base) / "Google/Chrome/Application/chrome.exe"),
                str(Path(base) / "Microsoft/Edge/Application/msedge.exe"),
            ])
    candidates.extend(shutil.which(name) for name in (
        "google-chrome", "chromium", "chromium-browser", "microsoft-edge"))
    candidates.extend([
        "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
        "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
    ])
    return next((path for path in candidates if path and Path(path).is_file()), None)


class TestHandler(SimpleHTTPRequestHandler):
    def log_message(self, format, *args):
        pass

    def do_GET(self):
        if self.path == "/__app_smoke__.html":
            # Install error recording before any app code executes.
            source = (ROOT / "index.html").read_text(encoding="utf-8")
            recorder = """<script>
window.addEventListener("error", event => parent.appErrors.push(event.message));
window.addEventListener("unhandledrejection", event =>
  parent.appErrors.push(String(event.reason)));
const originalConsoleError = console.error;
console.error = (...args) => {
  parent.appErrors.push(args.map(String).join(" "));
  originalConsoleError.apply(console, args);
};
</script>"""
            source = source.replace("<head>", "<head>" + recorder, 1)
            body = source.encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        super().do_GET()

    def do_POST(self):
        if self.path != "/__test_result__":
            self.send_error(404)
            return
        length = int(self.headers.get("Content-Length", "0"))
        if length < 1 or length > 1024 * 1024:
            self.send_error(400)
            return
        try:
            result = json.loads(self.rfile.read(length))
        except (ValueError, UnicodeDecodeError):
            self.send_error(400)
            return
        self.server.test_result = result
        self.send_response(204)
        self.end_headers()
        self.server.test_done.set()


def stop_browser(process):
    if process.poll() is not None:
        return
    if os.name == "nt":
        # Only the isolated browser process we created and its descendants.
        subprocess.run(
            ["taskkill", "/PID", str(process.pid), "/T", "/F"],
            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
            creationflags=subprocess.CREATE_NO_WINDOW, check=False)
    else:
        os.killpg(process.pid, signal.SIGTERM)
    try:
        process.wait(timeout=8)
    except subprocess.TimeoutExpired:
        process.kill()
        process.wait(timeout=5)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--browser", help="Path to Chrome, Chromium, or Edge")
    parser.add_argument("--timeout", type=int, default=60,
                        help="Maximum test duration in seconds (default: 60)")
    args = parser.parse_args()
    browser = find_browser(args.browser)
    if not browser:
        parser.error("Chrome/Chromium/Edge was not found; pass --browser with its full path.")
    server = ThreadingHTTPServer(
        ("127.0.0.1", 0), functools.partial(TestHandler, directory=str(ROOT)))
    server.test_done = threading.Event()
    server.test_result = None
    server_thread = threading.Thread(target=server.serve_forever, daemon=True)
    server_thread.start()
    process = None
    exit_code = 1
    try:
        with tempfile.TemporaryDirectory(prefix="led-curve-upload-tests-") as temporary:
            profile = Path(temporary) / "profile"
            with open(Path(temporary) / "browser.log", "w+", encoding="utf-8") as log:
                command = [
                    browser, "--headless=new", "--no-first-run",
                    "--no-default-browser-check", "--disable-extensions",
                    "--disable-background-networking", "--disable-component-update",
                    "--disable-sync", "--disable-gpu",
                    "--disable-background-timer-throttling",
                    "--disable-renderer-backgrounding",
                    "--user-data-dir=" + str(profile),
                    "http://127.0.0.1:%d/tests/upload-tests.html" % server.server_port,
                ]
                options = {"stdout": log, "stderr": log}
                if os.name == "nt":
                    options["creationflags"] = subprocess.CREATE_NO_WINDOW
                else:
                    options["start_new_session"] = True
                try:
                    process = subprocess.Popen(command, **options)
                    complete = server.test_done.wait(args.timeout)
                finally:
                    if process:
                        stop_browser(process)
                result = server.test_result
                if not complete or result is None:
                    print("FAIL: browser did not return results within %s seconds." % args.timeout)
                    log.seek(0)
                    print(log.read()[-4000:])
                else:
                    for item in result.get("tests", []):
                        print(("%s: " % ("PASS" if item["passed"] else "FAIL")) + item["name"])
                        if not item["passed"]:
                            print("  " + item.get("error", "Unknown failure").replace("\n", "\n  "))
                    if result.get("fatal"):
                        print("FAIL: " + result["fatal"])
                    tests = result.get("tests", [])
                    failed = sum(not item["passed"] for item in tests)
                    print("\n%d passed; %d failed. Hardware flashing is not exercised." %
                          (len(tests) - failed, failed))
                    exit_code = 0 if tests and not failed and not result.get("fatal") else 1
    finally:
        server.shutdown()
        server.server_close()
        server_thread.join(timeout=2)
    return exit_code


if __name__ == "__main__":
    sys.exit(main())
