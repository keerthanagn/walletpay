#!/usr/bin/env python3
"""
Automated Test Runner for WalletPay
Invokes run_test_suite.py to execute the full 39-test QA suite across all 7 categories.
Generates test_summary.json and test_execution_summary.txt.
"""

import sys
import os

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, SCRIPT_DIR)

from run_test_suite import WalletPayTestRunner

def main():
    runner = WalletPayTestRunner()
    summary = runner.run_all_tests()
    return 0 if summary['failed'] == 0 else 1

if __name__ == '__main__':
    sys.exit(main())
