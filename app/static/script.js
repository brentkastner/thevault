async function createVault() {
    const vaultId = document.getElementById('vaultId').value;
    const password = document.getElementById('password').value;

    const salt = crypto.getRandomValues(new Uint8Array(16));
    const encoder = new TextEncoder();

    const keyMaterial = await crypto.subtle.importKey(
        'raw',
        encoder.encode(password),
        { name: 'PBKDF2' },
        false,
        ['deriveBits']
    );

    const keyBuffer = await crypto.subtle.deriveBits(
        {
            name: 'PBKDF2',
            salt: encoder.encode(vaultId),
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
});