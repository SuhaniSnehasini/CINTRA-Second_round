from cryptography.exceptions import InvalidTag

import pytest

from app.services.encryption_service import (
    encrypt_data,
    decrypt_data,
)


def test_encryption_and_decryption():
    original_data = b"CINTRA confidential evidence"

    nonce, encrypted_data = encrypt_data(original_data)

    assert encrypted_data != original_data

    decrypted_data = decrypt_data(
        nonce,
        encrypted_data
    )

    assert decrypted_data == original_data


def test_every_encryption_uses_different_nonce():
    original_data = b"CINTRA evidence"

    nonce1, encrypted1 = encrypt_data(original_data)
    nonce2, encrypted2 = encrypt_data(original_data)

    assert nonce1 != nonce2
    assert encrypted1 != encrypted2


def test_tampered_data_is_rejected():
    original_data = b"CINTRA evidence"

    nonce, encrypted_data = encrypt_data(original_data)

    tampered_data = bytearray(encrypted_data)
    tampered_data[0] ^= 1

    with pytest.raises(InvalidTag):
        decrypt_data(
            nonce,
            bytes(tampered_data)
        )