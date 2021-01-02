from cycif_viewer import app, db
from sqlalchemy.orm import relationship

import io
import numpy as np


# Via https://stackoverflow.com/questions/2546207/does-sqlalchemy-have-an-equivalent-of-djangos-get-or-create
def create(model, **kwargs):
    instance = model(**kwargs)
    db.session.add(instance)
    db.session.commit()
    return instance


def get(model, **kwargs):
    return db.session.query(model).filter_by(**kwargs).one_or_none()


def get_all(model, **kwargs):
    return db.session.query(model).filter_by(**kwargs).order_by(model.id).all()


def get_or_create(model, **kwargs):
    if 'cells' in kwargs:
        cells = kwargs['cells']
        del kwargs['cells']
    instance = db.session.query(model).filter_by(**kwargs).one_or_none()
    if instance:
        return instance
    else:
        instance = model(cells=cells, **kwargs)
        db.session.add(instance)
        db.session.commit()
        return instance


class Neighborhood(db.Model):
    __tablename__ = 'neighborhood'
    id = db.Column(db.Integer, primary_key=True)
    datasource = db.Column(db.String(80), unique=False, nullable=False)
    is_cluster = db.Column(db.Boolean, default=False, nullable=False)
    name = db.Column(db.String(80), unique=False, nullable=False)
    cells = db.Column(db.LargeBinary, nullable=False)


class NeighborhoodStats(db.Model):
    __tablename__ = 'neighborhoodstats'
    id = db.Column(db.Integer, primary_key=True)
    neighborhood_id = db.Column(db.Integer, db.ForeignKey('neighborhood.id'))
    neighborhood = relationship("Neighborhood", backref=db.backref("neighborhood", uselist=False))
    datasource = db.Column(db.String(80), unique=False, nullable=False)
    is_cluster = db.Column(db.Boolean, default=False, nullable=False)
    name = db.Column(db.String(80), unique=False, nullable=False)
    stats = db.Column(db.LargeBinary, nullable=False)


db.create_all()

## TEST CRAP


test_arr = np.array([1, 2, 3])
f = io.BytesIO()
np.save(f, test_arr)
test_hood = get_or_create(Neighborhood, datasource='test', name='test_neighborhood',
                          cells=f.getvalue())
# guest = User(username='guest', email='guest@example.com')
#
# # db.session.add(test_hood)
# # db.session.commit()
#
# val = Neighborhood.query.filter_by(datasource='test').first()
# reloading = np.load(io.BytesIO(val.cells))
# test = ''
