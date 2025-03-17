from database import db
from datetime import datetime

class Vault(db.Model):
    id = db.Column(db.String(256), primary_key=True)
    salt = db.Column(db.String(64), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

class EncryptedAsset(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    vault_id = db.Column(db.String(256), db.ForeignKey('vault.id'))
    asset_uuid = db.Column(db.String(256))
    asset_name = db.Column(db.String(256))
    asset_type = db.Column(db.String(10))
    content = db.Column(db.LargeBinary)
    iv = db.Column(db.LargeBinary) 
    uploaded_at = db.Column(db.DateTime, default=datetime.utcnow)