"""
Locust Performance and Load Testing Script for WalletPay API.
Simulates realistic concurrent user behavior across the Digital Wallet endpoints.

Usage:
  locust -f locustfile.py --host=http://127.0.0.1:5001
  Open browser at http://127.0.0.1:8089 to start load test.
"""

import uuid
import random
from locust import HttpUser, task, between


class WalletPayUser(HttpUser):
    # Wait between 0.5 and 2.0 seconds between tasks to simulate human pacing
    wait_time = between(0.5, 2.0)

    @task(5)
    def view_balance(self):
        """High frequency: Users frequently check their wallet balance."""
        user_id = random.choice(["U001", "U002"])
        with self.client.get(f"/api/balance/{user_id}", name="/api/balance/[user_id]", catch_response=True) as response:
            if response.status_code == 200:
                response.success()
            else:
                response.failure(f"Failed to fetch balance: {response.status_code}")

    @task(3)
    def view_transaction_history(self):
        """Medium frequency: Users review past transactions."""
        user_id = random.choice(["U001", "U002"])
        with self.client.get(f"/api/transactions/{user_id}", name="/api/transactions/[user_id]", catch_response=True) as response:
            if response.status_code == 200:
                response.success()
            else:
                response.failure(f"Failed to fetch history: {response.status_code}")

    @task(2)
    def check_system_health(self):
        """Periodic monitoring probe."""
        self.client.get("/api/health", name="/api/health")

    @task(1)
    def execute_money_transfer(self):
        """Simulate peer-to-peer transfers with dynamic transaction IDs."""
        sender, receiver = ("U001", "U002") if random.random() > 0.5 else ("U002", "U001")
        amount = round(random.uniform(1.0, 50.0), 2)
        txn_id = f"LOCUST_{uuid.uuid4().hex[:12].upper()}"

        payload = {
            "transaction_id": txn_id,
            "sender_id": sender,
            "receiver_id": receiver,
            "amount": amount
        }

        with self.client.post("/api/transfer", json=payload, name="/api/transfer", catch_response=True) as response:
            if response.status_code in [200, 400]:
                # 400 is acceptable under heavy load if sender has insufficient funds
                response.success()
            else:
                response.failure(f"Unexpected status: {response.status_code}")
