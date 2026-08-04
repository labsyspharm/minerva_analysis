import argparse
import os


def main(argv=None):
    parser = argparse.ArgumentParser(description="Run Minerva Analysis as a notebook-friendly sidecar server.")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", default="8000")
    parser.add_argument("--data-dir", default=None)
    parser.add_argument("--base-url", default=None)
    parser.add_argument("--notebook-mode", action="store_true")
    args = parser.parse_args(argv)

    if args.data_dir:
        os.environ["MINERVA_DATA_PATH"] = args.data_dir
    if args.base_url is not None:
        os.environ["MINERVA_BASE_URL"] = args.base_url
    if args.notebook_mode:
        os.environ["MINERVA_NOTEBOOK_MODE"] = "1"

    from waitress import serve
    from minerva_analysis import app

    app.config["MINERVA_NOTEBOOK_MODE"] = args.notebook_mode or app.config.get("MINERVA_NOTEBOOK_MODE", False)
    print(f"Serving Minerva Analysis on {args.host}:{args.port}")
    serve(
        app,
        host=args.host,
        port=int(args.port),
        max_request_body_size=1073741824000000,
        max_request_header_size=85899345920000,
        threads=8,
    )


if __name__ == "__main__":
    main()
