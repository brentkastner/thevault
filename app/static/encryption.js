async function getKey(passphrase, salt) {
    const encoder = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
        'raw', encoder.encode(passphrase), { name: 'PBKDF2' }, false, ['deriveKey']
    );

    return crypto.subtle.deriveKey(
        { name: 'PBKDF2', salt: encoder.encode(salt), iterations: 600000, hash: 'SHA-512' },
        keyMaterial,
        { name: 'AES-GCM', length: 256 },
        true,
        ['encrypt', 'decrypt']
    );
}

function getCSRFToken() {
    // Option 1: Extract from a cookie that Flask-JWT-Extended sets
    return getCookie('csrf_access_token');
}

function getCookie(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(';').shift();
}

async function loadAssets() {
    const response = await fetch('/vault/assets', {
        credentials: 'include',  // This tells the browser to send cookies with the request
        headers: {
            'X-CSRF-TOKEN': getCSRFToken()  // Function to get CSRF token from cookie or DOM
        }
    });
    const items = await response.json();

    const itemList = document.getElementById('item-list');
    itemList.innerHTML = '';

    items.forEach(item => {
        const li = document.createElement('li');
        li.textContent = `${item.asset_name} (${item.asset_type}) `;

        const button = document.createElement('button');
        button.classList.add("decrypt-btn");
        button.textContent = item.asset_type === 'note' ? 'Show Note' : 'Download & Decrypt';
        
        // ✅ Set data attributes to store asset details
        button.setAttribute("data-asset-id", item.id);
        button.setAttribute("data-asset-name", item.asset_name);
        button.setAttribute("data-asset-type", item.asset_type);

        li.appendChild(button);
        itemList.appendChild(li);
    });

    // ✅ Setup decryption button listeners
    setupDecryptionButtons();
}

async function uploadAsset() {
    const passphrase = document.getElementById('passphrase').value;
    const note = document.getElementById('note-input').value;
    const file = document.getElementById('file-input').files[0];

    if (!passphrase) {
        alert('Please enter your diceware passphrase.');
        return;
    }

    const vaultResponse = await fetch('/vaults/', {
        credentials: 'include',
        headers: {
            'X-CSRF-TOKEN': getCSRFToken()
        },
    });

    const { salt } = await vaultResponse.json();
    const key = await getKey(passphrase, salt);

    let asset_name, asset_type, content;

    if (file) {
        asset_name = file.name;
        asset_type = 'file';
        content = new Uint8Array(await file.arrayBuffer());
    } else if (note) {
        asset_name = 'note_' + Date.now();
        asset_type = 'note';
        content = new TextEncoder().encode(note);
    } else {
        alert('Please provide a file or a note to upload.');
        return;
    }

    // Encrypt the data
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encrypted = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv: iv }, key, content
    );

    // Create FormData object
    const formData = new FormData();
    formData.append('asset_name', asset_name);
    formData.append('asset_type', asset_type);
    formData.append('encrypted_data', new Blob([encrypted], { type: 'application/octet-stream' }));
    formData.append('iv', new Blob([iv], { type: 'application/octet-stream' }));

    const response = await fetch('/vault/assets', {
        method: 'POST',
        credentials: 'include',  // This tells the browser to send cookies with the request
        headers: {
            'X-CSRF-TOKEN': getCSRFToken()  // Function to get CSRF token from cookie or DOM
        },
        body: formData
    });

    if (response.ok) {
        window.location.href = '/vault.html';
        //loadAssets();
    } else {
        const error = await response.json();
        alert('Error: ' + error.error);
    }
}

let decryptAssetId = null;
let decryptAssetName = null;
let decryptAssetType = null;

/**
 * ✅ Opens the Diceware modal only when decryption is requested.
 */
function openDicewareModal(asset_id, asset_name, asset_type) {
    decryptAssetId = asset_id;
    decryptAssetName = asset_name;
    decryptAssetType = asset_type;
    
    document.getElementById("diceware-modal").style.display = "flex";
}

/**
 * ✅ Closes the Diceware modal.
 */
function closeDicewareModal() {
    document.getElementById("diceware-modal").style.display = "none";
}

/**
 * ✅ Handles Diceware passphrase submission and decryption.
 */
async function submitDiceware() {
    const passphrase = document.getElementById("diceware-input").value;
    if (!passphrase) {
        alert("Please enter your Diceware passphrase.");
        return;
    }
    
    closeDicewareModal(); // Close modal after input
    
    await decryptAsset(decryptAssetId, decryptAssetName, decryptAssetType, passphrase);
}

/**
 * ✅ Calls `openDicewareModal` when user clicks decrypt button.
 */
function setupDecryptionButtons() {
    document.querySelectorAll(".decrypt-btn").forEach(button => {
        button.addEventListener("click", function () {
            const assetId = this.getAttribute("data-asset-id");
            const assetName = this.getAttribute("data-asset-name");
            const assetType = this.getAttribute("data-asset-type");
            openDicewareModal(assetId, assetName, assetType);
        });
    });
}


/**
 * Handles decryption after retrieving the passphrase.
 */
async function decryptAsset(asset_id, asset_name, asset_type, passphrase) {
    // Fetch vault-specific salt
    const saltResponse = await fetch('/vaults/', {
        credentials: 'include',
        headers: {
            'X-CSRF-TOKEN': getCSRFToken()
        },
    });

    if (!saltResponse.ok) {
        alert('Error fetching vault details.');
        return;
    }

    const { salt } = await saltResponse.json();

    // Fetch encrypted asset
    const response = await fetch(`/vault/assets/${asset_id}`, {
        credentials: 'include',  // This tells the browser to send cookies with the request
        headers: {
            'X-CSRF-TOKEN': getCSRFToken()  // Function to get CSRF token from cookie or DOM
        }
    });

    if (!response.ok) {
        alert('Error fetching asset.');
        return;
    }

    const asset = await response.json();

    // Derive encryption key using passphrase + salt
    const key = await getKey(passphrase, salt);

    try {
        // Convert base64 back to binary
        const ivArray = Uint8Array.from(atob(asset.iv), c => c.charCodeAt(0));
        const encryptedData = Uint8Array.from(atob(asset.content), c => c.charCodeAt(0));
        
        // Decrypt the data
        const decryptedContent = await crypto.subtle.decrypt(
            { name: 'AES-GCM', iv: ivArray },
            key,
            encryptedData
        );

        if (asset_type === 'note') {
            const decoder = new TextDecoder("utf-8");
            const noteText = decoder.decode(decryptedContent);

            document.getElementById("decrypted-notes-section").style.display = "block";

            const decryptedNotesContainer = document.getElementById("decrypted-notes");
            const noteElement = document.createElement("div");
            noteElement.classList.add("decrypted-note");
            noteElement.textContent = noteText;
            decryptedNotesContainer.prepend(noteElement);
        } else {
            const blob = new Blob([new Uint8Array(decryptedContent)]);
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = asset_name;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }
    } catch (e) {
        console.error(e);
        alert('Decryption failed. Check your passphrase.');
    }
}


async function logout() {
    try {
        // Send logout request with credentials to ensure cookies are sent
        const response = await fetch('/logout/', { 
            method: 'POST', 
            credentials: 'include',
            headers: {
                'X-CSRF-TOKEN': getCSRFToken()  // Include CSRF token for POST request
            }
        });
        
        if (!response.ok) {
            console.error('Logout failed:', await response.text());
        }
        
        // No need to remove anything from sessionStorage
        // Just redirect to login page
        window.location.href = 'index.html';
    } catch (error) {
        console.error('Error during logout:', error);
        alert('Failed to logout. Please try again.');
    }
}

// Check token validity periodically
setInterval(async () => {
    // Make a lightweight call to check if session is still valid
    try {
        const response = await fetch('/check-session', {
            credentials: 'include'
        });
        if (!response.ok) {
            alert("Session expired. Logging out.");
            logout();
        }
    } catch (error) {
        console.error("Error checking session:", error);
    }
}, 60000); // Every 60 seconds

document.addEventListener('DOMContentLoaded', loadAssets);

document.addEventListener('DOMContentLoaded', function() {
    loadAssets();

    const logoutButton = document.getElementById('logout-button');
    if (logoutButton) {
        logoutButton.addEventListener('click', logout);
    }

    const uploadButton = document.getElementById('upload-button');
    if (uploadButton) {
        uploadButton.addEventListener('click', uploadAsset);
    }
    
    const modalButton = document.getElementById('modal-button');
    if (modalButton) {
        modalButton.addEventListener('click', submitDiceware);
    }

    const modalButtonCancel = document.getElementById('modal-button-cancel');
    if (modalButtonCancel) {
        modalButtonCancel.addEventListener('click', closeDicewareModal);
    }
    // Add other event listeners here
});