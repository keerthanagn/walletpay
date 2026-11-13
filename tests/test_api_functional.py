"""
Functional Testing Suite for WalletPay API.
Tests core business logic, happy paths, and expected functional rejections.
"""

import json
import pytest


def test_api_health(client):
    """Verify system health endpoint returns 200 OK and database status."""
    res = client.get('/api/health')
    assert res.status_code == 200
    data = res.get_json()
    assert data['status'] == 'healthy'
    assert data['database'] == 'connected'


def test_get_all_accounts(client):
    """Verify retrieving all user accounts with initial balances."""
    res = client.get('/api/accounts')
    assert res.status_code == 200
    data = res.get_json()
    assert data['status'] == 'success'
    assert len(data['users']) >= 2
    user_ids = [u['user_id'] for u in data['users']]
    assert 'U001' in user_ids
    assert 'U002' in user_ids


def test_get_individual_balance(client):
    """Verify specific user balance check for Alice (₹5,000)."""
    res = client.get('/api/balance/U001')
    assert res.status_code == 200
    data = res.get_json()
    assert data['status'] == 'success'
    assert data['user']['user_id'] == 'U001'
    assert data['user']['balance'] == 5000.0


def test_successful_transfer(client):
    """Verify valid money transfer between Alice and Bob."""
    payload = {
        "transaction_id": "TXN_FUNC_001",
        "sender_id": "U001",
        "receiver_id": "U002",
        "amount": 500.0
    }
    res = client.post('/api/transfer', json=payload)
    assert res.status_code == 200
    data = res.get_json()
    assert data['status'] == 'success'
    assert data['sender_balance'] == 4500.0
    assert data['receiver_balance'] == 2500.0

    # Verify balances persisted
    res_alice = client.get('/api/balance/U001').get_json()
    res_bob = client.get('/api/balance/U002').get_json()
    assert res_alice['user']['balance'] == 4500.0
    assert res_bob['user']['balance'] == 2500.0


def test_insufficient_funds_rejection(client):
    """Verify transfer exceeding sender's balance is rejected with HTTP 400."""
    payload = {
        "transaction_id": "TXN_FUNC_002",
        "sender_id": "U001",
        "receiver_id": "U002",
        "amount": 6000.0
    }
    res = client.post('/api/transfer', json=payload)
    assert res.status_code == 400
    data = res.get_json()
    assert data['status'] == 'error'
    assert data['error_code'] == 'INSUFFICIENT_FUNDS'

    # Balances must remain unchanged
    res_alice = client.get('/api/balance/U001').get_json()
    assert res_alice['user']['balance'] == 5000.0


def test_invalid_sender_user(client):
    """Verify non-existent sender ID returns HTTP 404."""
    payload = {
        "transaction_id": "TXN_FUNC_003",
        "sender_id": "U999_NON_EXISTENT",
        "receiver_id": "U002",
        "amount": 100.0
    }
    res = client.post('/api/transfer', json=payload)
    assert res.status_code == 404
    data = res.get_json()
    assert data['status'] == 'error'
    assert data['error_code'] == 'SENDER_NOT_FOUND'


def test_invalid_receiver_user(client):
    """Verify non-existent receiver ID returns HTTP 404."""
    payload = {
        "transaction_id": "TXN_FUNC_004",
        "sender_id": "U001",
        "receiver_id": "U888_NON_EXISTENT",
        "amount": 100.0
    }
    res = client.post('/api/transfer', json=payload)
    assert res.status_code == 404
    data = res.get_json()
    assert data['status'] == 'error'
    assert data['error_code'] == 'RECEIVER_NOT_FOUND'


def test_self_transfer_rejection(client):
    """Verify transfer where sender == receiver is rejected with HTTP 400."""
    payload = {
        "transaction_id": "TXN_FUNC_005",
        "sender_id": "U001",
        "receiver_id": "U001",
        "amount": 100.0
    }
    res = client.post('/api/transfer', json=payload)
    assert res.status_code == 400
    data = res.get_json()
    assert data['status'] == 'error'
    assert data['error_code'] == 'SELF_TRANSFER'


def test_duplicate_transaction_id_prevention(client):
    """Verify duplicate transaction ID returns HTTP 409 Conflict."""
    payload = {
        "transaction_id": "TXN_DUPLICATE_GUARD",
        "sender_id": "U001",
        "receiver_id": "U002",
        "amount": 100.0
    }
    # First attempt: succeeds
    res1 = client.post('/api/transfer', json=payload)
    assert res1.status_code == 200

    # Second attempt with same transaction ID: MUST be rejected
    res2 = client.post('/api/transfer', json=payload)
    assert res2.status_code == 409
    data2 = res2.get_json()
    assert data2['status'] == 'error'
    assert data2['error_code'] == 'DUPLICATE_TRANSACTION_ID'


def test_transaction_history_audit(client):
    """Verify transaction history records successful transfers accurately."""
    payload = {
        "transaction_id": "TXN_HISTORY_AUDIT",
        "sender_id": "U001",
        "receiver_id": "U002",
        "amount": 250.0
    }
    client.post('/api/transfer', json=payload)

    res = client.get('/api/transactions')
    assert res.status_code == 200
    data = res.get_json()
    assert data['status'] == 'success'
    assert len(data['transactions']) >= 1
    txn = data['transactions'][0]
    assert txn['transaction_id'] == 'TXN_HISTORY_AUDIT'
    assert txn['amount'] == 250.0
    assert txn['status'] == 'SUCCESS'
