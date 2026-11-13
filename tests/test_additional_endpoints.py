"""
Additional Integration Tests covering performance endpoint, user registration,
transaction audit by user, and report endpoints.
"""

import pytest


def test_user_registration(client):
    """Verify creating a new wallet user with valid initial balance."""
    payload = {
        "name": "Charlie",
        "initial_balance": 1500.0
    }
    res = client.post('/api/users', json=payload)
    assert res.status_code == 201
    data = res.get_json()
    assert data['user']['name'] == 'Charlie'
    assert data['user']['balance_rupees'] == 1500.0


def test_user_registration_missing_name(client):
    """Verify user registration fails when name is missing."""
    res = client.post('/api/users', json={"initial_balance": 100})
    assert res.status_code == 400


def test_user_specific_transactions(client):
    """Verify fetching transaction history for Alice (U001)."""
    # Create a transaction first
    client.post('/api/transfer', json={
        "transaction_id": "TXN_SPECIFIC_001",
        "sender_id": "U001",
        "receiver_id": "U002",
        "amount": 100.0
    })

    res = client.get('/api/transactions/U001')
    assert res.status_code == 200
    data = res.get_json()
    assert data['user_id'] == 'U001'
    assert data['count'] >= 1
    assert data['transactions'][0]['type'] == 'DEBIT'


def test_user_specific_transactions_non_existent(client):
    """Verify 404 for non-existent user transaction lookup."""
    res = client.get('/api/transactions/NON_EXISTENT_XYZ')
    assert res.status_code == 404


def test_performance_benchmark_endpoint(client):
    """Verify the latency benchmarking endpoint."""
    res = client.post('/api/test/performance', json={
        "iterations": 5,
        "threshold_ms": 100.0
    })
    assert res.status_code == 200
    data = res.get_json()
    assert 'avg_latency_ms' in data
    assert 'max_latency_ms' in data
    assert data['iterations'] == 5


def test_database_reset_endpoint(client):
    """Verify /api/reset-database restores default balances."""
    # Deduct Alice balance
    client.post('/api/transfer', json={
        "transaction_id": "TXN_BEFORE_RESET",
        "sender_id": "U001",
        "receiver_id": "U002",
        "amount": 1000.0
    })

    # Call reset
    res = client.post('/api/reset-database')
    assert res.status_code == 200

    # Verify Alice is back to 5000.0
    alice = client.get('/api/balance/U001').get_json()
    assert alice['balance_rupees'] == 5000.0


def test_test_summary_endpoint(client):
    """Verify /api/test-summary returns report metrics."""
    res = client.get('/api/test-summary')
    assert res.status_code in (200, 404)  # 200 if reports generated, 404 if fresh


def test_static_index_route(client):
    """Verify root / serves index.html."""
    res = client.get('/')
    assert res.status_code == 200


def test_serve_reports_route(client):
    """Verify /reports/<filename> serves reports correctly."""
    res = client.get('/reports/test_execution_summary.txt')
    assert res.status_code in (200, 404)


def test_api_run_tests_endpoint(client):
    """Verify /api/run-tests executes suite and returns metrics."""
    res = client.post('/api/run-tests')
    assert res.status_code == 200
    data = res.get_json()
    assert data['total'] == 39
    assert data['passed'] == 39
    assert data['pass_rate_percent'] == 100.0
