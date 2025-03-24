async function loginVault() {
    const vaultId = document.getElementById('vault-id-input').value;
    const password = document.getElementById('password-input').value;

    if (!vaultId || !password) {
        showErrorOverlay('Please enter both Vault ID and Password.');
        return;
    }

    const encoder = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
        'raw', encoder.encode(vaultId+password), { name: 'PBKDF2' }, false, ['deriveBits']
    );

    const hashBuffer = await crypto.subtle.deriveBits(
        {
            name: 'PBKDF2',
            salt: encoder.encode(vaultId+password),
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
            showErrorOverlay('Invalid Vault ID or Password.');
        }
    } catch (error) {
        console.error('Error during login:', error);
        showErrorOverlay('Login failed. Please try again.');
    }
}

document.addEventListener('DOMContentLoaded', function() {
    const loginButton = document.getElementById('login-button');
    if (loginButton) {
        loginButton.addEventListener('click', loginVault);
    }
    
    // Add other event listeners here
    const closeOverlay = document.getElementById('closeOverlay');
    if (closeOverlay) {
        closeOverlay.addEventListener('click', hideErrorOverlay);
    }
    const closeOverlayBTN = document.getElementById('closeOverlayBTN');
    if (closeOverlayBTN) {
        closeOverlayBTN.addEventListener('click', hideErrorOverlay);
    }
});

// Show Error Overlay with Custom Message
function showErrorOverlay(message) {
    document.getElementById('error-message').textContent = message;
    document.getElementById('error-overlay').classList.remove('hidden');
}

// Hide Error Overlay
function hideErrorOverlay() {
    document.getElementById('error-overlay').classList.add('hidden');
}