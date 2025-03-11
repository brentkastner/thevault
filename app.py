from flask import Flask, request, jsonify, send_from_directory, session, send_file
from flask_jwt_extended import JWTManager, create_access_token, jwt_required, get_jwt_identity
from database import db
from flask_cors import CORS
from models import Vault, EncryptedAsset
from sessions import set_vault_session
import secrets, json, io,os


app = Flask(__name__, static_folder='static', static_url_path='/')
app.secret_key = secrets.token_urlsafe(32)
app.config["JWT_SECRET_KEY"] = secrets.token_urlsafe(32)  # Secure JWT key
jwt = JWTManager(app)

base_url = os.environ.get('HOSTNAME') or 'http://127.0.0.1:5000/'

CORS(app, resources={r"/vaults/*": {"origins": base_url}})

print(f"Starting server with {base_url}")

app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///vaultdb.sqlite3'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

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
def create_vault():
    data = request.json
    vault = Vault(id=data['id'], salt=data['salt'])
    db.session.add(vault)
    db.session.commit()
    access_token = create_access_token(identity=vault.id)
    diceware_key = ' '.join(secrets.choice(DICEWARE_WORD_LIST) for _ in range(6))
    #deprecate vault.id for access_token once it's all wired up and working
    return jsonify({'diceware': diceware_key, 'id': vault.id, 'jwt': access_token}), 201

@app.route('/vaults/', methods=['GET'])
@jwt_required()
def get_vault_from_token():
    vault_id = get_jwt_identity()
    vault = Vault.query.get(vault_id)
    if vault is None:
        return jsonify({'error': 'Vault not found'}), 404
    return jsonify({'id': vault.id, 'salt': vault.salt, 'created_at': vault.created_at})

@app.route('/vault/assets', methods=['POST'])
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

if __name__ == '__main__':
    with app.app_context():
        db.create_all()
    app.run(debug=True)