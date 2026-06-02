/* ----------------------------------------------------
   CLIENT-SIDE CRYPTOGRAPHY MODULE (js/crypto.js)
---------------------------------------------------- */

// Helper: Convert array buffer to Hex string
function bufToHex(buffer) {
  return Array.prototype.map.call(new Uint8Array(buffer), x => ('00' + x.toString(16)).slice(-2)).join('');
}

// Helper: Convert Hex string to Uint8Array
function hexToBuf(hexString) {
  const bytes = new Uint8Array(hexString.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hexString.substr(i * 2, 2), 16);
  }
  return bytes;
}

// Helper: Import base password as cryptographic material
async function getPasswordKey(password) {
  const enc = new TextEncoder();
  return window.crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveBits", "deriveKey"]
  );
}

// Helper: Derive AES key from raw password key using PBKDF2
async function deriveKey(passwordKey, salt) {
  return window.crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt,
      iterations: 100000,
      hash: "SHA-256"
    },
    passwordKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

/**
 * Encrypt a plaintext string using a password.
 * Returns a colon-separated hex string containing: salt:iv:ciphertext
 */
export async function encryptKey(plaintext, password) {
  try {
    const enc = new TextEncoder();
    const salt = window.crypto.getRandomValues(new Uint8Array(16));
    const iv = window.crypto.getRandomValues(new Uint8Array(12));

    const passwordKey = await getPasswordKey(password);
    const aesKey = await deriveKey(passwordKey, salt);

    const ciphertextBuffer = await window.crypto.subtle.encrypt(
      {
        name: "AES-GCM",
        iv: iv
      },
      aesKey,
      enc.encode(plaintext)
    );

    const saltHex = bufToHex(salt);
    const ivHex = bufToHex(iv);
    const ciphertextHex = bufToHex(ciphertextBuffer);

    return `${saltHex}:${ivHex}:${ciphertextHex}`;
  } catch (error) {
    console.error("Encryption failed:", error);
    throw new Error("Failed to encrypt API key.");
  }
}

/**
 * Decrypt a cipher format (salt:iv:ciphertext) using a password.
 * Returns the decrypted plaintext string.
 */
export async function decryptKey(cipherTextStr, password) {
  try {
    const parts = cipherTextStr.split(":");
    if (parts.length !== 3) {
      throw new Error("Invalid cipher text format.");
    }

    const salt = hexToBuf(parts[0]);
    const iv = hexToBuf(parts[1]);
    const ciphertext = hexToBuf(parts[2]);

    const passwordKey = await getPasswordKey(password);
    const aesKey = await deriveKey(passwordKey, salt);

    const dec = new TextDecoder();
    const decryptedBuffer = await window.crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv: iv
      },
      aesKey,
      ciphertext
    );

    return dec.decode(decryptedBuffer);
  } catch (error) {
    console.error("Decryption failed:", error);
    throw new Error("Decryption failed. Please check your passphrase.");
  }
}
