import os
import base64
import secrets

from dotenv import load_dotenv
from cryptography.hazmat.primitives.ciphers.aead import AESGCM


# Load variables from backend/.env
BASE_DIR = os.path.dirname(
    os.path.dirname(
        os.path.dirname(os.path.abspath(__file__))
    )
)

load_dotenv(os.path.join(BASE_DIR, ".env"))


def get_encryption_key():
    """Get and validate the AES-256 encryption key."""

    key_string = os.getenv("ENCRYPTION_KEY")

    if not key_string:
        raise ValueError("ENCRYPTION_KEY is not configured.")

    try:
        key = base64.urlsafe_b64decode(key_string)
    except Exception:
        raise ValueError("ENCRYPTION_KEY is not valid Base64.")

    if len(key) != 32:
        raise ValueError("ENCRYPTION_KEY must decode to exactly 32 bytes.")

    return key


def encrypt_data(data: bytes):
    """
    Encrypt data using AES-256-GCM.

    Returns:
        nonce: random value needed for decryption
        ciphertext: encrypted data
    """

    key = get_encryption_key()

    # AES-GCM uses a unique nonce for every encryption
    nonce = secrets.token_bytes(12)

    aes = AESGCM(key)

    ciphertext = aes.encrypt(
        nonce,
        data,
        None
    )

    return nonce, ciphertext


def decrypt_data(nonce: bytes, ciphertext: bytes):
    """Decrypt AES-256-GCM encrypted data."""

    key = get_encryption_key()

    aes = AESGCM(key)

    plaintext = aes.decrypt(
        nonce,
        ciphertext,
        None
    )

    return plaintext