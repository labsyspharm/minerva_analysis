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


def create_or_update(model, **kwargs):
    instance = get(model, id=kwargs['id'])
    if instance:
        instance = model(**kwargs)
    else:
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


class Dot(db.Model):
    __tablename__ = 'Dots'
    id = db.Column(db.Integer, primary_key=True)
    group = db.Column(db.String(40))
    datasource = db.Column(db.String(80), unique=False, nullable=False)
    name = db.Column(db.String(40))
    description = db.Column(db.String(140))
    shape_type = db.Column(db.String(20))
    # Contains information about lense, e.g. screen_x, screen_y, radius
    shape_info = db.Column(db.PickleType())
    # Contains IDs in lense
    cell_ids = db.Column(db.PickleType())
    viewer_info = db.Column(db.PickleType())
    channel_info = db.Column(db.PickleType())



db.create_all()
