async function login() {
    const vaultId = document.getElementById('vaultId').value;
    const password = document.getElementById('password').value;

    // Use WebCrypto API for secure hashing
    const encoder = new TextEncoder();
    const keyMaterial = await window.crypto.subtle.importKey(
        "raw",
        encoder.encode(password),
        {name: "PBKDF2"},
        false,
        ["deriveBits", "deriveKey"]
    );

    const key = await window.crypto.subtle.deriveKey(
        {name: "PBKDF2", salt: encoder.encode(vaultId), iterations: 100000, hash: "SHA-256"},
        keyMaterial,
        {name: "AES-GCM", length: 256},
        true,
        ["encrypt", "decrypt"]
    );

    console.log('Vault key generated:', key);
    // Proceed with authentication or API calls
}

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
            iterations: 100000,
            hash: 'SHA-256'
        },
        keyMaterial,
        256
    );

    const hashedId = arrayBufferToHex(keyBuffer);

    const payload = { id: hashedId, salt: arrayBufferToHex(salt) };

    const response = await fetch('/vaults/', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(payload)
    });

    if (response.ok) {
        const data = await response.json();
        sessionStorage.setItem('diceware', data.diceware);
        sessionStorage.setItem('jwt', data.jwt);
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