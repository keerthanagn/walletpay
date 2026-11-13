"""
Pytest configuration and fixtures for WalletPay test suite.
Sets up an isolated test database and Flask test client.
"""

import os
import sys
import tempfile

# Configure test database in temp directory BEFORE importing app/database
_fd, TEST_DB_FILE = tempfile.mkstemp(suffix='_test_wallet.db')
os.close(_fd)
os.environ['WALLETPAY_DB_PATH'] = TEST_DB_FILE

# Ensure backend directory is in python path
BACKEND_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'backend')
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

import pytest
import database
from app import app, SIMULATED_FAULTS


@pytest.fixture(autouse=True)
def isolated_db():
    """Reset database to initial pristine state before every test."""
    database.init_db(reset=True)
    # Reset simulated faults to default safe state
    for k in SIMULATED_FAULTS:
        SIMULATED_FAULTS[k] = False
    yield
    # Reset simulated faults after test
    for k in SIMULATED_FAULTS:
        SIMULATED_FAULTS[k] = False


@pytest.fixture
def client():
    """Provide a Flask test client with testing mode enabled."""
    app.config['TESTING'] = True
    with app.test_client() as test_client:
        yield test_client
