"""
Security Testing & Defect Prevention Suite for WalletPay API.
Tests protection against SQL injection, XSS vectors, and ensures security headers.
"""

import pytest


def test_sql_injection_defense_sender_id(client):
    """
    Verify parameterized queries safely reject SQL injection string in sender_id
    without database crash or unauthorized data leakage.
    """
    payload = {
        "transaction_id": "TXN_SEC_SQLI_01",
        "sender_id": "' OR '1'='1' --",
        "receiver_id": "U002",
        "amount": 100.0
    }
    res = client.post('/api/transfer', json=payload)
    assert res.status_code == 404
    data = res.get_json()
    assert data['status'] == 'error'
    assert data['error_code'] == 'SENDER_NOT_FOUND'


def test_sql_injection_defense_transaction_id(client):
    """Verify SQL injection in transaction_id is treated as literal text and handled safely."""
    payload = {
        "transaction_id": "TXN'; DROP TABLE users; --",
        "sender_id": "U001",
        "receiver_id": "U002",
        "amount": 10.0
    }
    res = client.post('/api/transfer', json=payload)
    # The transaction should process safely as a literal string or be handled without dropping tables
    # Verify users table is still fully intact:
    res_accounts = client.get('/api/accounts')
    assert res_accounts.status_code == 200
    assert len(res_accounts.get_json()['users']) >= 2


def test_http_security_headers_present(client):
    """Verify essential HTTP security headers are injected into API responses."""
    res = client.get('/api/health')
    assert res.headers.get('X-Content-Type-Options') == 'nosniff'
    assert res.headers.get('X-Frame-Options') == 'SAMEORIGIN'
    assert res.headers.get('X-XSS-Protection') == '1; mode=block'
    assert res.headers.get('Access-Control-Allow-Origin') == '*'


def test_error_responses_do_not_leak_internal_paths(client):
    """Verify error responses do not disclose raw file paths or database credentials."""
    res = client.get('/non_existent_api_endpoint_xyz')
    assert res.status_code == 404
    body = res.get_data(as_text=True)
    assert 'Traceback (most recent call last)' not in body
    assert 'wallet.db' not in body
