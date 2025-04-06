from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import event
from sqlalchemy.engine import Engine

#Set PRAGMAS for SQLite
@event.listens_for(Engine, "connect")
def _set_sqlite_WAL_pragma(dbapi_connection, connection_record):
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA journal_mode=WAL")
    cursor.close()

db = SQLAlchemy()