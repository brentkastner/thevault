from flask import session

def set_vault_session(vault_id):
    session['vault_id'] = vault_id

def get_vault_session():
    return session.get('vault_id', None)

def clear_vault_session():
    session.pop('vault_id', None)