"""
Database Consistency & Transaction Integrity Testing Suite.
Verifies ACID properties, mathematical conservation of money, and atomic rollback.
"""

import pytest
import database


def test_system_wealth_conservation_invariant(client):
    """
    Verify the Conservation of Wealth Law:
    Sum of all user balances in the system before a transfer MUST strictly
    equal the sum after the transfer. No money can be created or destroyed.
    """
    # 1. Measure initial total wealth
    res_accounts = client.get('/api/accounts').get_json()
    initial_total = sum(u['balance'] for u in res_accounts['users'])
    assert initial_total == 7000.0  # Alice (₹5,000) + Bob (₹2,000)

    # 2. Perform transfer
    payload = {
        "transaction_id": "TXN_CONSERVE_001",
        "sender_id": "U001",
        "receiver_id": "U002",
        "amount": 1250.75
    }
    res_transfer = client.post('/api/transfer', json=payload)
    assert res_transfer.status_code == 200

    # 3. Measure total wealth again
    res_accounts_after = client.get('/api/accounts').get_json()
    final_total = sum(u['balance'] for u in res_accounts_after['users'])
    assert final_total == initial_total == 7000.0


def test_system_consistency_endpoint(client):
    """Verify system consistency audit endpoint validates database balance integrity."""
    res = client.get('/api/system/consistency')
    assert res.status_code == 200
    data = res.get_json()
    assert data['is_consistent'] is True
    assert data['status'] == 'CONSISTENT'
    assert data['total_system_balance_rupees'] == 7000.0


def test_failed_transfer_does_not_mutate_balance_or_ledger(client):
    """
    Verify that an invalid transfer (insufficient funds) leaves both balances
    untouched and does NOT record a COMPLETED transaction in the ledger.
    """
    payload = {
        "transaction_id": "TXN_FAIL_NO_SIDE_EFFECTS",
        "sender_id": "U001",
        "receiver_id": "U002",
        "amount": 99999.0
    }
    res = client.post('/api/transfer', json=payload)
    assert res.status_code == 400

    # Verify Alice's balance
    alice = client.get('/api/balance/U001').get_json()['user']
    bob = client.get('/api/balance/U002').get_json()['user']
    assert alice['balance'] == 5000.0
    assert bob['balance'] == 2000.0

    # Verify no transaction with this ID exists in completed transactions
    txns = client.get('/api/transactions').get_json()['transactions']
    matching = [t for t in txns if t['transaction_id'] == 'TXN_FAIL_NO_SIDE_EFFECTS']
    assert len(matching) == 0


def test_simulated_fault_injection_and_reset(client):
    """Verify testing engine can simulate faults and toggle back to secure state."""
    # Enable bypass of self-transfer check
    res_fault = client.post('/api/test/simulate-fault', json={
        "fault": "bypass_self_transfer",
        "enabled": True
    })
    assert res_fault.status_code == 200
    assert res_fault.get_json()['simulated_faults']['bypass_self_transfer'] is True

    # Reset faults
    res_reset = client.post('/api/test/simulate-fault', json={
        "fault": "all_reset"
    })
    assert res_reset.status_code == 200
    assert res_reset.get_json()['simulated_faults']['bypass_self_transfer'] is False
