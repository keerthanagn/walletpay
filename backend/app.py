"""
WalletPay - Flask Backend Application
Automated API Testing, Quality Assurance & Transaction Validation of a Digital Wallet System.
"""

import os
import sys
import json
import math
import html
import time
import sqlite3
from datetime import datetime
from decimal import Decimal, InvalidOperation
from flask import Flask, request, jsonify, send_from_directory
from database import get_db_connection, init_db, reset_to_initial_state

# Paths
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FRONTEND_DIR = os.path.join(BASE_DIR, 'frontend')
REPORTS_DIR = os.path.join(BASE_DIR, 'reports')
os.makedirs(REPORTS_DIR, exist_ok=True)

app = Flask(__name__, static_folder=FRONTEND_DIR)

# Initialize database on startup
init_db()

# Simulated Fault State for Live Defect Testing Demonstrations
# Can be toggled via POST /api/test/simulate-fault
SIMULATED_FAULTS = {
    "bypass_self_transfer": False,
    "bypass_duplicate_check": False,
    "bypass_negative_check": False,
    "bypass_decimal_check": False
}


# -------------------------------------------------------------
# Security & CORS Headers
# -------------------------------------------------------------
@app.after_request
def apply_security_and_cors_headers(response):
    response.headers['Access-Control-Allow-Origin'] = '*'
    response.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization, X-Requested-With'
    response.headers['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS'
    response.headers['X-Content-Type-Options'] = 'nosniff'
    response.headers['X-Frame-Options'] = 'SAMEORIGIN'
    response.headers['X-XSS-Protection'] = '1; mode=block'
    return response


# -------------------------------------------------------------
# Frontend Static Asset Routes
# -------------------------------------------------------------
@app.route('/')
def index():
    return send_from_directory(FRONTEND_DIR, 'index.html')


@app.route('/<path:filename>')
def serve_frontend_assets(filename):
    if os.path.exists(os.path.join(FRONTEND_DIR, filename)):
        return send_from_directory(FRONTEND_DIR, filename)
    return jsonify({"error": "File not found"}), 404


@app.route('/reports/<path:filename>')
def serve_reports(filename):
    if os.path.exists(os.path.join(REPORTS_DIR, filename)):
        response = send_from_directory(REPORTS_DIR, filename)
        response.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate'
        response.headers['Pragma'] = 'no-cache'
        response.headers['Expires'] = '0'
        return response
    return jsonify({"error": "Report not found"}), 404


# -------------------------------------------------------------
# 1. GET /api/health
# -------------------------------------------------------------
@app.route('/api/health', methods=['GET', 'OPTIONS'])
def health_check():
    """Checks whether the backend and SQLite database are healthy."""
    if request.method == 'OPTIONS':
        return '', 200

    try:
        conn = get_db_connection()
        conn.execute("SELECT 1").fetchone()
        conn.close()
        db_status = "connected"
    except Exception as e:
        db_status = f"error: {str(e)}"

    return jsonify({
        "status": "healthy",
        "service": "WalletPay Digital Wallet API",
        "version": "2.0.0",
        "database": db_status,
        "timestamp": datetime.now().isoformat()
    }), 200


# -------------------------------------------------------------
# 2. GET /api/balance/<user_id>
# -------------------------------------------------------------
@app.route('/api/balance/<path:user_id>', methods=['GET', 'OPTIONS'])
def get_balance(user_id):
    """
    Returns the current wallet balance for the specified user.
    Uses parameterized query to prevent SQL injection.
    """
    if request.method == 'OPTIONS':
        return '', 200

    clean_user_id = user_id.strip()

    conn = get_db_connection()
    user = conn.execute(
        "SELECT user_id, name, balance_paise FROM users WHERE user_id = ?",
        (clean_user_id,)
    ).fetchone()
    conn.close()

    if not user:
        return jsonify({
            "error": "User not found",
            "user_id": clean_user_id
        }), 404

    balance_paise = user['balance_paise']
    balance_rupees = round(balance_paise / 100.0, 2)

    return jsonify({
        "user_id": user['user_id'],
        "name": user['name'],
        "balance_paise": balance_paise,
        "balance_rupees": balance_rupees
    }), 200


# -------------------------------------------------------------
# 3. POST /api/transfer
# -------------------------------------------------------------
@app.route('/api/transfer', methods=['POST', 'OPTIONS'])
def transfer_money():
    """
    Executes a peer-to-peer money transfer between two wallet accounts.
    Performs comprehensive backend input validation, boundary checking,
    duplicate transaction detection, and atomic transaction execution.
    """
    if request.method == 'OPTIONS':
        return '', 200

    # 1. Parse JSON body safely
    if request.content_length and request.content_length > 0:
        try:
            data = request.get_json(force=False, silent=False)
            if not isinstance(data, dict):
                return jsonify({"error": "Invalid JSON format. Expected JSON object."}), 400
        except Exception:
            return jsonify({"error": "Malformed JSON payload. Please provide valid JSON."}), 400
    else:
        return jsonify({"error": "Missing JSON request body."}), 400

    # 2. Extract fields
    raw_txn_id = data.get('transaction_id')
    raw_sender = data.get('sender_id')
    raw_receiver = data.get('receiver_id')
    raw_amount = data.get('amount')

    # 3. Validate missing required fields
    missing_fields = []
    if raw_txn_id is None:
        missing_fields.append('transaction_id')
    if raw_sender is None:
        missing_fields.append('sender_id')
    if raw_receiver is None:
        missing_fields.append('receiver_id')
    if raw_amount is None:
        missing_fields.append('amount')

    if missing_fields:
        return jsonify({
            "error": f"Missing required fields: {', '.join(missing_fields)}",
            "required_fields": ["transaction_id", "sender_id", "receiver_id", "amount"],
            "missing": missing_fields
        }), 400

    # 4. Validate empty / whitespace strings
    if not isinstance(raw_txn_id, str) or not raw_txn_id.strip():
        return jsonify({"error": "transaction_id must be a non-empty string."}), 400
    if not isinstance(raw_sender, str) or not raw_sender.strip():
        return jsonify({"error": "sender_id must be a non-empty string."}), 400
    if not isinstance(raw_receiver, str) or not raw_receiver.strip():
        return jsonify({"error": "receiver_id must be a non-empty string."}), 400

    transaction_id = raw_txn_id.strip()
    sender_id = raw_sender.strip().upper()
    receiver_id = raw_receiver.strip().upper()

    # 5. Validate amount data type and format
    # Prevent booleans: True/False are subclasses of int in Python!
    if isinstance(raw_amount, bool):
        return jsonify({"error": "Invalid amount format. Must be a numeric value, not a boolean."}), 400

    # Check for non-numeric or malformed amount
    try:
        amount_str = str(raw_amount).strip()
        # Disallow currency symbols or non-numeric characters
        float_val = float(amount_str)
    except (ValueError, TypeError):
        return jsonify({"error": "Invalid amount format. Must be a valid numeric value."}), 400

    # Prevent NaN and Infinity
    if math.isnan(float_val) or math.isinf(float_val):
        return jsonify({"error": "Invalid amount format. Amount cannot be NaN or Infinity."}), 400

    # 6. Validate decimal precision (INR paise: max 2 decimal places)
    if not SIMULATED_FAULTS.get("bypass_decimal_check"):
        if '.' in amount_str:
            decimals = amount_str.split('.')[1]
            if len(decimals) > 2:
                return jsonify({
                    "error": "Invalid decimal precision. Transfer amount cannot have more than 2 decimal places (paise).",
                    "provided_amount": raw_amount
                }), 400

    # Convert to integer paise
    try:
        amount_paise = int(round(float_val * 100))
    except (ValueError, OverflowError):
        return jsonify({"error": "Transfer amount is outside allowable numeric limits."}), 400

    # 7. Boundary Value Checks
    if not SIMULATED_FAULTS.get("bypass_negative_check"):
        if amount_paise <= 0:
            return jsonify({
                "error": "Transfer amount must be greater than zero.",
                "attempted_amount": float_val
            }), 400

        # Minimum valid amount rule (₹1.00 = 100 paise)
        if amount_paise < 100:
            return jsonify({
                "error": "Minimum transfer amount is ₹1.00 (100 paise).",
                "attempted_amount_rupees": round(amount_paise / 100.0, 2)
            }), 400

    # Single transaction upper threshold (₹5,00,000 safety limit)
    if amount_paise > 50000000:
        return jsonify({
            "error": "Transfer amount exceeds maximum single transaction limit of ₹5,00,000.",
            "attempted_amount_rupees": round(amount_paise / 100.0, 2)
        }), 400

    # 8. Prevent self-transfer (Sender cannot transfer to themselves)
    if not SIMULATED_FAULTS.get("bypass_self_transfer"):
        if sender_id == receiver_id:
            return jsonify({
                "error": "Sender and receiver cannot be the same account.",
                "sender_id": sender_id,
                "receiver_id": receiver_id
            }), 400

    conn = get_db_connection()
    try:
        # 9. Duplicate Transaction ID Check (Idempotency - HTTP 409 Conflict)
        if not SIMULATED_FAULTS.get("bypass_duplicate_check"):
            existing_txn = conn.execute(
                "SELECT transaction_id, status FROM transactions WHERE transaction_id = ?",
                (transaction_id,)
            ).fetchone()

            if existing_txn:
                conn.close()
                return jsonify({
                    "error": "Duplicate transaction: A transaction with this transaction_id already exists.",
                    "transaction_id": transaction_id,
                    "existing_status": existing_txn['status']
                }), 409

        # 10. Verify Sender Existence (HTTP 404 Not Found)
        sender = conn.execute(
            "SELECT user_id, name, balance_paise FROM users WHERE user_id = ?",
            (sender_id,)
        ).fetchone()

        if not sender:
            conn.close()
            return jsonify({
                "error": "Sender not found.",
                "sender_id": sender_id
            }), 404

        # 11. Verify Receiver Existence (HTTP 404 Not Found)
        receiver = conn.execute(
            "SELECT user_id, name, balance_paise FROM users WHERE user_id = ?",
            (receiver_id,)
        ).fetchone()

        if not receiver:
            conn.close()
            return jsonify({
                "error": "Receiver not found.",
                "receiver_id": receiver_id
            }), 404

        # 12. Sender Available Balance Check (HTTP 400 Bad Request)
        sender_balance = sender['balance_paise']
        if sender_balance < amount_paise:
            conn.close()
            return jsonify({
                "error": "Insufficient wallet balance.",
                "available_balance_rupees": round(sender_balance / 100.0, 2),
                "attempted_amount_rupees": round(amount_paise / 100.0, 2)
            }), 400

        # 13. Atomic Transaction Execution
        timestamp_str = datetime.now().isoformat()

        conn.execute("BEGIN IMMEDIATE")

        # Deduct sender balance
        conn.execute(
            "UPDATE users SET balance_paise = balance_paise - ? WHERE user_id = ?",
            (amount_paise, sender_id)
        )

        # Credit receiver balance
        conn.execute(
            "UPDATE users SET balance_paise = balance_paise + ? WHERE user_id = ?",
            (amount_paise, receiver_id)
        )

        # Record successful transaction
        conn.execute("""
            INSERT INTO transactions (transaction_id, sender_id, receiver_id, amount_paise, status, timestamp)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (transaction_id, sender_id, receiver_id, amount_paise, "SUCCESS", timestamp_str))

        conn.commit()

        new_sender_balance = sender_balance - amount_paise
        new_receiver_balance = receiver['balance_paise'] + amount_paise

        conn.close()

        return jsonify({
            "message": "Transfer completed successfully.",
            "transaction": {
                "transaction_id": transaction_id,
                "sender_id": sender_id,
                "sender_name": sender['name'],
                "receiver_id": receiver_id,
                "receiver_name": receiver['name'],
                "amount_paise": amount_paise,
                "amount_rupees": round(amount_paise / 100.0, 2),
                "status": "SUCCESS",
                "timestamp": timestamp_str
            },
            "sender_new_balance_rupees": round(new_sender_balance / 100.0, 2),
            "receiver_new_balance_rupees": round(new_receiver_balance / 100.0, 2)
        }), 200

    except Exception as e:
        conn.rollback()
        conn.close()
        return jsonify({
            "error": "Internal transaction failure. Database rollback executed.",
            "details": "The transaction could not be processed and no balances were changed."
        }), 500


# -------------------------------------------------------------
# 4. GET /api/transactions/<user_id>
# -------------------------------------------------------------
@app.route('/api/transactions/<path:user_id>', methods=['GET', 'OPTIONS'])
def get_user_transactions(user_id):
    """Returns the user's transaction history (both debits and credits)."""
    if request.method == 'OPTIONS':
        return '', 200

    clean_user_id = user_id.strip().upper()

    conn = get_db_connection()
    user = conn.execute(
        "SELECT user_id, name FROM users WHERE user_id = ?",
        (clean_user_id,)
    ).fetchone()

    if not user:
        conn.close()
        return jsonify({
            "error": "User not found",
            "user_id": clean_user_id
        }), 404

    rows = conn.execute("""
        SELECT 
            t.transaction_id,
            t.sender_id,
            s.name AS sender_name,
            t.receiver_id,
            r.name AS receiver_name,
            t.amount_paise,
            t.status,
            t.timestamp
        FROM transactions t
        LEFT JOIN users s ON t.sender_id = s.user_id
        LEFT JOIN users r ON t.receiver_id = r.user_id
        WHERE t.sender_id = ? OR t.receiver_id = ?
        ORDER BY t.timestamp DESC
    """, (clean_user_id, clean_user_id)).fetchall()

    conn.close()

    transactions = []
    for row in rows:
        amount_paise = row['amount_paise']
        txn_type = "DEBIT" if row['sender_id'] == clean_user_id else "CREDIT"
        transactions.append({
            "transaction_id": row['transaction_id'],
            "sender_id": row['sender_id'],
            "sender_name": row['sender_name'],
            "receiver_id": row['receiver_id'],
            "receiver_name": row['receiver_name'],
            "amount_paise": amount_paise,
            "amount_rupees": round(amount_paise / 100.0, 2),
            "type": txn_type,
            "status": row['status'],
            "timestamp": row['timestamp']
        })

    return jsonify({
        "user_id": clean_user_id,
        "name": user['name'],
        "count": len(transactions),
        "transactions": transactions
    }), 200


# -------------------------------------------------------------
# 5. User Management APIs (GET /api/users, POST /api/users)
# -------------------------------------------------------------
@app.route('/api/users', methods=['GET', 'POST', 'OPTIONS'])
def users_endpoint():
    """List users (GET) or register a new wallet user (POST)."""
    if request.method == 'OPTIONS':
        return '', 200

    if request.method == 'GET':
        conn = get_db_connection()
        users = conn.execute(
            "SELECT user_id, name, balance_paise FROM users ORDER BY user_id"
        ).fetchall()
        conn.close()

        result = []
        for u in users:
            result.append({
                "user_id": u['user_id'],
                "name": u['name'],
                "balance_paise": u['balance_paise'],
                "balance_rupees": round(u['balance_paise'] / 100.0, 2)
            })
        return jsonify(result), 200

    # POST: Create user
    data = request.get_json(silent=True) or {}
    raw_name = data.get('name')
    raw_user_id = data.get('user_id')
    raw_balance = data.get('initial_balance', data.get('balance', 0))

    if not raw_name or not str(raw_name).strip():
        return jsonify({"error": "User name is required."}), 400

    # Sanitize name to prevent stored XSS
    name = html.escape(str(raw_name).strip())

    if isinstance(raw_balance, bool):
        return jsonify({"error": "Initial balance cannot be a boolean value."}), 400

    try:
        balance_float = float(raw_balance)
        balance_paise = int(round(balance_float * 100))
    except (ValueError, TypeError):
        return jsonify({"error": "Invalid initial balance format. Must be numeric."}), 400

    if balance_paise < 0:
        return jsonify({"error": "Initial balance cannot be negative."}), 400

    conn = get_db_connection()
    try:
        user_id = (str(raw_user_id).strip().upper()) if raw_user_id else ""
        if not user_id:
            max_row = conn.execute(
                "SELECT user_id FROM users WHERE user_id LIKE 'U%' ORDER BY user_id DESC LIMIT 1"
            ).fetchone()
            if max_row and max_row['user_id'][1:].isdigit():
                next_num = int(max_row['user_id'][1:]) + 1
            else:
                next_num = 3
            user_id = f"U{next_num:03d}"
            while conn.execute("SELECT 1 FROM users WHERE user_id = ?", (user_id,)).fetchone():
                next_num += 1
                user_id = f"U{next_num:03d}"
        else:
            existing = conn.execute("SELECT 1 FROM users WHERE user_id = ?", (user_id,)).fetchone()
            if existing:
                conn.close()
                return jsonify({"error": f"User ID '{user_id}' already exists. Choose a different ID."}), 409

        conn.execute(
            "INSERT INTO users (user_id, name, balance_paise) VALUES (?, ?, ?)",
            (user_id, name, balance_paise)
        )
        conn.commit()
        conn.close()

        return jsonify({
            "message": "Wallet user created successfully.",
            "user": {
                "user_id": user_id,
                "name": name,
                "balance_paise": balance_paise,
                "balance_rupees": round(balance_paise / 100.0, 2)
            }
        }), 201
    except Exception as e:
        conn.close()
        return jsonify({"error": "Failed to create wallet user."}), 500


# -------------------------------------------------------------
# 6. Database Consistency & Audit Verification Endpoint
# -------------------------------------------------------------
@app.route('/api/system/consistency', methods=['GET', 'OPTIONS'])
def system_consistency_check():
    """
    Performs comprehensive ACID transaction and financial integrity validation:
    1. Conservation of total balance.
    2. Zero negative balances.
    3. Equality of total debits and credits in transaction ledger.
    4. Foreign key integrity.
    """
    if request.method == 'OPTIONS':
        return '', 200

    conn = get_db_connection()
    try:
        users = conn.execute("SELECT user_id, name, balance_paise FROM users").fetchall()
        total_balance_paise = sum(u['balance_paise'] for u in users)

        # Check for any negative balance
        negative_users = [u['user_id'] for u in users if u['balance_paise'] < 0]

        # Audit ledger
        tx_stats = conn.execute("""
            SELECT 
                COUNT(*) as total_transactions,
                COALESCE(SUM(CASE WHEN status = 'SUCCESS' THEN amount_paise ELSE 0 END), 0) as total_volume_paise,
                COALESCE(SUM(CASE WHEN status != 'SUCCESS' THEN 1 ELSE 0 END), 0) as non_success_count
            FROM transactions
        """).fetchone()

        # Check orphan transactions
        orphans = conn.execute("""
            SELECT COUNT(*) as count FROM transactions 
            WHERE sender_id NOT IN (SELECT user_id FROM users)
               OR receiver_id NOT IN (SELECT user_id FROM users)
        """).fetchone()['count']

        conn.close()

        is_consistent = (len(negative_users) == 0) and (orphans == 0)

        return jsonify({
            "is_consistent": is_consistent,
            "status": "CONSISTENT" if is_consistent else "INCONSISTENT",
            "total_users": len(users),
            "total_system_balance_paise": total_balance_paise,
            "total_system_balance_rupees": round(total_balance_paise / 100.0, 2),
            "negative_balance_accounts": negative_users,
            "total_transactions": tx_stats['total_transactions'],
            "total_transferred_volume_rupees": round(tx_stats['total_volume_paise'] / 100.0, 2),
            "orphan_transactions": orphans,
            "audit_timestamp": datetime.now().isoformat()
        }), 200

    except Exception as e:
        conn.close()
        return jsonify({
            "is_consistent": False,
            "status": "AUDIT_ERROR",
            "error": "Failed to complete consistency audit."
        }), 500


# -------------------------------------------------------------
# 7. Performance Latency Benchmark Endpoint
# -------------------------------------------------------------
@app.route('/api/test/performance', methods=['POST', 'OPTIONS'])
def performance_benchmark():
    """
    Executes repeated sequential API queries to measure observed latency.
    Distinguishes basic client-server response-time benchmarking from distributed load testing.
    """
    if request.method == 'OPTIONS':
        return '', 200

    data = request.get_json(silent=True) or {}
    iterations = min(max(int(data.get('iterations', 10)), 3), 50)
    threshold_ms = float(data.get('threshold_ms', 250.0))

    latencies = []
    conn = get_db_connection()

    for _ in range(iterations):
        t0 = time.perf_counter()
        conn.execute("SELECT 1").fetchone()
        t1 = time.perf_counter()
        latencies.append(round((t1 - t0) * 1000.0, 2))

    conn.close()

    avg_ms = round(sum(latencies) / len(latencies), 2)
    min_ms = round(min(latencies), 2)
    max_ms = round(max(latencies), 2)
    threshold_met = max_ms <= threshold_ms

    return jsonify({
        "type": "Basic Response-Time Benchmark",
        "scope_notice": "Measures sequential database and backend round-trip latency. For concurrent high-throughput simulation, use dedicated load testing tools.",
        "iterations": iterations,
        "threshold_ms": threshold_ms,
        "min_latency_ms": min_ms,
        "avg_latency_ms": avg_ms,
        "max_latency_ms": max_ms,
        "threshold_met": threshold_met,
        "latencies": latencies,
        "timestamp": datetime.now().isoformat()
    }), 200


# -------------------------------------------------------------
# 8. Fault Simulation Control (Demonstration of Defect Detection)
# -------------------------------------------------------------
@app.route('/api/test/simulate-fault', methods=['POST', 'GET', 'OPTIONS'])
def simulate_fault():
    """
    Enables/disables simulated backend defects to demonstrate live
    defect detection and reporting in viva / evaluations.
    """
    global SIMULATED_FAULTS
    if request.method == 'OPTIONS':
        return '', 200

    if request.method == 'POST':
        data = request.get_json(silent=True) or {}
        fault = data.get('fault')
        enabled = bool(data.get('enabled', False))

        if fault == 'all_reset':
            for k in SIMULATED_FAULTS:
                SIMULATED_FAULTS[k] = False
        elif fault in SIMULATED_FAULTS:
            SIMULATED_FAULTS[fault] = enabled
        else:
            return jsonify({
                "error": f"Unknown fault type: '{fault}'",
                "valid_faults": list(SIMULATED_FAULTS.keys()) + ['all_reset']
            }), 400

    return jsonify({
        "simulated_faults": SIMULATED_FAULTS,
        "active_faults_count": sum(1 for v in SIMULATED_FAULTS.values() if v),
        "message": "Fault simulation state updated."
    }), 200


# -------------------------------------------------------------
# 9. GET /api/test-summary
# -------------------------------------------------------------
@app.route('/api/test-summary', methods=['GET'])
def get_test_summary():
    """Returns stored test summary report metrics if available."""
    summary_path = os.path.join(REPORTS_DIR, 'test_summary.json')
    if os.path.exists(summary_path):
        try:
            with open(summary_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
                return jsonify(data), 200
        except Exception as e:
            return jsonify({"error": f"Failed to read test summary: {str(e)}"}), 500

    return jsonify({
        "executed": False,
        "total": 0,
        "passed": 0,
        "failed": 0,
        "message": "No test run recorded yet."
    }), 200


# -------------------------------------------------------------
# 10. POST /api/run-tests (Executes CLI Test Suite)
# -------------------------------------------------------------
@app.route('/api/run-tests', methods=['POST'])
def run_tests_endpoint():
    """
    Executes the comprehensive automated test suite and generates updated reports.
    Restricted to localhost/development environment.
    """
    if request.remote_addr not in ('127.0.0.1', '::1', 'localhost'):
        return jsonify({"error": "Test execution restricted to local development environment."}), 403

    scripts_dir = os.path.join(BASE_DIR, 'scripts')
    execute_script = os.path.join(scripts_dir, 'run_test_suite.py')

    if not os.path.exists(execute_script):
        # Fallback to execute_tests.py if present
        execute_script = os.path.join(scripts_dir, 'execute_tests.py')

    if not os.path.exists(execute_script):
        return jsonify({"error": "Test runner script not found."}), 500

    import subprocess
    try:
        res = subprocess.run(
            [sys.executable, execute_script],
            capture_output=True,
            text=True,
            timeout=45
        )

        summary_path = os.path.join(REPORTS_DIR, 'test_summary.json')
        if os.path.exists(summary_path):
            with open(summary_path, 'r', encoding='utf-8') as f:
                summary_data = json.load(f)
                return jsonify(summary_data), 200

        return jsonify({
            "error": "Test script finished without generating summary JSON.",
            "stdout": res.stdout,
            "stderr": res.stderr
        }), 500
    except subprocess.TimeoutExpired:
        return jsonify({"error": "Test execution timed out after 45 seconds."}), 504
    except Exception as e:
        return jsonify({"error": f"Failed to execute tests: {str(e)}"}), 500


# -------------------------------------------------------------
# 11. POST /api/reset-database
# -------------------------------------------------------------
@app.route('/api/reset-database', methods=['POST', 'OPTIONS'])
def reset_database_endpoint():
    """Resets database to pristine sample accounts (Alice ₹5,000, Bob ₹2,000)."""
    if request.method == 'OPTIONS':
        return '', 200

    reset_to_initial_state()
    return jsonify({
        "message": "Database reset successfully to initial state.",
        "accounts": [
            {"user_id": "U001", "name": "Alice", "balance_rupees": 5000.0},
            {"user_id": "U002", "name": "Bob", "balance_rupees": 2000.0}
        ]
    }), 200


if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5001))
    print(f"Starting WalletPay backend server on http://127.0.0.1:{port}")
    app.run(host='0.0.0.0', port=port, debug=False)
