from flask import (Flask, render_template)
import json

app = Flask(__name__)


@app.route("/")
def my_index():
    return render_template("index.html", data={'database': '', 'databases': get_config_names()})

@app.route('/<string:database>')
def cycifExplorer(database):
    databases = get_config_names()
    if database not in databases:
        database = ''
    return render_template('index.html', data={'database': database, 'databases': databases})

def get_config_names():
    with open('./static/data/config.json') as f:
        data = json.load(f)
    return [key for key in data.keys()]


if __name__ == "__main__":
    app.config['TEMPLATES_AUTO_RELOAD'] = True
app.run(debug=True, use_reloader=True)
