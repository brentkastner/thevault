async function loginVault() {
    const vaultId = document.getElementById('vault-id-input').value;
    const password = document.getElementById('password-input').value;

    if (!vaultId || !password) {
        alert('Please enter both Vault ID and Password.');
        return;
    }

    const encoder = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
        'raw', encoder.encode(password), { name: 'PBKDF2' }, false, ['deriveBits']
    );

    const hashBuffer = await crypto.subtle.deriveBits(
        {
            name: 'PBKDF2',
            salt: encoder.encode(vaultId),
            iterations: 100000,
            hash: 'SHA-256'
        },
        keyMaterial,
        256
    );

    const hashedId = Array.from(new Uint8Array(hashBuffer))
                          .map(b => b.toString(16).padStart(2, '0'))
                          .join('');

    const response = await fetch(`/vaults/`, {
        headers: { 'Authorization': 'Bearer ' + hashedId }
    });
    if (response.ok) {
        const vault = await response.json();
        sessionStorage.setItem('vault_token', hashedId);
        window.location.href = '/vault.html';
    } else {
        alert('Invalid Vault ID or Password.');
    }
}