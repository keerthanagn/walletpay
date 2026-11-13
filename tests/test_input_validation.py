"""
Input Validation and Negative Testing Suite for WalletPay API.
Tests rejection of malformed payloads, type violations, and missing parameters.
"""

import pytest


def test_missing_transaction_id(client):
    """Verify request missing transaction_id is rejected with HTTP 400."""
    payload = {
        "sender_id": "U001",
        "receiver_id": "U002",
        "amount": 100.0
    }
    res = client.post('/api/transfer', json=payload)
    assert res.status_code == 400
    data = res.get_json()
    assert data['status'] == 'error'
    assert data['error_code'] == 'MISSING_FIELD'


def test_missing_sender_id(client):
    """Verify request missing sender_id is rejected with HTTP 400."""
    payload = {
        "transaction_id": "TXN_VAL_NO_SENDER",
        "receiver_id": "U002",
        "amount": 100.0
    }
    res = client.post('/api/transfer', json=payload)
    assert res.status_code == 400
    data = res.get_json()
    assert data['status'] == 'error'
    assert data['error_code'] == 'MISSING_FIELD'


def test_missing_receiver_id(client):
    """Verify request missing receiver_id is rejected with HTTP 400."""
    payload = {
        "transaction_id": "TXN_VAL_NO_RECEIVER",
        "sender_id": "U001",
        "amount": 100.0
    }
    res = client.post('/api/transfer', json=payload)
    assert res.status_code == 400
    data = res.get_json()
    assert data['status'] == 'error'
    assert data['error_code'] == 'MISSING_FIELD'


def test_missing_amount_field(client):
    """Verify request missing amount is rejected with HTTP 400."""
    payload = {
        "transaction_id": "TXN_VAL_NO_AMOUNT",
        "sender_id": "U001",
        "receiver_id": "U002"
    }
    res = client.post('/api/transfer', json=payload)
    assert res.status_code == 400
    data = res.get_json()
    assert data['status'] == 'error'
    assert data['error_code'] == 'MISSING_FIELD'


def test_empty_string_transaction_id(client):
    """Verify whitespace or empty transaction ID is rejected."""
    payload = {
        "transaction_id": "   ",
        "sender_id": "U001",
        "receiver_id": "U002",
        "amount": 100.0
    }
    res = client.post('/api/transfer', json=payload)
    assert res.status_code == 400
    data = res.get_json()
    assert data['status'] == 'error'
    assert data['error_code'] == 'EMPTY_TRANSACTION_ID'


def test_boolean_amount_type_coercion_guard(client):
    """Verify boolean amount (True/False) is rejected and not coerced to 1.0 or 0.0."""
    payload = {
        "transaction_id": "TXN_VAL_BOOL",
        "sender_id": "U001",
        "receiver_id": "U002",
        "amount": True
    }
    res = client.post('/api/transfer', json=payload)
    assert res.status_code == 400
    data = res.get_json()
    assert data['status'] == 'error'
    assert data['error_code'] == 'INVALID_DATA_TYPE'


def test_non_numeric_string_amount(client):
    """Verify non-numeric string amount is rejected with HTTP 400."""
    payload = {
        "transaction_id": "TXN_VAL_STR_AMT",
        "sender_id": "U001",
        "receiver_id": "U002",
        "amount": "one_hundred_rupees"
    }
    res = client.post('/api/transfer', json=payload)
    assert res.status_code == 400
    data = res.get_json()
    assert data['status'] == 'error'
    assert data['error_code'] in ['INVALID_DATA_TYPE', 'INVALID_AMOUNT']


def test_malformed_json_body(client):
    """Verify non-JSON or malformed payload returns HTTP 400."""
    res = client.post(
        '/api/transfer',
        data='{malformed_json: true,}',
        content_type='application/json'
    )
    assert res.status_code == 400
    data = res.get_json()
    assert data['status'] == 'error'
