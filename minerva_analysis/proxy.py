import os
import sys


def setup_minerva_analysis():
    data_dir = os.environ.get("MINERVA_DATA_PATH", "")
    command = [
        sys.executable,
        "-m",
        "minerva_analysis.server_cli",
        "--host",
        "127.0.0.1",
        "--port",
        "{port}",
        "--base-url",
        "{base_url}minerva-analysis",
        "--notebook-mode",
    ]
    if data_dir:
        command.extend(["--data-dir", data_dir])

    return {
        "command": command,
        "absolute_url": False,
        "new_browser_tab": False,
        "timeout": 30,
        "launcher_entry": {
            "enabled": True,
            "title": "Minerva Analysis",
            "path_info": "",
        },
    }
