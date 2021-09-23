from minerva_analysis import app, db
from sqlalchemy.orm import relationship
from sqlalchemy import func

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


def max(model, column):
    return db.session.query(func.max(getattr(model, column))).scalar()


def edit(model, id, edit_field, edit_value):
    instance = get(model, id=id)
    instance.__setattr__(edit_field, edit_value)
    db.session.commit()


def get_all(model, **kwargs):
    return db.session.query(model).filter_by(is_deleted=False, **kwargs).order_by(model.id).all()


def filter_all(model, filter_params):
    return db.session.query(model).filter(filter_params).filter_by(is_deleted=False).order_by(model.id).all()


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


def delete(model, **kwargs):
    to_delete = db.session.query(model).filter_by(**kwargs).order_by(model.id).all()
    for elem in to_delete:
        db.session.delete(elem)
    db.session.commit()


class Neighborhood(db.Model):
    __tablename__ = 'neighborhood'
    id = db.Column(db.Integer, primary_key=True)
    cluster_id = db.Column(db.Integer, unique=False, nullable=False)
    datasource = db.Column(db.String(80), unique=False, nullable=False)
    source = db.Column(db.String(80), unique=False, nullable=False)
    custom = db.Column(db.Boolean, default=False)
    is_deleted = db.Column(db.Boolean, default=False, nullable=False)
    name = db.Column(db.String(80), unique=False, nullable=False)
    cells = db.Column(db.LargeBinary, nullable=False)


class NeighborhoodStats(db.Model):
    __tablename__ = 'neighborhoodstats'
    id = db.Column(db.Integer, primary_key=True)
    neighborhood_id = db.Column(db.Integer, db.ForeignKey('neighborhood.id'))
    neighborhood = relationship("Neighborhood", backref=db.backref("neighborhood", uselist=False))
    datasource = db.Column(db.String(80), unique=False, nullable=False)
    source = db.Column(db.String(80), unique=False, nullable=False)
    custom = db.Column(db.Boolean, default=False)

    is_deleted = db.Column(db.Boolean, default=False, nullable=False)
    name = db.Column(db.String(80), unique=False, nullable=False)
    stats = db.Column(db.LargeBinary, nullable=False)


db.create_all()
