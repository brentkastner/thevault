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
            iterations: 600000,
            hash: 'SHA-512'
        },
        keyMaterial,
        256
    );

    const hashedId = Array.from(new Uint8Array(hashBuffer))
                          .map(b => b.toString(16).padStart(2, '0'))
                          .join('');

    try {
        const response = await fetch(`/login/`, {
            method: 'POST',
            headers: { 'Authorization': 'Bearer ' + hashedId },
            credentials: 'include' // Include cookies in the request/response
        });
        
        if (response.ok) {
            // No need to extract and store JWT - it's in the cookie now
            window.location.href = '/vault';
        } else {
            alert('Invalid Vault ID or Password.');
        }
    } catch (error) {
        console.error('Error during login:', error);
        alert('Login failed. Please try again.');
    }
}

document.addEventListener('DOMContentLoaded', function() {
    const loginButton = document.getElementById('login-button');
    if (loginButton) {
        loginButton.addEventListener('click', loginVault);
    }
    
    // Add other event listeners here
});