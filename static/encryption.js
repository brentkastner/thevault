//document.getElementById('vault-token').innerText = sessionStorage.getItem('jwt');

async function getKey(passphrase, salt) {
    const encoder = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
        'raw', encoder.encode(passphrase), { name: 'PBKDF2' }, false, ['deriveKey']
    );

    return crypto.subtle.deriveKey(
        { name: 'PBKDF2', salt: encoder.encode(salt), iterations: 100000, hash: 'SHA-256' },
        keyMaterial,
        { name: 'AES-GCM', length: 256 },
        true,
        ['encrypt', 'decrypt']
    );
}

async function encryptData(key, data) {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encrypted = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv: iv }, key, data
    );
    return { iv: Array.from(iv), data: Array.from(new Uint8Array(encrypted)) };
}

async function loadAssets() {
    const vault_token = sessionStorage.getItem('jwt');
    const response = await fetch('/vault/assets', {
        headers: { 'Authorization': 'Bearer ' + vault_token }
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
    const vault_token = sessionStorage.getItem('jwt');
    const passphrase = document.getElementById('passphrase').value;
    const note = document.getElementById('note-input').value;
    const file = document.getElementById('file-input').files[0];

    if (!passphrase) {
        alert('Please enter your diceware passphrase.');
        return;
    }

    const vaultResponse = await fetch('/vaults/', {
        headers: { 'Authorization': 'Bearer ' + vault_token }
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

    const encryptedAsset = await encryptData(key, content);

    const payload = {
        asset_name: asset_name,
        asset_type: asset_type,
        content: encryptedAsset
    };

    const response = await fetch('/vault/assets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json',
                   'Authorization': 'Bearer ' + vault_token
         },
        body: JSON.stringify(payload)
    });

    if (response.ok) {
        window.location.href = '/vault.html';
        //loadAssets();
    } else {
        const error = await response.json();
        alert('Error: ' + error.error);
    }
}


async function decryptData(key, encrypted) {
    const iv = new Uint8Array(encrypted.iv);
    const data = new Uint8Array(encrypted.data);
    const decrypted = await crypto.subtle.decrypt(
        {name: 'AES-GCM', iv: iv}, key, data
    );
    return new Uint8Array(decrypted);
}

//deprecated for the modal
async function downloadAndDecrypt(asset_id, asset_name) {
    const passphrase = prompt("Enter your diceware passphrase to decrypt:");
    if (!passphrase) return;

    const vault_token = sessionStorage.getItem('vault_token');
    const vaultResponse = await fetch('/vaults/', {
        headers: { 'Authorization': 'Bearer ' + vault_token }
    });

    const { salt } = await vaultResponse.json();

    const response = await fetch(`/vault/assets/${asset_id}`, {
        headers: { 'Authorization': 'Bearer ' + vault_token }
    });
    if (!response.ok) {
        alert('Failed to fetch asset.');
        return;
    }

    const asset = await response.json();
    const key = await getKey(passphrase, salt);

    try {
        const decryptedContent = await decryptData(key, asset.content);

        if (asset.asset_type === 'note') {
            // Display note content inline
            const decoder = new TextDecoder();
            const noteText = decoder.decode(decryptedContent);
            
            // ✅ Display decrypted notes section if hidden
            const decryptedNotesSection = document.getElementById("decrypted-notes-section");
            decryptedNotesSection.style.display = "block";

            // ✅ Append decrypted note to section
            const decryptedNotesContainer = document.getElementById("decrypted-notes");

            const noteElement = document.createElement("div");
            noteElement.classList.add("decrypted-note");
            noteElement.textContent = noteText;

            decryptedNotesContainer.prepend(noteElement);
        } else {
            const blob = new Blob([decryptedContent]);
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
        alert('Decryption failed. Incorrect passphrase or corrupted asset.');
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
    const vault_token = sessionStorage.getItem('jwt');

    // Fetch vault-specific salt
    const saltResponse = await fetch('/vaults/', {
        headers: { 'Authorization': 'Bearer ' + vault_token }
    });

    if (!saltResponse.ok) {
        alert('Error fetching vault details.');
        return;
    }

    const { salt } = await saltResponse.json();

    // Fetch encrypted asset
    const response = await fetch(`/vault/assets/${asset_id}`, {
        headers: { 'Authorization': 'Bearer ' + vault_token }
    });

    if (!response.ok) {
        alert('Error fetching asset.');
        return;
    }

    const asset = await response.json();

    // Derive encryption key using passphrase + salt
    const key = await getKey(passphrase, salt);

    try {
        const decryptedContent = await decryptData(key, asset.content);

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
            const blob = new Blob([decryptedContent]);
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


function logout() {
    sessionStorage.removeItem('vault_token');
    sessionStorage.removeItem('jwt');
    window.location.href = 'index.html';
}

// Check token validity periodically
setInterval(() => {
    const token = sessionStorage.getItem('jwt');
    if (!token) {
        alert("Session expired. Logging out.");
        logout();
    }
}, 60000); // Every 60 seconds

document.addEventListener('DOMContentLoaded', loadAssets);