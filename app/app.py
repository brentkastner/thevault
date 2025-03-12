from flask import Flask, request, jsonify, send_from_directory, session, send_file
from flask_jwt_extended import JWTManager, create_access_token, jwt_required, get_jwt_identity, unset_jwt_cookies
from database import db
from flask_cors import CORS
from models import Vault, EncryptedAsset
from sessions import set_vault_session
import secrets, json, io,os
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from datetime import timedelta


app = Flask(__name__, static_folder='static', static_url_path='/')
app.secret_key = secrets.token_urlsafe(32)
app.config["JWT_SECRET_KEY"] = os.environ.get("JWT_SECRET_KEY", secrets.token_urlsafe(32)) # Secure JWT key
app.config["JWT_ACCESS_TOKEN_EXPIRES"] = os.environ.get("JWT_KEY_TIMEOUT", timedelta(minutes=30)) #JWT Timeout in minutes
app.config['SQLALCHEMY_DATABASE_URI'] = os.environ.get("SQLITE_DB", 'sqlite:///vaultdb.sqlite3')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
debug_mode = os.environ.get('FLASK_DEBUG', 'false').lower() in ['true', '1']
print(f"Flask Debug env = {os.environ.get('FLASK_DEBUG')}")
jwt = JWTManager(app)

base_url = os.environ.get('HOSTNAME') or 'http://127.0.0.1:5000/'

CORS(app, resources={r"*": {"origins": base_url}})
limiter = Limiter(get_remote_address, app=app, default_limits=["100 per minute"])

print(f"Starting server with {base_url}, and debug mode set to {debug_mode}")

db.init_app(app)
CORS(app)

with app.app_context():
    db.create_all()

# Load Diceware words and strip numbering
with open('wordlist/wordlist.txt', 'r') as file:
    DICEWARE_WORD_LIST = [line.strip().split('\t')[1] for line in file if '\t' in line]

@app.route('/')
def serve_index():
    return app.send_static_file('index.html')

@app.route('/diceware')
def serve_diceware():
    return app.send_static_file('diceware.html')

@app.route('/<path:path>')
def serve_static(path):
    return app.send_static_file(path)

@app.route('/vault')
def serve_vault():
    return app.send_static_file('vault.html')

@app.route('/vaults/', methods=['POST'])
@limiter.limit("5 per minute")
def create_vault():
    data = request.json
    vault = Vault(id=data['id'], salt=data['salt'])
    db.session.add(vault)
    db.session.commit()
    access_token = create_access_token(identity=vault.id)
    diceware_key = ' '.join(secrets.choice(DICEWARE_WORD_LIST) for _ in range(6))
    return jsonify({'diceware': diceware_key, 'id': vault.id, 'jwt': access_token}), 201

@app.route('/vaults/', methods=['GET'])
@limiter.limit("10 per minute")
@jwt_required()
def get_vault_from_token():
    vault_id = get_jwt_identity()
    vault = Vault.query.get(vault_id)
    if vault is None:
        return jsonify({'error': 'Vault not found'}), 404
    return jsonify({'id': vault.id, 'salt': vault.salt, 'created_at': vault.created_at})

@app.route('/vault/assets', methods=['POST'])
@limiter.limit("5 per minute")
@jwt_required()
def upload_encrypted_asset():
    vault_id = get_jwt_identity()
    vault = Vault.query.get(vault_id)
    if not vault:
        return jsonify({'error': 'Invalid vault token'}), 403

    data = request.json
    encrypted_asset = EncryptedAsset(
        vault_id=vault_id,
        asset_name=data['asset_name'],
        asset_type=data['asset_type'],
        content=json.dumps(data['content']).encode('utf-8')
    )
    db.session.add(encrypted_asset)
    db.session.commit()

    return jsonify({'status': 'success', 'asset_id': encrypted_asset.id}), 201

@app.route('/vault/assets', methods=['GET'])
@jwt_required()
def list_encrypted_assets():
    vault_id = get_jwt_identity()
    assets = EncryptedAsset.query.filter_by(vault_id=vault_id).all()
    asset_list = [{
        'id': asset.id,
        'asset_name': asset.asset_name,
        'asset_type': asset.asset_type,
        'uploaded_at': asset.uploaded_at
    } for asset in assets]

    return jsonify(asset_list)

@app.route('/vault/assets/<int:asset_id>', methods=['GET'])
@jwt_required()
def get_encrypted_asset(asset_id):
    vault_id = get_jwt_identity()
    asset = EncryptedAsset.query.filter_by(vault_id=vault_id, id=asset_id).first()
    if not asset:
        return jsonify({'error': 'Asset not found'}), 404

    return jsonify({
        'id': asset.id,
        'asset_name': asset.asset_name,
        'asset_type': asset.asset_type,
        'content': json.loads(asset.content)
    })

@app.route('/login/', methods=['POST'])
def login():
    vault_id = request.headers.get('Authorization', '').replace('Bearer ', '')
    if not vault_id:
        return jsonify({'error': 'Invalid or missing token'}), 401
    access_token = create_access_token(identity=vault_id)
    return jsonify({'status': 'success', 'jwt': access_token}), 201

@app.route('/logout/', methods=['POST'])
def logout():
    response = jsonify({'message': 'Logged out'})
    unset_jwt_cookies(response)  # Remove JWT from cookies when we move from session storage to cookie storage for JWT WIP #TODO
    return response, 200

#@app.after_request
#def add_security_headers(response):
#    response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains; preload"
#    response.headers["Content-Security-Policy"] = "default-src, script-src-elem' 'self'"
#    response.headers["X-Frame-Options"] = "DENY"
#    response.headers["X-Content-Type-Options"] = "nosniff"
#    response.headers["Referrer-Policy"] = "no-referrer"
#    return response


if __name__ == '__main__':
    with app.app_context():
        db.create_all()
    app.run(debug=debug_mode)