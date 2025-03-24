async function createVault() {
    const vaultId = document.getElementById('vaultId').value;
    const password = document.getElementById('password').value;

    if (!vaultId || !password) {
        showErrorOverlay('Please enter both Vault ID and Password.');
        return;
    }

    const salt = crypto.getRandomValues(new Uint8Array(16));
    const encoder = new TextEncoder();

    const keyMaterial = await crypto.subtle.importKey(
        'raw',
        encoder.encode(vaultId+password),
        { name: 'PBKDF2' },
        false,
        ['deriveBits']
    );

    const keyBuffer = await crypto.subtle.deriveBits(
        {
            name: 'PBKDF2',
            salt: encoder.encode(vaultId+password),
            iterations: 600000,
            hash: 'SHA-512'
        },
        keyMaterial,
        256
    );

    const hashedId = arrayBufferToHex(keyBuffer);

    const payload = { id: hashedId, salt: arrayBufferToHex(salt) };

    const response = await fetch('/vaults/', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(payload),
        credentials: 'include' // Add this to handle cookies
    });

    if (response.ok) {
        const data = await response.json();
        sessionStorage.setItem('diceware', data.diceware);
        window.location.href = '/diceware';
    } else {
        const error = await response.json();
        alert('Error: ' + error.error);
    }
}

function arrayBufferToHex(buffer) {
    return Array.from(new Uint8Array(buffer))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
}

document.addEventListener('DOMContentLoaded', function() {
    const createButton = document.getElementById('create-button');
    if (createButton) {
        createButton.addEventListener('click', createVault);
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