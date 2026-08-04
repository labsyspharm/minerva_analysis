import atexit
import html
import os
import socket
import subprocess
import sys
import time
import urllib.request
import webbrowser
from pathlib import Path

from minerva_analysis.datasource import register_datasource


_SERVERS = {}


def _default_data_dir():
    from minerva_analysis import data_path

    return data_path


def _free_port():
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.bind(("127.0.0.1", 0))
        return sock.getsockname()[1]


def _clean_base_url(base_url):
    if not base_url or base_url == "/":
        return "/"
    return "/" + str(base_url).strip("/") + "/"


def _jupyter_base_url():
    return _clean_base_url(os.environ.get("JUPYTERHUB_SERVICE_PREFIX", "/"))


def _wait_until_ready(port, timeout=30):
    deadline = time.time() + timeout
    url = f"http://127.0.0.1:{port}/config"
    while time.time() < deadline:
        try:
            with urllib.request.urlopen(url, timeout=1) as response:
                if response.status < 500:
                    return
        except Exception:
            time.sleep(0.25)
    raise RuntimeError(f"Minerva Analysis server did not become ready on port {port}")


def _server_key(data_dir, base_url):
    return (str(Path(data_dir).expanduser().resolve()), base_url)


def _start_server(data_dir, base_url, port=None):
    key = _server_key(data_dir, base_url)
    existing = _SERVERS.get(key)
    if existing and existing.poll() is None:
        return existing._minerva_port

    port = port or _free_port()
    cmd = [
        sys.executable,
        "-m",
        "minerva_analysis.server_cli",
        "--host",
        "127.0.0.1",
        "--port",
        str(port),
        "--data-dir",
        str(Path(data_dir).expanduser().resolve()),
        "--base-url",
        base_url,
        "--notebook-mode",
    ]
    process = subprocess.Popen(cmd)
    process._minerva_port = port
    _SERVERS[key] = process
    _wait_until_ready(port)
    return port


def _cleanup_servers():
    for process in _SERVERS.values():
        if process.poll() is None:
            process.terminate()


atexit.register(_cleanup_servers)


class MinervaViewer:
    def __init__(
        self,
        datasource,
        data_dir=None,
        proxy=False,
        height=850,
        width="100%",
        base_url=None,
        start=True,
    ):
        self.datasource = datasource
        self.data_dir = Path(data_dir or os.environ.get("MINERVA_DATA_PATH", _default_data_dir())).expanduser().resolve()
        self.proxy = proxy
        self.height = height
        self.width = width
        self._jupyter_base_url = _clean_base_url(base_url) if base_url is not None else _jupyter_base_url()
        self._port = None
        if start:
            self.start()

    @classmethod
    def from_files(
        cls,
        name,
        image,
        segmentation,
        features,
        x,
        y,
        id_column="CellID",
        celltype_column=None,
        channel_names=None,
        copy=False,
        data_dir=None,
        **viewer_kwargs,
    ):
        resolved_data_dir = Path(data_dir or os.environ.get("MINERVA_DATA_PATH", _default_data_dir())).expanduser().resolve()
        register_datasource(
            name=name,
            image=image,
            segmentation=segmentation,
            features=features,
            x=x,
            y=y,
            id_column=id_column,
            celltype_column=celltype_column,
            channel_names=channel_names,
            copy=copy,
            data_dir=resolved_data_dir,
        )
        return cls(datasource=name, data_dir=resolved_data_dir, **viewer_kwargs)

    def start(self):
        if self._port is not None:
            return self._port
        port = _free_port()
        base_url = f"{self._jupyter_base_url}proxy/{port}" if self.proxy else ""
        self._port = _start_server(self.data_dir, base_url, port=port)
        return self._port

    @property
    def _proxied_base_url(self):
        if self._port is None:
            return ""
        return f"{self._jupyter_base_url}proxy/{self._port}"

    @property
    def url(self):
        self.start()
        if self.proxy:
            return f"{self._proxied_base_url}/{self.datasource}"
        return f"http://127.0.0.1:{self._port}/{self.datasource}"

    def iframe(self):
        try:
            from IPython.display import HTML
        except ImportError:
            return self._repr_html_()
        return HTML(self._repr_html_())

    def open(self):
        webbrowser.open(self.url)
        return self.url

    def _repr_html_(self):
        src = html.escape(self.url, quote=True)
        width = html.escape(str(self.width), quote=True)
        height = int(self.height)
        return (
            f'<iframe src="{src}" width="{width}" height="{height}" '
            'style="border: 0; width: 100%;" allowfullscreen></iframe>'
        )
