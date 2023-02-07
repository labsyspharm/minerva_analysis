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


def edit(model, id, edit_field, edit_value):
    instance = get(model, id=id)
    instance.__setattr__(edit_field, edit_value)
    db.session.commit()


def get_all(model, **kwargs):
    return db.session.query(model).filter_by(is_deleted=False, **kwargs).order_by(model.id).all()


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


def save_list(model, **kwargs):
    if 'cells' in kwargs:
        cells = kwargs['cells']
        del kwargs['cells']

    instance = db.session.query(model).filter_by(**kwargs).one_or_none()
    if instance:
        instance.__setattr__('cells', cells)
        db.session.commit()
        return instance
    else:
        instance = model(cells=cells, **kwargs)
        db.session.add(instance)
        db.session.commit()
        return instance


class ChannelList(db.Model):
    __tablename__ = 'channelList'
    id = db.Column(db.Integer, primary_key=True)
    datasource = db.Column(db.String(80), unique=False, nullable=False)
    cells = db.Column(db.LargeBinary, default={}, nullable=False)
    is_deleted = db.Column(db.Boolean, default=False, nullable=False)


class GatingList(db.Model):
    __tablename__ = 'gatinglist'
    id = db.Column(db.Integer, primary_key=True)
    datasource = db.Column(db.String(80), unique=False, nullable=False)
    cells = db.Column(db.LargeBinary, default={}, nullable=False)
    is_deleted = db.Column(db.Boolean, default=False, nullable=False)


with app.app_context():
    db.create_all()
