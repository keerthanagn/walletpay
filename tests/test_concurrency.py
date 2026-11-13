"""
Concurrency, Race Condition & Stress Testing Suite for WalletPay API.
Simulates high-volume concurrent transactions to rigorously verify:
1. Zero Double-Spending: Alice cannot overdraw her account under simultaneous load.
2. ACID Transaction Serialization: SQLite write locks and table constraints prevent race hazards.
3. System Wealth Conservation: Total money remains exactly constant under concurrent load.
"""

import time
import pytest
from concurrent.futures import ThreadPoolExecutor, as_completed
from app import app
import database


def test_concurrent_transfers_double_spending_protection():
    """
    Simulates 50 simultaneous transfer requests of ₹500 each from Alice (₹5,000 balance).
    Expected Outcome:
    - Alice has ₹5,000. Each transfer is ₹500.
    - Exactly 10 transfers MUST succeed (10 * ₹500 = ₹5,000).
    - Exactly 40 transfers MUST be rejected (insufficient funds).
    - Alice's final balance MUST be exactly ₹0.00 (NEVER negative!).
    - Bob's final balance MUST be exactly ₹7,000.00.
    - Total wealth in the system MUST remain exactly ₹7,000.00 (Zero double spending).
    """
    # 1. Reset database to initial known state
    database.init_db(reset=True)

    num_threads = 50
    transfer_amount = 500.00

    def attempt_transfer(index):
        # Use a fresh test client per thread
        with app.test_client() as client:
            payload = {
                "transaction_id": f"TXN_CONCURRENT_{index:03d}_{int(time.time()*1000)}",
                "sender_id": "U001",
                "receiver_id": "U002",
                "amount": transfer_amount
            }
            res = client.post('/api/transfer', json=payload)
            return res.status_code, res.get_json()

    # 2. Fire 50 concurrent threads simultaneously
    results = []
    with ThreadPoolExecutor(max_workers=10) as executor:
        futures = [executor.submit(attempt_transfer, i) for i in range(num_threads)]
        for f in as_completed(futures):
            results.append(f.result())

    # 3. Analyze results
    success_count = sum(1 for status, _ in results if status == 200)
    failed_count = sum(1 for status, _ in results if status in (400, 409, 500))

    # 4. Invariant Assertions
    assert success_count == 10, f"Expected exactly 10 transfers to succeed, but {success_count} succeeded!"
    assert failed_count == 40, f"Expected 40 transfers to fail, but {failed_count} failed!"

    # 5. Check final database balances
    with app.test_client() as client:
        res_alice = client.get('/api/balance/U001').get_json()
        res_bob = client.get('/api/balance/U002').get_json()

        alice_balance = res_alice['user']['balance']
        bob_balance = res_bob['user']['balance']

        assert alice_balance == 0.00, f"Alice balance should be 0.00, got {alice_balance}"
        assert bob_balance == 7000.00, f"Bob balance should be 7000.00, got {bob_balance}"
        assert (alice_balance + bob_balance) == 7000.00, "Wealth conservation invariant violated!"
