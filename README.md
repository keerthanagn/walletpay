# WalletPay: Automated API Quality Assurance & Transaction Validation of a Digital Wallet

[![Python](https://img.shields.io/badge/Python-3.11%2B-blue.svg)](https://www.python.org/)
[![Flask](https://img.shields.io/badge/Flask-3.1%2B-black.svg)](https://flask.palletsprojects.com/)
[![SQLite](https://img.shields.io/badge/Database-SQLite3-green.svg)](https://sqlite.org/)
[![Postman](https://img.shields.io/badge/Testing-Postman%20v11-orange.svg)](https://www.postman.com/)
[![Tests](https://img.shields.io/badge/Test%20Suite-39%2F39%20Passed-brightgreen.svg)]()
[![Platform](https://img.shields.io/badge/Platform-Windows%20%7C%20Cross--Platform-lightgrey.svg)]()

A comprehensive, production-grade Software Testing and Quality Assurance project built for academic evaluation, viva voce defense, and real-world financial validation. **WalletPay** demonstrates automated REST API testing, boundary value analysis (BVA), input validation, integration testing, database consistency & invariant conservation, performance latency benchmarking, and vulnerability deterrence.

---

## 1. Project Overview & Architecture

**WalletPay** is an automated digital wallet and peer-to-peer (P2P) fund transfer system engineered with strict financial validation rules and database consistency guards.

```
┌────────────────────────────────────────────────────────────────────────┐
│                        WALLETPAY SYSTEM ARCHITECTURE                   │
└────────────────────────────────────────────────────────────────────────┘

  +-----------------------+           +------------------------------+
  |    Frontend Web UI    |           |       Postman Desktop        |
  |  HTML5 / CSS3 / ES6   |           |  Collection Runner (v2.1.0)  |
  +-----------+-----------+           +--------------+---------------+
              |                                      |
              | Real-time HTTP REST / JSON Fetch     | Automated Test Scripts (pm.test)
              +------------------+-------------------+
                                 |
                                 v
                 +-------------------------------+
                 |      Python Flask Backend     |
                 |  - Robust Input Validation    |
                 |  - Decimal Precision Guard    |
                 |  - Idempotency & Replay Guard |
                 |  - Fault Injection Simulator  |
                 |  - Security & CORS Headers    |
                 +---------------+---------------+
                                 |
                                 | Atomic Transactions (BEGIN IMMEDIATE)
                                 v
                 +-------------------------------+
                 |       SQLite3 Invariant DB    |
                 |  - Integer Paise Storage      |
                 |  - Zero-Overdraft Constraint  |
                 |  - Foreign Key Referencing    |
                 |  - Rollback on Exception      |
                 +-------------------------------+
```

### Key Technical Characteristics
- **Integer Paise Representation:** All wallet balances and transfer amounts are stored as integer paise (₹1 = 100 paise). This completely eliminates IEEE 754 floating-point rounding errors in currency arithmetic.
- **ACID Transaction Guarantees:** Multi-step transfers are wrapped in SQLite `BEGIN IMMEDIATE` transactions with explicit `ROLLBACK` on any error, ensuring atomicity and consistency.
- **Zero-Overdraft Database Invariant:** Enforced via SQLite table constraints `CHECK (balance_paise >= 0)` so no balance can become negative.
- **Idempotency & Replay Prevention:** Unique transaction IDs prevent double-charging or network replay attacks (HTTP 409 Conflict).
- **Two Real-World Testing Vectors:**
  1. **Interactive In-Browser Testing Engine:** Real fetch calls, dynamic accordions, latency meters, defect logging, and fault injection simulator.
  2. **Official Postman Collection:** 39 structured requests with `pm.test()` JavaScript assertions runnable directly in Postman Collection Runner.

---

## 2. Comprehensive Test Suite (7 Categories, 39 Assertions)

The testing engine is divided into seven core software testing categories:

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│                          39 AUTOMATED TEST ASSERTIONS                            │
├───────┬──────────────────────────────┬───────┬───────────────────────────────────┤
│ Group │ Testing Methodology          │ Tests │ Key Validations                   │
├───────┼──────────────────────────────┼───────┼───────────────────────────────────┤
│ A     │ Functional Testing           │   7   │ Transfers, Insufficient Bal, Dup  │
│ B     │ Boundary Value Analysis      │   7   │ ₹1 min, ₹0.50, ₹0, negative, max  │
│ C     │ Input Validation Testing     │   7   │ Missing, whitespace, bool, float  │
│ D     │ Integration Testing          │   5   │ SQLite handshake, state sync      │
│ E     │ Database Consistency Testing │   5   │ Total sum invariant, FK audit     │
│ F     │ Performance Latency Testing  │   3   │ Response times (<200ms, <300ms)   │
│ G     │ Basic Security Testing       │   5   │ SQLi, sanitized errors, CORS, XSS │
└───────┴──────────────────────────────┴───────┴───────────────────────────────────┘
```

### Group A — Functional Testing (7 Test Cases)
- `TC-FT-01: Successful Money Transfer`: Valid transfer of ₹500 from Alice (U001) to Bob (U002). Verifies HTTP 200, status `SUCCESS`, sender debited ₹500, receiver credited ₹500.
- `TC-FT-02: Insufficient Balance Rejection`: Attempt transfer of ₹99,999 exceeding available balance. Verifies HTTP 400 Bad Request and error message.
- `TC-FT-03: Invalid Sender Rejection`: Attempt transfer from non-existent account `U999_NON_EXISTENT`. Verifies HTTP 404 Not Found.
- `TC-FT-04: Invalid Receiver Rejection`: Attempt transfer to non-existent account `U999_NON_EXISTENT`. Verifies HTTP 404 Not Found.
- `TC-FT-05: Duplicate Transaction ID Rejection`: Replays the exact same `transaction_id`. Verifies idempotency guard and HTTP 409 Conflict.
- `TC-FT-06: Self-Transfer Rejection`: Sender and receiver accounts are identical (`U001` $\rightarrow$ `U001`). Verifies HTTP 400 Bad Request.
- `TC-FT-07: Transaction History Ledger Verification`: Queries `GET /api/transactions/U001`. Verifies array structure, counts, and debit/credit metadata.

### Group B — Boundary Value Analysis (7 Test Cases)
- `TC-BVA-01: Minimum Valid Amount Boundary (₹1.00)`: Smallest valid transfer permissible in the system. Verifies HTTP 200.
- `TC-BVA-02: Sub-Minimum Amount Boundary (₹0.50)`: Transfer of 50 paise (below ₹1.00 minimum threshold). Verifies HTTP 400 Bad Request.
- `TC-BVA-03: Zero Amount Boundary (₹0.00)`: Non-positive boundary test ($amount = 0$). Verifies HTTP 400 Bad Request.
- `TC-BVA-04: Negative Amount Boundary (-₹50.00)`: Negative value boundary test. Verifies HTTP 400 Bad Request.
- `TC-BVA-05: Exact Available Balance Boundary`: Transfers 100% of sender's available balance, dropping account to exactly ₹0.00. Verifies HTTP 200.
- `TC-BVA-06: Amount Exceeding Available Balance (+₹1.00)`: Attempt transfer of ₹1.00 when balance is exactly ₹0.00. Verifies HTTP 400.
- `TC-BVA-07: Extremely Large Transaction Amount (₹10,000,000)`: Upper boundary test exceeding safety thresholds. Verifies HTTP 400.

### Group C — Input Validation Testing (7 Test Cases)
- `TC-IVT-01: Missing Required Field`: Payload omitting `amount`. Verifies HTTP 400 with missing field breakdown.
- `TC-IVT-02: Empty / Whitespace Transaction ID`: String containing only whitespace (`"   "`). Verifies HTTP 400 non-empty requirement.
- `TC-IVT-03: Invalid Data Type (Boolean Amount)`: Passing `amount: true`. Verifies HTTP 400 rejection preventing Python boolean-to-integer coercion.
- `TC-IVT-04: Non-Numeric String Amount`: Passing `"five_hundred"`. Verifies HTTP 400 numeric format rejection.
- `TC-IVT-05: Malformed JSON Syntax`: Raw body with syntax errors. Verifies HTTP 400 JSON parsing guard.
- `TC-IVT-06: Decimal Precision Boundary`: Passing `25.125` (>2 decimal places). Verifies HTTP 400 currency precision restriction.
- `TC-IVT-07: Special Characters in Amount`: Passing `"₹100#"`. Verifies HTTP 400 symbol rejection.

### Group D — Integration Testing (5 Test Cases)
- `TC-INT-01: Flask API & SQLite Handshake`: Queries `GET /api/health`. Verifies active SQLite file descriptor.
- `TC-INT-02: User Directory & Schema Mapping`: Queries `GET /api/users`. Verifies object mapping (`user_id`, `balance_paise`, `balance_rupees`).
- `TC-INT-03: End-to-End Balance Synchronization`: Performs ₹200 transfer and checks that sender delta is -20,000 paise and receiver delta is +20,000 paise.
- `TC-INT-04: Ledger Persistence Verification`: Confirms committed transaction appears in transaction history table.
- `TC-INT-05: Failed Transfer State Non-Pollution`: Attempts invalid transfer and confirms sender balance before == sender balance after.

### Group E — Database Consistency Testing (5 Test Cases)
- `TC-DB-01: Conservation of Total Money Invariant`: Confirms $\sum \text{Balances}_{\text{before}} == \sum \text{Balances}_{\text{after}}$ across all users.
- `TC-DB-02: Non-Negative Balance Constraint`: Audits all accounts to verify no balance falls below 0.
- `TC-DB-03: Transaction History Isolation`: Confirms rejected transfers do NOT create `SUCCESS` rows in transactions table.
- `TC-DB-04: Ledger Conservation & Foreign Key Audit`: Calls `GET /api/system/consistency` to verify zero orphan records and status `CONSISTENT`.
- `TC-DB-05: Atomic Rollback Simulation`: Verifies `conn.rollback()` restores balances on runtime exception.

### Group F — Performance & Latency Testing (3 Test Cases)
- `TC-PERF-01: Single Read Latency Benchmark`: Verifies `GET /api/balance/<id>` executes in under 200 ms.
- `TC-PERF-02: Sequential Latency Stability`: Executes 5 sequential requests and checks that average latency remains under 250 ms.
- `TC-PERF-03: Atomic Transfer Latency Threshold`: Verifies atomic SQLite write completes under 300 ms.

> **Performance Scope Notice:** Response-time benchmarks measure sequential client-server round-trip latency. Full stress or distributed high-concurrency testing requires external distributed load tools.

### Group G — Basic Security Testing (5 Test Cases)
- `TC-SEC-01: SQL Injection in User ID`: Attempts `' OR '1'='1`. Parameterized query treats it literally; returns 404 without leaking data.
- `TC-SEC-02: SQL Injection in Transaction ID`: Attempts `TXN'; DROP TABLE users; --`. Parameterized query prevents SQL execution; users table remains intact.
- `TC-SEC-03: Error Sanitization`: Confirms error responses never leak raw Python stack traces, file paths, or SQLite internal errors.
- `TC-SEC-04: CORS & Security Headers`: Confirms `OPTIONS` preflight returns `Access-Control-Allow-Origin: *` and `X-Content-Type-Options: nosniff`.
- `TC-SEC-05: Stored XSS Prevention`: Attempts injecting `<script>alert('xss')</script>` in user name. Confirms HTML-escaping before database storage.

---

## 3. Defect Detection & Quality Engineering Life Cycle

Whenever an automated test fails, the built-in Defect Engine performs:
1. **Defect Ticket Generation:** Assigns an identifier (e.g. `DEF-001`).
2. **Severity Classification:**
   - **HIGH:** Data corruption, financial discrepancy, negative balances, SQL injection.
   - **MEDIUM:** Business rule bypass (self-transfer, duplicate ID, wrong HTTP code).
   - **LOW:** Latency threshold exceeded, minor header anomaly.
3. **Root Cause Analysis:** Suggests the likely line or logic failure.
4. **Interactive Fix Verification:** A "Re-run Test" button to verify resolution in real time.

### Fault Injection Demonstration Mode (For Viva & Presentation)
In the UI dashboard, select the **Fault Injection Demo** dropdown:
- *Inject Defect: Allow Self-Transfer* &rarr; Click **Run All 39 Tests** &rarr; `TC-FT-06` fails immediately with HTTP 200 instead of 400. The Defect Table logs `DEF-001` with expected vs actual behavior.
- Switch back to *Production Mode* &rarr; Click **Verify Fix** &rarr; `TC-FT-06` passes and the defect clears!

---

## 4. Installation & Execution Guide (Windows)

### Prerequisites
- Python 3.10+ installed on Windows.
- Web Browser (Chrome, Edge, Firefox).
- *(Optional)* Postman Desktop (v10+ or v11+) for external collection running.

### Step 1: Open PowerShell or Command Prompt
Navigate to the project root directory:
```powershell
cd D:\digital-wallet-project-main
```

### Step 2: Install Python Dependencies
```powershell
pip install -r backend/requirements.txt
```
*(Dependencies: Flask, Requests)*

### Step 3: Start the Flask Backend Server
```powershell
python backend/app.py
```
Output:
```text
Starting WalletPay backend server on http://127.0.0.1:5001
```

### Step 4: Open the Web Application
Open your web browser and navigate to:
```text
http://127.0.0.1:5001
```

---

## 5. Running Tests from the Command Line (CLI)

You can run the complete 39-test QA suite directly from PowerShell or Command Prompt:

```powershell
python scripts/run_test_suite.py
```

### Generated Reports
- **Machine Summary JSON:** `reports/test_summary.json`
- **Executive Summary Text:** `reports/test_execution_summary.txt`

To reset the database at any time from CLI:
```powershell
python scripts/reset_database.py
```

---

## 6. Postman Collection & Collection Runner Guide

The project includes an updated Postman collection and environment:
- **Collection:** `postman/Digital_Wallet_API_Tests.postman_collection.json`
- **Environment:** `postman/Digital_Wallet_Environment.postman_environment.json`

### How to Run in Postman Desktop:
1. Launch **Postman Desktop**.
2. Click the **Import** button in the top-left corner.
3. Select both files from the `postman/` directory:
   - `Digital_Wallet_API_Tests.postman_collection.json`
   - `Digital_Wallet_Environment.postman_environment.json`
4. In the top-right environment selector, select **Digital Wallet Environment**.
5. In the left sidebar, right-click **WalletPay - Automated API Quality Assurance & Validation Suite**.
6. Select **Run collection**.
7. Click **Run WalletPay...**
8. Watch all 39 test cases execute across Groups A through G with 100% green assertions!

---

## 7. Database Schema & Data Dictionary

Database File: `backend/wallet.db` (SQLite3)

### Table 1: `users`
| Column | Type | Constraints | Description |
|---|---|---|---|
| `user_id` | TEXT | PRIMARY KEY | Unique user ID (e.g. `U001`, `U002`) |
| `name` | TEXT | NOT NULL | Account holder name (HTML-escaped) |
| `balance_paise` | INTEGER | NOT NULL, `CHECK (balance_paise >= 0)` | Balance in paise (₹1 = 100 paise) |

### Table 2: `transactions`
| Column | Type | Constraints | Description |
|---|---|---|---|
| `transaction_id` | TEXT | PRIMARY KEY | Unique transaction reference (idempotency) |
| `sender_id` | TEXT | FOREIGN KEY (`users.user_id`) | Sender user ID |
| `receiver_id` | TEXT | FOREIGN KEY (`users.user_id`) | Receiver user ID |
| `amount_paise` | INTEGER | NOT NULL, `CHECK (amount_paise > 0)` | Transfer amount in paise |
| `status` | TEXT | NOT NULL | `SUCCESS` |
| `timestamp` | TEXT | NOT NULL | ISO 8601 execution timestamp |

### Initial Baseline Accounts
- **Alice (`U001`):** ₹5,000.00 (500,000 paise)
- **Bob (`U002`):** ₹2,000.00 (200,000 paise)

---

## 8. REST API Endpoints Reference

All endpoints accept and return JSON.

| Method | Endpoint | Description | Status Codes |
|---|---|---|---|
| `GET` | `/api/health` | Backend and SQLite database connectivity status | `200` |
| `GET` | `/api/balance/<user_id>` | Wallet balance (paise & rupees) for account | `200`, `404` |
| `POST` | `/api/transfer` | Atomic peer-to-peer money transfer | `200`, `400`, `404`, `409`, `500` |
| `GET` | `/api/transactions/<user_id>` | Historical ledger records for user | `200`, `404` |
| `GET` | `/api/users` | List registered wallet users | `200` |
| `POST` | `/api/users` | Register a new wallet user | `201`, `400`, `409` |
| `GET` | `/api/system/consistency` | Invariant audit (total money, orphans, debits==credits) | `200`, `500` |
| `POST` | `/api/test/performance` | Sequential response-time latency benchmark | `200` |
| `POST` | `/api/test/simulate-fault` | Toggle simulated defect for live demonstration | `200`, `400` |
| `POST` | `/api/run-tests` | Trigger backend test runner | `200`, `403`, `500` |
| `POST` | `/api/reset-database` | Restore accounts to initial baseline | `200` |

---

## 9. Viva Voce & Evaluation Defense Guide

### Q1: Why store balances in integer paise instead of float rupees?
> **Answer:** In computing, floating-point numbers (IEEE 754) cannot accurately represent base-10 fractional decimals like `0.1` or `0.01` (`0.1 + 0.2 = 0.30000000000000004`). In financial software, this leads to fractional penny accumulation errors. By storing balances as integer paise (e.g. ₹50.25 = 5025 paise), all addition and subtraction is exact and immune to rounding drift.

### Q2: What is Boundary Value Analysis (BVA) and how is it demonstrated?
> **Answer:** BVA tests values at the boundaries of valid and invalid input equivalence partitions. In WalletPay:
> - Lower boundary: ₹1.00 (valid minimum, HTTP 200).
> - Just below lower boundary: ₹0.50 and ₹0.00 (invalid, HTTP 400).
> - Extreme negative boundary: -₹50.00 (invalid, HTTP 400).
> - Balance boundary: Transferring exactly 100% of balance (valid, HTTP 200), and balance + ₹1.00 (invalid, HTTP 400).

### Q3: How is Idempotency enforced?
> **Answer:** Each transfer requires a client-supplied or auto-generated `transaction_id`. Before deducting funds, the backend checks if `transaction_id` already exists in SQLite. If found, it immediately aborts with HTTP 409 Conflict, ensuring that repeated network requests or replayed requests never deduct funds more than once.

### Q4: How does the system ensure ACID atomicity?
> **Answer:** The transfer API executes inside a `BEGIN IMMEDIATE` database transaction. If the sender debit, receiver credit, or transaction record insert encounters any exception, `conn.rollback()` is invoked, ensuring that either all three operations succeed together or none do.

### Q5: How is SQL Injection prevented?
> **Answer:** All SQL queries use parameterized placeholders (`?`). The SQLite database engine compiles the SQL command structure before binding parameters as literal data, preventing strings like `' OR '1'='1` or `'; DROP TABLE; --` from ever executing as SQL instructions.

---

## 10. Project Directory Structure

```text
digital-wallet-project-main/
├── backend/
│   ├── app.py                     # Flask REST APIs, input validation & fault injector
│   ├── database.py                # SQLite connection, schema & reset logic
│   ├── requirements.txt           # Python dependencies (Flask, requests)
│   └── wallet.db                  # Embedded SQLite database file
├── frontend/
│   ├── index.html                 # Complete responsive 4-section UI dashboard
│   ├── style.css                  # Professional stylesheet & testing component styles
│   └── script.js                  # Reactive client & 39-test live browser QA engine
├── postman/
│   ├── Digital_Wallet_API_Tests.postman_collection.json    # 39-request Postman test suite
│   └── Digital_Wallet_Environment.postman_environment.json # Base URL & variables
├── reports/
│   ├── test_summary.json          # Machine-readable test execution metrics
│   ├── test_execution_summary.txt # Human-readable formatted test summary
│   └── postman_test_report.html   # HTML test report
├── scripts/
│   ├── run_test_suite.py          # Standalone Python CLI test runner (39 tests)
│   ├── reset_database.py          # Database reset utility
│   ├── execute_tests.py           # Test runner wrapper
│   └── run_tests.sh               # Shell script runner
└── README.md                      # Comprehensive documentation & viva guide
```
