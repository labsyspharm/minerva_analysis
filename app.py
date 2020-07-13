from flask import (Flask, render_template)

app = Flask(__name__)


@app.route("/")
def my_index():
    return render_template("index.html", data={'database': 'test'})


@app.route('/<string:database>')
def cycifExplorer(database):
    return render_template('index.html', data={'database': database})


if __name__ == "__main__":
    app.config['TEMPLATES_AUTO_RELOAD'] = True
    app.run(debug=True, use_reloader=True)
