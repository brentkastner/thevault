from pydantic import BaseModel
from datetime import datetime

class VaultCreate(BaseModel):
    id: str
    salt: str

class Vault(BaseModel):
    id: str
    salt: str
    created_at: datetime

class EncryptedAssetCreate(BaseModel):
    asset_name: str
    asset_type: str
    content: bytes
    iv: bytes

class EncryptedAsset(BaseModel):
    id: int
    asset_name: str
    asset_type: str
    vault_id: str
    uploaded_at: datetime