"""
Boundary Value Analysis (BVA) Testing Suite for WalletPay API.
Tests mathematical edge cases, precision limits, and boundary thresholds.
"""

import pytest


def test_boundary_minimum_valid_amount(client):
    """Verify minimum permissible transaction of ₹1.00 succeeds."""
    payload = {
        "transaction_id": "TXN_BVA_MIN_01",
        "sender_id": "U001",
        "receiver_id": "U002",
        "amount": 1.00
    }
    res = client.post('/api/transfer', json=payload)
    assert res.status_code == 200
    data = res.get_json()
    assert data['status'] == 'success'
    assert data['sender_balance'] == 4999.00


def test_boundary_zero_amount(client):
    """Verify ₹0.00 transfer is rejected with HTTP 400."""
    payload = {
        "transaction_id": "TXN_BVA_ZERO",
        "sender_id": "U001",
        "receiver_id": "U002",
        "amount": 0.00
    }
    res = client.post('/api/transfer', json=payload)
    assert res.status_code == 400
    data = res.get_json()
    assert data['status'] == 'error'
    assert data['error_code'] == 'INVALID_AMOUNT'


def test_boundary_negative_amount(client):
    """Verify negative amount (-₹50.00) is rejected with HTTP 400."""
    payload = {
        "transaction_id": "TXN_BVA_NEG",
        "sender_id": "U001",
        "receiver_id": "U002",
        "amount": -50.00
    }
    res = client.post('/api/transfer', json=payload)
    assert res.status_code == 400
    data = res.get_json()
    assert data['status'] == 'error'
    assert data['error_code'] == 'INVALID_AMOUNT'


def test_boundary_sub_rupee_amount(client):
    """Verify sub-rupee amount (₹0.50 < ₹1.00) is rejected."""
    payload = {
        "transaction_id": "TXN_BVA_SUB_RUPEE",
        "sender_id": "U001",
        "receiver_id": "U002",
        "amount": 0.50
    }
    res = client.post('/api/transfer', json=payload)
    assert res.status_code == 400
    data = res.get_json()
    assert data['status'] == 'error'
    assert data['error_code'] == 'INVALID_AMOUNT'


def test_boundary_exact_available_balance(client):
    """Verify transferring 100% of available balance (₹5,000.00) succeeds and leaves ₹0.00."""
    payload = {
        "transaction_id": "TXN_BVA_EXACT_BAL",
        "sender_id": "U001",
        "receiver_id": "U002",
        "amount": 5000.00
    }
    res = client.post('/api/transfer', json=payload)
    assert res.status_code == 200
    data = res.get_json()
    assert data['status'] == 'success'
    assert data['sender_balance'] == 0.00
    assert data['receiver_balance'] == 7000.00


def test_boundary_overdraft_by_one_cent(client):
    """Verify transfer of ₹5,000.01 (₹0.01 over balance) is rejected."""
    payload = {
        "transaction_id": "TXN_BVA_OVERDRAFT_1C",
        "sender_id": "U001",
        "receiver_id": "U002",
        "amount": 5000.01
    }
    res = client.post('/api/transfer', json=payload)
    assert res.status_code == 400
    data = res.get_json()
    assert data['status'] == 'error'
    assert data['error_code'] == 'INSUFFICIENT_FUNDS'


def test_boundary_excessive_amount_upper_limit(client):
    """Verify transfer exceeding safety limit (₹10,000,000) is rejected."""
    payload = {
        "transaction_id": "TXN_BVA_UPPER_LIMIT",
        "sender_id": "U001",
        "receiver_id": "U002",
        "amount": 10000000.00
    }
    res = client.post('/api/transfer', json=payload)
    assert res.status_code == 400
    data = res.get_json()
    assert data['status'] == 'error'


def test_boundary_valid_two_decimal_precision(client):
    """Verify valid two-decimal currency amount (₹12.34) succeeds."""
    payload = {
        "transaction_id": "TXN_BVA_PRECISION_2",
        "sender_id": "U001",
        "receiver_id": "U002",
        "amount": 12.34
    }
    res = client.post('/api/transfer', json=payload)
    assert res.status_code == 200
    data = res.get_json()
    assert data['status'] == 'success'
    assert data['sender_balance'] == 4987.66


def test_boundary_invalid_three_decimal_precision(client):
    """Verify invalid three-decimal currency amount (₹12.345) is rejected."""
    payload = {
        "transaction_id": "TXN_BVA_PRECISION_3",
        "sender_id": "U001",
        "receiver_id": "U002",
        "amount": 12.345
    }
    res = client.post('/api/transfer', json=payload)
    assert res.status_code == 400
    data = res.get_json()
    assert data['status'] == 'error'
    assert data['error_code'] == 'INVALID_DECIMAL_PRECISION'
