from minerva_analysis import app, db
from sqlalchemy.orm import relationship
from sqlalchemy import func
from sqlalchemy.orm import relationship
import io
import numpy as np
from minerva_analysis import app, db

# Via https://stackoverflow.com/questions/2546207/does-sqlalchemy-have-an-equivalent-of-djangos-get-or-create
def create(model, **kwargs):
    instance = model(**kwargs)
    db.session.add(instance)
    db.session.commit()
    return instance

#scoope2screen
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

#visinity
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

#visinity
def delete(model, **kwargs):
    to_delete = db.session.query(model).filter_by(**kwargs).order_by(model.id).all()
    for elem in to_delete:
        db.session.delete(elem)
    db.session.commit()

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

#visinity
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

#visinity
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


#scope2screen
class Dot(db.Model):
    __tablename__ = 'Dots'
    id = db.Column(db.Integer, primary_key=True)
    date = db.Column(db.DateTime)
    group = db.Column(db.String(40))
    datasource = db.Column(db.String(80), unique=False, nullable=False)
    name = db.Column(db.String(40))
    description = db.Column(db.String(140))
    shape_type = db.Column(db.String(20))
    # Contains information about lens, e.g. screen_x, screen_y, radius
    shape_info = db.Column(db.PickleType())
    image_data = db.Column(db.PickleType())
    # Contains IDs in lense
    cell_ids = db.Column(db.PickleType())
    viewer_info = db.Column(db.PickleType())
    channel_info = db.Column(db.PickleType())
    is_deleted = db.Column(db.Boolean, default=False, nullable=False)



with app.app_context():
    db.create_all()
