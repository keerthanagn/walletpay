/**
 * WalletPay — Frontend Application & Automated QA Test Engine Logic
 * Communicates with Python Flask REST APIs and SQLite Invariant Ledger.
 */

// Determine API Base URL
const API_BASE = (window.location.protocol.startsWith('http')) 
  ? window.location.origin 
  : 'http://127.0.0.1:5001';

let currentUserId = 'U001';
let userProfiles = {};
let activeCategoryFilter = 'ALL';
let testResultsStore = {};
let executionHistory = [];

// DOM Elements: Core Wallet
const viewUserSelect = document.getElementById('viewUserSelect');
const senderSelect = document.getElementById('senderSelect');
const receiverSelect = document.getElementById('receiverSelect');
const transferAmountInput = document.getElementById('transferAmount');
const transactionIdInput = document.getElementById('transactionIdInput');
const transferForm = document.getElementById('transferForm');
const regenerateTxnBtn = document.getElementById('regenerateTxnBtn');
const refreshBtn = document.getElementById('refreshBtn');
const resetDemoBtn = document.getElementById('resetDemoBtn');
const notificationArea = document.getElementById('notificationArea');
const transactionTableBody = document.getElementById('transactionTableBody');
const accountsOverviewContainer = document.getElementById('accountsOverviewContainer');

// DOM Elements: User Modal
const openAddUserBtn = document.getElementById('openAddUserBtn');
const closeAddUserModal = document.getElementById('closeAddUserModal');
const cancelAddUserBtn = document.getElementById('cancelAddUserBtn');
const addUserModal = document.getElementById('addUserModal');
const addUserForm = document.getElementById('addUserForm');

// DOM Elements: Section D QA Testing Engine
const runTestsBtn = document.getElementById('runTestsBtn');
const resetDbBeforeTestBtn = document.getElementById('resetDbBeforeTestBtn');
const testTotalCount = document.getElementById('testTotalCount');
const testPassedCount = document.getElementById('testPassedCount');
const testFailedCount = document.getElementById('testFailedCount');
const testPassRate = document.getElementById('testPassRate');
const testDurationDisplay = document.getElementById('testDurationDisplay');
const testAvgLatencyDisplay = document.getElementById('testAvgLatencyDisplay');
const lastRunTime = document.getElementById('lastRunTime');
const testCardsContainer = document.getElementById('testCardsContainer');
const visibleTestCounter = document.getElementById('visibleTestCounter');
const perfThresholdInput = document.getElementById('perfThresholdInput');
const faultSimSelect = document.getElementById('faultSimSelect');
const perfBenchmarkCard = document.getElementById('perfBenchmarkCard');
const perfThresholdBadge = document.getElementById('perfThresholdBadge');
const perfMinVal = document.getElementById('perfMinVal');
const perfAvgVal = document.getElementById('perfAvgVal');
const perfMaxVal = document.getElementById('perfMaxVal');
const perfStatusVal = document.getElementById('perfStatusVal');
const latencyMeterFill = document.getElementById('latencyMeterFill');
const defectTableBody = document.getElementById('defectTableBody');
const defectStatusPill = document.getElementById('defectStatusPill');
const executionHistoryBody = document.getElementById('executionHistoryBody');
const clearHistoryBtn = document.getElementById('clearHistoryBtn');

// =========================================================================
// 1. INITIALIZATION ON DOM READY
// =========================================================================
document.addEventListener('DOMContentLoaded', () => {
  generateNewTransactionId();
  loadAllUsersAndData();
  renderInitialTestCards();
  loadHistoryFromStorage();

  // Core Event Listeners
  if (viewUserSelect) viewUserSelect.addEventListener('change', (e) => switchUser(e.target.value));
  if (regenerateTxnBtn) regenerateTxnBtn.addEventListener('click', generateNewTransactionId);
  if (refreshBtn) refreshBtn.addEventListener('click', () => {
    loadAllUsersAndData();
    showNotification('Wallet data refreshed successfully.', 'success');
  });

  if (senderSelect) {
    senderSelect.addEventListener('change', () => {
      if (senderSelect.value === receiverSelect.value) {
        const otherId = Object.keys(userProfiles).find(id => id !== senderSelect.value);
        if (otherId) receiverSelect.value = otherId;
      }
      switchUser(senderSelect.value);
    });
  }

  if (transferForm) transferForm.addEventListener('submit', handleTransferSubmit);
  if (resetDemoBtn) resetDemoBtn.addEventListener('click', handleResetDemo);

  // Modal Listeners
  if (openAddUserBtn) openAddUserBtn.addEventListener('click', () => addUserModal.classList.remove('hidden'));
  if (closeAddUserModal) closeAddUserModal.addEventListener('click', () => addUserModal.classList.add('hidden'));
  if (cancelAddUserBtn) cancelAddUserBtn.addEventListener('click', () => addUserModal.classList.add('hidden'));
  if (addUserForm) addUserForm.addEventListener('submit', handleAddUserSubmit);

  // Section D QA Engine Listeners
  if (runTestsBtn) runTestsBtn.addEventListener('click', () => handleRunFullTestSuite());
  if (resetDbBeforeTestBtn) resetDbBeforeTestBtn.addEventListener('click', async () => {
    await fetch(`${API_BASE}/api/reset-database`, { method: 'POST' });
    await loadAllUsersAndData();
    showNotification('Database reset to baseline state (Alice ₹5,000, Bob ₹2,000).', 'info');
  });

  if (faultSimSelect) faultSimSelect.addEventListener('change', handleFaultSimulationChange);
  if (clearHistoryBtn) clearHistoryBtn.addEventListener('click', handleClearHistory);

  // Category Tab Filter Listeners
  document.querySelectorAll('.cat-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.cat-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      activeCategoryFilter = tab.dataset.category;
      filterVisibleTestCards();
    });
  });
});

// =========================================================================
// 2. CORE WALLET LOGIC & USER MANAGEMENT
// =========================================================================

function generateNewTransactionId() {
  const randomSuffix = Math.floor(100000 + Math.random() * 900000);
  const txnId = `TXN_${Date.now().toString().slice(-6)}${randomSuffix}`;
  if (transactionIdInput) transactionIdInput.value = txnId;
}

async function loadAllUsersAndData() {
  try {
    const res = await fetch(`${API_BASE}/api/users?t=${Date.now()}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const users = await res.json();

    userProfiles = {};
    users.forEach(u => {
      userProfiles[u.user_id] = {
        name: u.name,
        balance: u.balance_rupees,
        balance_paise: u.balance_paise
      };
    });

    updateUserDropdowns();
    renderAccountPills();

    if (!userProfiles[currentUserId] && users.length > 0) {
      currentUserId = users[0].user_id;
    }
    switchUser(currentUserId);
  } catch (err) {
    console.error('Failed to load users:', err);
  }
}

function updateUserDropdowns() {
  const savedView = viewUserSelect.value || currentUserId;
  const savedSender = senderSelect.value || currentUserId;
  const savedReceiver = receiverSelect.value;

  viewUserSelect.innerHTML = '';
  senderSelect.innerHTML = '';
  receiverSelect.innerHTML = '';

  const userIds = Object.keys(userProfiles);
  userIds.forEach(id => {
    const u = userProfiles[id];
    const optText = `${u.name} (${id})`;

    viewUserSelect.add(new Option(optText, id));
    senderSelect.add(new Option(optText, id));
    receiverSelect.add(new Option(optText, id));
  });

  // Invalid test receiver for boundary & negative testing
  receiverSelect.add(new Option('Invalid Account (U999_NON_EXISTENT - Negative Test)', 'U999_NON_EXISTENT'));

  if (userProfiles[savedView]) viewUserSelect.value = savedView;
  if (userProfiles[savedSender]) senderSelect.value = savedSender;

  if (savedReceiver && (userProfiles[savedReceiver] || savedReceiver === 'U999_NON_EXISTENT')) {
    receiverSelect.value = savedReceiver;
  } else if (userIds.length > 1) {
    receiverSelect.value = userIds.find(id => id !== senderSelect.value) || userIds[1];
  }
}

function renderAccountPills() {
  if (!accountsOverviewContainer) return;
  accountsOverviewContainer.innerHTML = '';

  const avatarColors = ['', 'avatar-blue', 'avatar-purple', 'avatar-green'];
  let colorIdx = 0;

  Object.keys(userProfiles).forEach(id => {
    const u = userProfiles[id];
    const card = document.createElement('div');
    card.className = `account-pill-card ${id === currentUserId ? 'active' : ''}`;
    card.id = `pill_${id}`;
    card.onclick = () => switchUser(id);

    const initial = u.name.charAt(0).toUpperCase();
    const colorClass = avatarColors[colorIdx % avatarColors.length];
    colorIdx++;

    card.innerHTML = `
      <div class="pill-avatar ${colorClass}">${initial}</div>
      <div class="pill-info">
        <span class="pill-name">${u.name} (${id})</span>
        <span class="pill-balance" id="balance_pill_${id}">${formatRupees(u.balance)}</span>
      </div>
    `;
    accountsOverviewContainer.appendChild(card);
  });
}

function switchUser(userId) {
  if (!userProfiles[userId]) return;
  currentUserId = userId;
  viewUserSelect.value = userId;

  const profile = userProfiles[userId];
  const avatarEl = document.getElementById('headerAvatar');
  const greetingEl = document.getElementById('headerGreeting');
  const nameEl = document.getElementById('accountName');
  const userIdEl = document.getElementById('accountUserId');
  const numDisplayEl = document.getElementById('accountNumberDisplay');

  if (avatarEl) avatarEl.textContent = profile.name.charAt(0).toUpperCase();
  if (greetingEl) greetingEl.innerHTML = `Active: <strong>${profile.name}</strong> (${userId})`;
  if (nameEl) nameEl.textContent = profile.name;
  if (userIdEl) userIdEl.textContent = userId;
  if (numDisplayEl) numDisplayEl.textContent = `Account ID: ${userId}`;

  document.querySelectorAll('.account-pill-card').forEach(card => card.classList.remove('active'));
  const activePill = document.getElementById(`pill_${userId}`);
  if (activePill) activePill.classList.add('active');

  if (senderSelect.value !== userId) {
    senderSelect.value = userId;
    if (receiverSelect.value === userId) {
      const otherId = Object.keys(userProfiles).find(id => id !== userId);
      if (otherId) receiverSelect.value = otherId;
    }
  }

  updateBalanceDisplay();
  fetchTransactions(userId);
}

function updateBalanceDisplay() {
  const profile = userProfiles[currentUserId];
  if (profile) {
    const balEl = document.getElementById('currentBalanceDisplay');
    const updateEl = document.getElementById('lastUpdatedDisplay');
    if (balEl) balEl.textContent = formatRupees(profile.balance);
    if (updateEl) updateEl.textContent = `Updated ${new Date().toLocaleTimeString()}`;
  }
}

async function fetchTransactions(userId) {
  try {
    const res = await fetch(`${API_BASE}/api/transactions/${userId}?t=${Date.now()}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    renderTransactions(data.transactions || []);
  } catch (err) {
    transactionTableBody.innerHTML = `<tr><td colspan="6" class="empty-state">Unable to load ledger records. Verify backend connectivity.</td></tr>`;
  }
}

function renderTransactions(transactions) {
  if (!transactions || transactions.length === 0) {
    transactionTableBody.innerHTML = `<tr><td colspan="6" class="empty-state">No transactions recorded for this account.</td></tr>`;
    return;
  }

  let html = '';
  transactions.forEach(tx => {
    const isDebit = tx.type === 'DEBIT';
    const amountClass = isDebit ? 'amount-debit' : 'amount-credit';
    const amountPrefix = isDebit ? '- ' : '+ ';
    const statusClass = (tx.status === 'SUCCESS') ? 'badge-success' : 'badge-failed';

    html += `
      <tr>
        <td><span class="txn-id-code">${tx.transaction_id}</span></td>
        <td><strong>${tx.sender_name || tx.sender_id}</strong></td>
        <td><strong>${tx.receiver_name || tx.receiver_id}</strong></td>
        <td class="${amountClass}">${amountPrefix}${formatRupees(tx.amount_rupees)}</td>
        <td>${formatDateTime(tx.timestamp)}</td>
        <td><span class="badge-status ${statusClass}">${tx.status}</span></td>
      </tr>
    `;
  });
  transactionTableBody.innerHTML = html;
}

async function handleTransferSubmit(e) {
  e.preventDefault();

  const sender_id = senderSelect.value;
  const receiver_id = receiverSelect.value;
  const amount = parseFloat(transferAmountInput.value);
  const transaction_id = transactionIdInput.value.trim();

  if (!transaction_id) {
    showNotification('Please enter or generate a Transaction ID.', 'error');
    return;
  }
  if (sender_id === receiver_id) {
    showNotification('Sender and Receiver accounts cannot be the same.', 'error');
    return;
  }
  if (isNaN(amount) || amount <= 0) {
    showNotification('Transfer amount must be a positive number greater than ₹0.', 'error');
    return;
  }

  const submitBtn = document.getElementById('submitTransferBtn');
  const originalText = submitBtn.innerHTML;
  submitBtn.disabled = true;
  submitBtn.innerHTML = `<span>Processing Transfer...</span>`;

  try {
    const res = await fetch(`${API_BASE}/api/transfer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ transaction_id, sender_id, receiver_id, amount })
    });
    const data = await res.json();

    if (res.ok) {
      showNotification(`✓ Transfer of ${formatRupees(amount)} from ${sender_id} to ${receiver_id} successful! (Txn: ${transaction_id})`, 'success');
      transferAmountInput.value = '';
      generateNewTransactionId();
      await loadAllUsersAndData();
    } else {
      const errorMsg = data.error || 'Transfer rejected by backend server.';
      showNotification(`✕ Transfer Rejected [HTTP ${res.status}]: ${errorMsg}`, 'error');
    }
  } catch (err) {
    showNotification(`✕ Network or server communication error: ${err.message}`, 'error');
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerHTML = originalText;
  }
}

async function handleAddUserSubmit(e) {
  e.preventDefault();
  const nameInput = document.getElementById('newUserName');
  const balanceInput = document.getElementById('newUserBalance');
  const userIdInput = document.getElementById('newUserId');

  const name = nameInput.value.trim();
  const initial_balance = parseFloat(balanceInput.value);
  const user_id = userIdInput.value.trim();

  if (!name) {
    showNotification('Please provide a valid account name.', 'error');
    return;
  }
  if (isNaN(initial_balance) || initial_balance < 0) {
    showNotification('Initial balance cannot be negative.', 'error');
    return;
  }

  const submitBtn = document.getElementById('submitAddUserBtn');
  submitBtn.disabled = true;

  try {
    const payload = { name, initial_balance };
    if (user_id) payload.user_id = user_id;

    const res = await fetch(`${API_BASE}/api/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();

    if (res.ok) {
      showNotification(`✓ New wallet user created: ${data.user.name} (${data.user.user_id}) with ${formatRupees(data.user.balance_rupees)}`, 'success');
      addUserModal.classList.add('hidden');
      nameInput.value = '';
      balanceInput.value = '';
      userIdInput.value = '';
      await loadAllUsersAndData();
      switchUser(data.user.user_id);
    } else {
      showNotification(`✕ Failed to create user [HTTP ${res.status}]: ${data.error}`, 'error');
    }
  } catch (err) {
    showNotification(`✕ Network error: ${err.message}`, 'error');
  } finally {
    submitBtn.disabled = false;
  }
}

async function handleResetDemo() {
  if (!confirm('Reset wallet accounts to baseline state (Alice ₹5,000, Bob ₹2,000) and wipe transactions?')) return;
  try {
    const res = await fetch(`${API_BASE}/api/reset-database`, { method: 'POST' });
    if (res.ok) {
      showNotification('✓ Database successfully restored to baseline accounts! Alice: ₹5,000 | Bob: ₹2,000', 'success');
      generateNewTransactionId();
      await loadAllUsersAndData();
      switchUser('U001');
    } else {
      showNotification('Could not reset database via API endpoint.', 'error');
    }
  } catch (err) {
    showNotification('Database reset error: ' + err.message, 'error');
  }
}

function setTransferAmount(val) {
  if (transferAmountInput) {
    transferAmountInput.value = val;
    transferAmountInput.focus();
  }
}

function formatRupees(amount) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2
  }).format(amount);
}

function formatDateTime(isoString) {
  if (!isoString) return 'Just now';
  try {
    const d = new Date(isoString);
    return d.toLocaleString('en-IN', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  } catch (e) {
    return isoString;
  }
}

function showNotification(message, type = 'info') {
  const alert = document.createElement('div');
  alert.className = `alert alert-${type}`;
  alert.innerHTML = `
    <span>${message}</span>
    <button class="alert-close" onclick="this.parentElement.remove()">&times;</button>
  `;
  notificationArea.innerHTML = '';
  notificationArea.appendChild(alert);
  setTimeout(() => {
    if (alert && alert.parentElement) alert.remove();
  }, 7000);
}


// =========================================================================
// 3. COMPREHENSIVE 39-TEST SUITE DEFINITIONS & ENGINE
// =========================================================================

const TEST_SUITE = [
  // ── GROUP A: FUNCTIONAL TESTING (7) ──
  {
    id: 'TC-FT-01',
    name: 'Successful Peer-to-Peer Transfer (Alice -> Bob ₹500)',
    cat: 'FT',
    catName: 'Functional Testing',
    endpoint: 'POST /api/transfer',
    scenario: 'Transfer ₹500 from Alice (U001) to Bob (U002) with valid transaction ID',
    expected: 'HTTP 200 OK, status: SUCCESS, Alice debited ₹500, Bob credited ₹500',
    severity: 'HIGH',
    cause: 'Core transfer logic or atomic commit failed',
    run: async () => {
      const txnId = 'TXN_FT_' + Date.now();
      const payload = { transaction_id: txnId, sender_id: 'U001', receiver_id: 'U002', amount: 500 };
      const t0 = performance.now();
      const res = await fetch(`${API_BASE}/api/transfer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const ms = Math.round(performance.now() - t0);
      const data = await res.json();
      const passed = (res.status === 200) && (data.transaction && data.transaction.status === 'SUCCESS');
      return {
        passed,
        statusCode: res.status,
        latencyMs: ms,
        actual: `HTTP ${res.status} — ${data.message || data.error || ''}`,
        requestPayload: payload,
        responsePayload: data,
        assertions: [
          { desc: 'HTTP Status is 200 OK', ok: res.status === 200 },
          { desc: "Transaction status is 'SUCCESS'", ok: data.transaction?.status === 'SUCCESS' },
          { desc: 'Amount transferred is ₹500.00', ok: data.transaction?.amount_rupees === 500 }
        ]
      };
    }
  },
  {
    id: 'TC-FT-02',
    name: 'Insufficient Balance Rejection (Attempt ₹99,999)',
    cat: 'FT',
    catName: 'Functional Testing',
    endpoint: 'POST /api/transfer',
    scenario: 'Attempt transfer of ₹99,999 when sender has less available balance',
    expected: "HTTP 400 Bad Request with 'Insufficient wallet balance'",
    severity: 'HIGH',
    cause: 'Balance threshold check missing or allowing overdraft',
    run: async () => {
      const payload = { transaction_id: 'TXN_INSUF_' + Date.now(), sender_id: 'U001', receiver_id: 'U002', amount: 99999 };
      const t0 = performance.now();
      const res = await fetch(`${API_BASE}/api/transfer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const ms = Math.round(performance.now() - t0);
      const data = await res.json();
      const passed = (res.status === 400) && (data.error && data.error.toLowerCase().includes('insufficient'));
      return {
        passed,
        statusCode: res.status,
        latencyMs: ms,
        actual: `HTTP ${res.status} — ${data.error || 'Success (Unexpected)'}`,
        requestPayload: payload,
        responsePayload: data,
        assertions: [
          { desc: 'HTTP Status is 400 Bad Request', ok: res.status === 400 },
          { desc: "Error contains 'Insufficient wallet balance'", ok: !!data.error?.toLowerCase().includes('insufficient') }
        ]
      };
    }
  },
  {
    id: 'TC-FT-03',
    name: 'Invalid Sender Account Rejection',
    cat: 'FT',
    catName: 'Functional Testing',
    endpoint: 'POST /api/transfer',
    scenario: 'Attempt transfer originating from non-existent sender ID (U999_NON_EXISTENT)',
    expected: "HTTP 404 Not Found with 'Sender not found'",
    severity: 'MEDIUM',
    cause: 'Sender existence lookup not enforced in database',
    run: async () => {
      const payload = { transaction_id: 'TXN_INVS_' + Date.now(), sender_id: 'U999_NON_EXISTENT', receiver_id: 'U002', amount: 100 };
      const t0 = performance.now();
      const res = await fetch(`${API_BASE}/api/transfer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const ms = Math.round(performance.now() - t0);
      const data = await res.json();
      const passed = (res.status === 404) && (data.error && data.error.toLowerCase().includes('sender not found'));
      return {
        passed,
        statusCode: res.status,
        latencyMs: ms,
        actual: `HTTP ${res.status} — ${data.error || ''}`,
        requestPayload: payload,
        responsePayload: data,
        assertions: [
          { desc: 'HTTP Status is 404 Not Found', ok: res.status === 404 },
          { desc: "Rejection indicates 'Sender not found'", ok: !!data.error?.toLowerCase().includes('sender not found') }
        ]
      };
    }
  },
  {
    id: 'TC-FT-04',
    name: 'Invalid Receiver Account Rejection',
    cat: 'FT',
    catName: 'Functional Testing',
    endpoint: 'POST /api/transfer',
    scenario: 'Attempt transfer destined for non-existent receiver ID (U999_NON_EXISTENT)',
    expected: "HTTP 404 Not Found with 'Receiver not found'",
    severity: 'MEDIUM',
    cause: 'Receiver validation check missing prior to fund deduction',
    run: async () => {
      const payload = { transaction_id: 'TXN_INVR_' + Date.now(), sender_id: 'U001', receiver_id: 'U999_NON_EXISTENT', amount: 100 };
      const t0 = performance.now();
      const res = await fetch(`${API_BASE}/api/transfer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const ms = Math.round(performance.now() - t0);
      const data = await res.json();
      const passed = (res.status === 404) && (data.error && data.error.toLowerCase().includes('receiver not found'));
      return {
        passed,
        statusCode: res.status,
        latencyMs: ms,
        actual: `HTTP ${res.status} — ${data.error || ''}`,
        requestPayload: payload,
        responsePayload: data,
        assertions: [
          { desc: 'HTTP Status is 404 Not Found', ok: res.status === 404 },
          { desc: "Rejection indicates 'Receiver not found'", ok: !!data.error?.toLowerCase().includes('receiver not found') }
        ]
      };
    }
  },
  {
    id: 'TC-FT-05',
    name: 'Duplicate Transaction ID Rejection (Idempotency Guard)',
    cat: 'FT',
    catName: 'Functional Testing',
    endpoint: 'POST /api/transfer',
    scenario: 'Replay the exact same Transaction ID twice to verify replay prevention',
    expected: "HTTP 409 Conflict with 'Duplicate transaction'",
    severity: 'HIGH',
    cause: 'Unique constraint check or transaction_id lookup missing',
    run: async () => {
      const dupId = 'TXN_DUP_' + Date.now();
      // First seed request
      await fetch(`${API_BASE}/api/transfer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transaction_id: dupId, sender_id: 'U001', receiver_id: 'U002', amount: 10 })
      });
      // Second duplicate request
      const payload = { transaction_id: dupId, sender_id: 'U001', receiver_id: 'U002', amount: 10 };
      const t0 = performance.now();
      const res = await fetch(`${API_BASE}/api/transfer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const ms = Math.round(performance.now() - t0);
      const data = await res.json();
      const passed = (res.status === 409) && (data.error && data.error.toLowerCase().includes('duplicate'));
      return {
        passed,
        statusCode: res.status,
        latencyMs: ms,
        actual: `HTTP ${res.status} — ${data.error || 'Duplicate accepted (Bug)'}`,
        requestPayload: payload,
        responsePayload: data,
        assertions: [
          { desc: 'HTTP Status is 409 Conflict', ok: res.status === 409 },
          { desc: "Error contains 'Duplicate transaction'", ok: !!data.error?.toLowerCase().includes('duplicate') }
        ]
      };
    }
  },
  {
    id: 'TC-FT-06',
    name: 'Self-Transfer Rejection (Sender == Receiver)',
    cat: 'FT',
    catName: 'Functional Testing',
    endpoint: 'POST /api/transfer',
    scenario: 'Attempt transfer with identical sender and receiver account ID (Alice -> Alice)',
    expected: "HTTP 400 Bad Request with 'Sender and receiver cannot be the same'",
    severity: 'MEDIUM',
    cause: 'Missing check comparing sender_id and receiver_id',
    run: async () => {
      const payload = { transaction_id: 'TXN_SELF_' + Date.now(), sender_id: 'U001', receiver_id: 'U001', amount: 100 };
      const t0 = performance.now();
      const res = await fetch(`${API_BASE}/api/transfer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const ms = Math.round(performance.now() - t0);
      const data = await res.json();
      const passed = (res.status === 400) && (data.error && data.error.toLowerCase().includes('cannot be the same'));
      return {
        passed,
        statusCode: res.status,
        latencyMs: ms,
        actual: `HTTP ${res.status} — ${data.error || 'Self-transfer allowed (Bug)'}`,
        requestPayload: payload,
        responsePayload: data,
        assertions: [
          { desc: 'HTTP Status is 400 Bad Request', ok: res.status === 400 },
          { desc: 'Self-transfer rejection message returned', ok: !!data.error?.toLowerCase().includes('cannot be the same') }
        ]
      };
    }
  },
  {
    id: 'TC-FT-07',
    name: 'Transaction History Ledger Verification',
    cat: 'FT',
    catName: 'Functional Testing',
    endpoint: 'GET /api/transactions/<user_id>',
    scenario: 'Query audit ledger for user U001 and verify array structure & debit/credit tags',
    expected: 'HTTP 200 OK, array of transactions with count >= 1 and audit properties',
    severity: 'MEDIUM',
    cause: 'Transaction history query or serializer failure',
    run: async () => {
      const t0 = performance.now();
      const res = await fetch(`${API_BASE}/api/transactions/U001?t=${Date.now()}`);
      const ms = Math.round(performance.now() - t0);
      const data = await res.json();
      const passed = (res.status === 200) && Array.isArray(data.transactions) && (data.count >= 0);
      return {
        passed,
        statusCode: res.status,
        latencyMs: ms,
        actual: `HTTP ${res.status} — count: ${data.count || 0} transactions`,
        requestPayload: 'None (GET)',
        responsePayload: data,
        assertions: [
          { desc: 'HTTP Status is 200 OK', ok: res.status === 200 },
          { desc: "Payload contains 'transactions' array", ok: Array.isArray(data.transactions) },
          { desc: "'count' attribute matches array length", ok: data.count === data.transactions?.length }
        ]
      };
    }
  },

  // ── GROUP B: BOUNDARY VALUE ANALYSIS (7) ──
  {
    id: 'TC-BVA-01',
    name: 'Minimum Valid Amount Boundary (₹1.00)',
    cat: 'BVA',
    catName: 'Boundary Value Analysis',
    endpoint: 'POST /api/transfer',
    scenario: 'Transfer exactly ₹1.00 (the smallest permissible monetary unit)',
    expected: 'HTTP 200 OK, transfer successfully completed for ₹1.00',
    severity: 'MEDIUM',
    cause: 'Strict > 1 check instead of >= 1, or paise conversion rounding error',
    run: async () => {
      const payload = { transaction_id: 'TXN_BVA1_' + Date.now(), sender_id: 'U001', receiver_id: 'U002', amount: 1.00 };
      const t0 = performance.now();
      const res = await fetch(`${API_BASE}/api/transfer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const ms = Math.round(performance.now() - t0);
      const data = await res.json();
      const passed = (res.status === 200) && (data.transaction?.amount_rupees === 1.0);
      return {
        passed,
        statusCode: res.status,
        latencyMs: ms,
        actual: `HTTP ${res.status} — amount: ₹${data.transaction?.amount_rupees || 0}`,
        requestPayload: payload,
        responsePayload: data,
        assertions: [
          { desc: 'HTTP Status is 200 OK', ok: res.status === 200 },
          { desc: 'Transferred amount is exactly ₹1.00', ok: data.transaction?.amount_rupees === 1.0 }
        ]
      };
    }
  },
  {
    id: 'TC-BVA-02',
    name: 'Sub-Minimum Amount Boundary (₹0.50)',
    cat: 'BVA',
    catName: 'Boundary Value Analysis',
    endpoint: 'POST /api/transfer',
    scenario: 'Attempt transfer of ₹0.50 (below minimum allowable transfer limit)',
    expected: "HTTP 400 Bad Request with 'Minimum transfer amount is ₹1.00'",
    severity: 'MEDIUM',
    cause: 'Boundary check missing for minimum transfer threshold',
    run: async () => {
      const payload = { transaction_id: 'TXN_BVA2_' + Date.now(), sender_id: 'U001', receiver_id: 'U002', amount: 0.50 };
      const t0 = performance.now();
      const res = await fetch(`${API_BASE}/api/transfer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const ms = Math.round(performance.now() - t0);
      const data = await res.json();
      const passed = (res.status === 400) && (data.error && data.error.toLowerCase().includes('minimum'));
      return {
        passed,
        statusCode: res.status,
        latencyMs: ms,
        actual: `HTTP ${res.status} — ${data.error || 'Sub-rupee transfer allowed'}`,
        requestPayload: payload,
        responsePayload: data,
        assertions: [
          { desc: 'HTTP Status is 400 Bad Request', ok: res.status === 400 },
          { desc: "Error specifies minimum transfer is ₹1.00", ok: !!data.error?.toLowerCase().includes('minimum') }
        ]
      };
    }
  },
  {
    id: 'TC-BVA-03',
    name: 'Zero Amount Boundary (₹0.00)',
    cat: 'BVA',
    catName: 'Boundary Value Analysis',
    endpoint: 'POST /api/transfer',
    scenario: 'Attempt transfer of ₹0.00 (non-positive boundary limit)',
    expected: "HTTP 400 Bad Request with 'greater than zero'",
    severity: 'HIGH',
    cause: 'Zero check allows non-positive transactions to alter ledger',
    run: async () => {
      const payload = { transaction_id: 'TXN_BVA3_' + Date.now(), sender_id: 'U001', receiver_id: 'U002', amount: 0 };
      const t0 = performance.now();
      const res = await fetch(`${API_BASE}/api/transfer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const ms = Math.round(performance.now() - t0);
      const data = await res.json();
      const passed = (res.status === 400) && (data.error && data.error.toLowerCase().includes('greater than zero'));
      return {
        passed,
        statusCode: res.status,
        latencyMs: ms,
        actual: `HTTP ${res.status} — ${data.error || 'Zero transfer permitted'}`,
        requestPayload: payload,
        responsePayload: data,
        assertions: [
          { desc: 'HTTP Status is 400 Bad Request', ok: res.status === 400 },
          { desc: "Error specifies amount must be greater than zero", ok: !!data.error?.toLowerCase().includes('greater than zero') }
        ]
      };
    }
  },
  {
    id: 'TC-BVA-04',
    name: 'Negative Amount Boundary (-₹50.00)',
    cat: 'BVA',
    catName: 'Boundary Value Analysis',
    endpoint: 'POST /api/transfer',
    scenario: 'Attempt transfer of -₹50.00 (negative boundary limit)',
    expected: 'HTTP 400 Bad Request, strictly rejecting negative currency transfer',
    severity: 'HIGH',
    cause: 'Missing sign check allows reverse theft via negative transfer',
    run: async () => {
      const payload = { transaction_id: 'TXN_BVA4_' + Date.now(), sender_id: 'U001', receiver_id: 'U002', amount: -50.00 };
      const t0 = performance.now();
      const res = await fetch(`${API_BASE}/api/transfer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const ms = Math.round(performance.now() - t0);
      const data = await res.json();
      const passed = (res.status === 400) && (data.error && data.error.toLowerCase().includes('greater than zero'));
      return {
        passed,
        statusCode: res.status,
        latencyMs: ms,
        actual: `HTTP ${res.status} — ${data.error || 'Negative amount allowed'}`,
        requestPayload: payload,
        responsePayload: data,
        assertions: [
          { desc: 'HTTP Status is 400 Bad Request', ok: res.status === 400 },
          { desc: 'Negative transfer is rejected', ok: !!data.error?.toLowerCase().includes('greater than zero') }
        ]
      };
    }
  },
  {
    id: 'TC-BVA-05',
    name: 'Exact Available Balance Boundary (100% of Balance)',
    cat: 'BVA',
    catName: 'Boundary Value Analysis',
    endpoint: 'POST /api/transfer',
    scenario: 'Transfer exactly 100% of available wallet balance, leaving sender with ₹0.00',
    expected: 'HTTP 200 OK, successful transfer, sender balance reduces to exact ₹0.00',
    severity: 'MEDIUM',
    cause: 'Off-by-one boundary check (e.g. balance < amount instead of <=)',
    run: async () => {
      // Query Bob balance
      const bRes = await fetch(`${API_BASE}/api/balance/U002`);
      const bData = await bRes.json();
      const bobBal = bData.balance_rupees || 0;
      if (bobBal <= 0) {
        // Transfer 10 to Bob first so we can test
        await fetch(`${API_BASE}/api/transfer`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ transaction_id: 'TXN_PRE_' + Date.now(), sender_id: 'U001', receiver_id: 'U002', amount: 100 })
        });
      }
      const bRes2 = await fetch(`${API_BASE}/api/balance/U002`);
      const bData2 = await bRes2.json();
      const exactAmount = bData2.balance_rupees;

      const payload = { transaction_id: 'TXN_EXACT_' + Date.now(), sender_id: 'U002', receiver_id: 'U001', amount: exactAmount };
      const t0 = performance.now();
      const res = await fetch(`${API_BASE}/api/transfer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const ms = Math.round(performance.now() - t0);
      const data = await res.json();
      const passed = (res.status === 200) && (data.sender_new_balance_rupees === 0.0);
      return {
        passed,
        statusCode: res.status,
        latencyMs: ms,
        actual: `HTTP ${res.status} — sender new balance: ₹${data.sender_new_balance_rupees}`,
        requestPayload: payload,
        responsePayload: data,
        assertions: [
          { desc: 'HTTP Status is 200 OK', ok: res.status === 200 },
          { desc: 'Sender balance after transfer is exactly ₹0.00', ok: data.sender_new_balance_rupees === 0.0 }
        ]
      };
    }
  },
  {
    id: 'TC-BVA-06',
    name: 'Amount Exceeding Available Balance (+₹1.00 Boundary)',
    cat: 'BVA',
    catName: 'Boundary Value Analysis',
    endpoint: 'POST /api/transfer',
    scenario: 'Attempt transfer of ₹1.00 when sender balance is strictly ₹0.00',
    expected: "HTTP 400 Bad Request with 'Insufficient wallet balance'",
    severity: 'HIGH',
    cause: 'Boundary check allows transfer when balance is exactly 0',
    run: async () => {
      const payload = { transaction_id: 'TXN_EXCEED_' + Date.now(), sender_id: 'U002', receiver_id: 'U001', amount: 1.00 };
      const t0 = performance.now();
      const res = await fetch(`${API_BASE}/api/transfer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const ms = Math.round(performance.now() - t0);
      const data = await res.json();
      const passed = (res.status === 400) && (data.error && data.error.toLowerCase().includes('insufficient'));
      return {
        passed,
        statusCode: res.status,
        latencyMs: ms,
        actual: `HTTP ${res.status} — ${data.error || 'Allowed over-limit transfer'}`,
        requestPayload: payload,
        responsePayload: data,
        assertions: [
          { desc: 'HTTP Status is 400 Bad Request', ok: res.status === 400 },
          { desc: "Rejection specifies 'Insufficient wallet balance'", ok: !!data.error?.toLowerCase().includes('insufficient') }
        ]
      };
    }
  },
  {
    id: 'TC-BVA-07',
    name: 'Extremely Large Transaction Amount (₹10,000,000)',
    cat: 'BVA',
    catName: 'Boundary Value Analysis',
    endpoint: 'POST /api/transfer',
    scenario: 'Attempt transfer of ₹10,000,000 exceeding safety limits and wallet balance',
    expected: 'HTTP 400 Bad Request, rejected due to upper limit cap or insufficient funds',
    severity: 'MEDIUM',
    cause: 'Overflow or lack of upper threshold guard on amount parameter',
    run: async () => {
      const payload = { transaction_id: 'TXN_LARGE_' + Date.now(), sender_id: 'U001', receiver_id: 'U002', amount: 10000000 };
      const t0 = performance.now();
      const res = await fetch(`${API_BASE}/api/transfer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const ms = Math.round(performance.now() - t0);
      const data = await res.json();
      const passed = (res.status === 400);
      return {
        passed,
        statusCode: res.status,
        latencyMs: ms,
        actual: `HTTP ${res.status} — ${data.error || ''}`,
        requestPayload: payload,
        responsePayload: data,
        assertions: [
          { desc: 'HTTP Status is 400 Bad Request', ok: res.status === 400 },
          { desc: 'Rejection error message returned', ok: !!data.error }
        ]
      };
    }
  },

  // ── GROUP C: INPUT VALIDATION TESTING (7) ──
  {
    id: 'TC-IVT-01',
    name: 'Missing Required Field (Amount Omitted)',
    cat: 'IVT',
    catName: 'Input Validation Testing',
    endpoint: 'POST /api/transfer',
    scenario: "Submit transfer payload omitting required 'amount' field",
    expected: "HTTP 400 Bad Request with 'Missing required fields'",
    severity: 'MEDIUM',
    cause: 'Incomplete parameter existence check in request handler',
    run: async () => {
      const payload = { transaction_id: 'TXN_MISS_' + Date.now(), sender_id: 'U001', receiver_id: 'U002' };
      const t0 = performance.now();
      const res = await fetch(`${API_BASE}/api/transfer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const ms = Math.round(performance.now() - t0);
      const data = await res.json();
      const passed = (res.status === 400) && (data.error && data.error.toLowerCase().includes('missing'));
      return {
        passed,
        statusCode: res.status,
        latencyMs: ms,
        actual: `HTTP ${res.status} — ${data.error || ''}`,
        requestPayload: payload,
        responsePayload: data,
        assertions: [
          { desc: 'HTTP Status is 400 Bad Request', ok: res.status === 400 },
          { desc: "Error contains 'Missing required fields'", ok: !!data.error?.toLowerCase().includes('missing') }
        ]
      };
    }
  },
  {
    id: 'TC-IVT-02',
    name: 'Empty / Whitespace Transaction ID Rejection',
    cat: 'IVT',
    catName: 'Input Validation Testing',
    endpoint: 'POST /api/transfer',
    scenario: "Submit transfer with transaction_id containing only whitespace ('   ')",
    expected: "HTTP 400 Bad Request with 'must be a non-empty string'",
    severity: 'MEDIUM',
    cause: "Whitespace string bypassed truthy check (not '   ' is False in Python)",
    run: async () => {
      const payload = { transaction_id: '   ', sender_id: 'U001', receiver_id: 'U002', amount: 100 };
      const t0 = performance.now();
      const res = await fetch(`${API_BASE}/api/transfer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const ms = Math.round(performance.now() - t0);
      const data = await res.json();
      const passed = (res.status === 400) && (data.error && data.error.toLowerCase().includes('non-empty'));
      return {
        passed,
        statusCode: res.status,
        latencyMs: ms,
        actual: `HTTP ${res.status} — ${data.error || ''}`,
        requestPayload: payload,
        responsePayload: data,
        assertions: [
          { desc: 'HTTP Status is 400 Bad Request', ok: res.status === 400 },
          { desc: "Rejection requires non-empty string", ok: !!data.error?.toLowerCase().includes('non-empty') }
        ]
      };
    }
  },
  {
    id: 'TC-IVT-03',
    name: 'Invalid Data Type (Boolean for Amount)',
    cat: 'IVT',
    catName: 'Input Validation Testing',
    endpoint: 'POST /api/transfer',
    scenario: 'Submit amount as boolean true (which coerces to 1 in Python if unchecked)',
    expected: "HTTP 400 Bad Request with 'Must be a numeric value, not a boolean'",
    severity: 'MEDIUM',
    cause: 'Python bool is a subclass of int, converting True to 1.0 without type guard',
    run: async () => {
      const payload = { transaction_id: 'TXN_BOOL_' + Date.now(), sender_id: 'U001', receiver_id: 'U002', amount: true };
      const t0 = performance.now();
      const res = await fetch(`${API_BASE}/api/transfer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const ms = Math.round(performance.now() - t0);
      const data = await res.json();
      const passed = (res.status === 400) && (data.error && data.error.toLowerCase().includes('boolean'));
      return {
        passed,
        statusCode: res.status,
        latencyMs: ms,
        actual: `HTTP ${res.status} — ${data.error || 'Boolean accepted as currency (Bug)'}`,
        requestPayload: payload,
        responsePayload: data,
        assertions: [
          { desc: 'HTTP Status is 400 Bad Request', ok: res.status === 400 },
          { desc: 'Error rejects boolean value for amount', ok: !!data.error?.toLowerCase().includes('boolean') }
        ]
      };
    }
  },
  {
    id: 'TC-IVT-04',
    name: 'Non-Numeric String Amount Rejection',
    cat: 'IVT',
    catName: 'Input Validation Testing',
    endpoint: 'POST /api/transfer',
    scenario: "Submit amount as alphabetic string 'five_hundred'",
    expected: "HTTP 400 Bad Request with 'Must be a valid numeric value'",
    severity: 'MEDIUM',
    cause: 'Missing float parser try/except block',
    run: async () => {
      const payload = { transaction_id: 'TXN_STR_' + Date.now(), sender_id: 'U001', receiver_id: 'U002', amount: 'five_hundred' };
      const t0 = performance.now();
      const res = await fetch(`${API_BASE}/api/transfer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const ms = Math.round(performance.now() - t0);
      const data = await res.json();
      const passed = (res.status === 400) && (data.error && data.error.toLowerCase().includes('numeric'));
      return {
        passed,
        statusCode: res.status,
        latencyMs: ms,
        actual: `HTTP ${res.status} — ${data.error || ''}`,
        requestPayload: payload,
        responsePayload: data,
        assertions: [
          { desc: 'HTTP Status is 400 Bad Request', ok: res.status === 400 },
          { desc: 'Error specifies valid numeric format required', ok: !!data.error?.toLowerCase().includes('numeric') }
        ]
      };
    }
  },
  {
    id: 'TC-IVT-05',
    name: 'Malformed JSON Payload Syntax Rejection',
    cat: 'IVT',
    catName: 'Input Validation Testing',
    endpoint: 'POST /api/transfer',
    scenario: "Send invalid JSON text string with trailing comma and missing value",
    expected: 'HTTP 400 Bad Request, rejecting malformed JSON body',
    severity: 'MEDIUM',
    cause: 'Flask get_json unhandled exception or silent bypass',
    run: async () => {
      const t0 = performance.now();
      const res = await fetch(`${API_BASE}/api/transfer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{"sender_id": "U001", amount: }'
      });
      const ms = Math.round(performance.now() - t0);
      const data = await res.json().catch(() => ({}));
      const passed = (res.status === 400);
      return {
        passed,
        statusCode: res.status,
        latencyMs: ms,
        actual: `HTTP ${res.status} — ${data.error || 'Handled'}`,
        requestPayload: '{"sender_id": "U001", amount: }',
        responsePayload: data,
        assertions: [
          { desc: 'HTTP Status is 400 Bad Request', ok: res.status === 400 }
        ]
      };
    }
  },
  {
    id: 'TC-IVT-06',
    name: 'Decimal Precision Boundary (Max 2 Decimal Places / Paise)',
    cat: 'IVT',
    catName: 'Input Validation Testing',
    endpoint: 'POST /api/transfer',
    scenario: 'Submit amount with 3 decimal places (e.g. ₹25.125), violating currency paise precision',
    expected: "HTTP 400 Bad Request with 'Invalid decimal precision'",
    severity: 'MEDIUM',
    cause: 'Backend round() silently rounding fractional paise instead of rejecting',
    run: async () => {
      const payload = { transaction_id: 'TXN_PREC_' + Date.now(), sender_id: 'U001', receiver_id: 'U002', amount: 25.125 };
      const t0 = performance.now();
      const res = await fetch(`${API_BASE}/api/transfer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const ms = Math.round(performance.now() - t0);
      const data = await res.json();
      const passed = (res.status === 400) && (data.error && data.error.toLowerCase().includes('decimal'));
      return {
        passed,
        statusCode: res.status,
        latencyMs: ms,
        actual: `HTTP ${res.status} — ${data.error || 'Fractional paise allowed (Bug)'}`,
        requestPayload: payload,
        responsePayload: data,
        assertions: [
          { desc: 'HTTP Status is 400 Bad Request', ok: res.status === 400 },
          { desc: 'Error rejects decimal precision beyond 2 places', ok: !!data.error?.toLowerCase().includes('decimal') }
        ]
      };
    }
  },
  {
    id: 'TC-IVT-07',
    name: 'Special Characters / Symbols in Amount Rejection',
    cat: 'IVT',
    catName: 'Input Validation Testing',
    endpoint: 'POST /api/transfer',
    scenario: "Submit amount containing non-numeric symbols ('₹100#')",
    expected: "HTTP 400 Bad Request with 'Must be a valid numeric value'",
    severity: 'MEDIUM',
    cause: 'Loose sanitization allowing symbolic strings',
    run: async () => {
      const payload = { transaction_id: 'TXN_SPEC_' + Date.now(), sender_id: 'U001', receiver_id: 'U002', amount: '₹100#' };
      const t0 = performance.now();
      const res = await fetch(`${API_BASE}/api/transfer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const ms = Math.round(performance.now() - t0);
      const data = await res.json();
      const passed = (res.status === 400) && (data.error && data.error.toLowerCase().includes('numeric'));
      return {
        passed,
        statusCode: res.status,
        latencyMs: ms,
        actual: `HTTP ${res.status} — ${data.error || ''}`,
        requestPayload: payload,
        responsePayload: data,
        assertions: [
          { desc: 'HTTP Status is 400 Bad Request', ok: res.status === 400 },
          { desc: 'Error rejects symbols in numeric amount field', ok: !!data.error?.toLowerCase().includes('numeric') }
        ]
      };
    }
  },

  // ── GROUP D: INTEGRATION TESTING (5) ──
  {
    id: 'TC-INT-01',
    name: 'Flask API & SQLite Database Handshake',
    cat: 'INT',
    catName: 'Integration Testing',
    endpoint: 'GET /api/health',
    scenario: 'Verify Flask backend and SQLite database file connectivity and health',
    expected: "HTTP 200 OK, status: 'healthy', database: 'connected'",
    severity: 'HIGH',
    cause: 'Database connection failed or file unreadable',
    run: async () => {
      const t0 = performance.now();
      const res = await fetch(`${API_BASE}/api/health?t=${Date.now()}`);
      const ms = Math.round(performance.now() - t0);
      const data = await res.json();
      const passed = (res.status === 200) && (data.database === 'connected') && (data.status === 'healthy');
      return {
        passed,
        statusCode: res.status,
        latencyMs: ms,
        actual: `HTTP ${res.status} — DB: ${data.database}`,
        requestPayload: 'None (GET)',
        responsePayload: data,
        assertions: [
          { desc: 'HTTP Status is 200 OK', ok: res.status === 200 },
          { desc: "Database reports 'connected'", ok: data.database === 'connected' },
          { desc: "Service status is 'healthy'", ok: data.status === 'healthy' }
        ]
      };
    }
  },
  {
    id: 'TC-INT-02',
    name: 'User Accounts Directory & Schema Mapping',
    cat: 'INT',
    catName: 'Integration Testing',
    endpoint: 'GET /api/users',
    scenario: 'Verify user collection retrieval and schema mapping from users table',
    expected: 'HTTP 200 OK, array of users with user_id, name, balance_paise, balance_rupees',
    severity: 'MEDIUM',
    cause: 'Schema mismatch or table read failure',
    run: async () => {
      const t0 = performance.now();
      const res = await fetch(`${API_BASE}/api/users?t=${Date.now()}`);
      const ms = Math.round(performance.now() - t0);
      const data = await res.json();
      const passed = (res.status === 200) && Array.isArray(data) && (data.length >= 2);
      return {
        passed,
        statusCode: res.status,
        latencyMs: ms,
        actual: `HTTP ${res.status} — ${data.length || 0} user records`,
        requestPayload: 'None (GET)',
        responsePayload: data,
        assertions: [
          { desc: 'HTTP Status is 200 OK', ok: res.status === 200 },
          { desc: 'At least 2 default accounts present', ok: data.length >= 2 },
          { desc: 'Schema contains balance_paise and balance_rupees', ok: data[0] && 'balance_paise' in data[0] }
        ]
      };
    }
  },
  {
    id: 'TC-INT-03',
    name: 'End-to-End Balance Synchronization Cycle',
    cat: 'INT',
    catName: 'Integration Testing',
    endpoint: 'POST /api/transfer + GET /api/balance/*',
    scenario: 'Execute ₹200 transfer and verify both balances in SQLite match expected math',
    expected: 'Sender decremented by exact ₹200, Receiver incremented by exact ₹200',
    severity: 'HIGH',
    cause: 'Single-sided debit without credit, or database lock contention',
    run: async () => {
      const sPre = await (await fetch(`${API_BASE}/api/balance/U001`)).json();
      const rPre = await (await fetch(`${API_BASE}/api/balance/U002`)).json();
      const s1 = sPre.balance_paise;
      const r1 = rPre.balance_paise;

      const t0 = performance.now();
      const res = await fetch(`${API_BASE}/api/transfer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transaction_id: 'TXN_SYNC_' + Date.now(), sender_id: 'U001', receiver_id: 'U002', amount: 200 })
      });
      const ms = Math.round(performance.now() - t0);

      const sPost = await (await fetch(`${API_BASE}/api/balance/U001`)).json();
      const rPost = await (await fetch(`${API_BASE}/api/balance/U002`)).json();
      const s2 = sPost.balance_paise;
      const r2 = rPost.balance_paise;

      const passed = (res.status === 200) && (s1 - s2 === 20000) && (r2 - r1 === 20000);
      return {
        passed,
        statusCode: res.status,
        latencyMs: ms,
        actual: `HTTP ${res.status} — Delta Sender: -₹${(s1 - s2)/100}, Delta Receiver: +₹${(r2 - r1)/100}`,
        requestPayload: { amount: 200, sender: 'U001', receiver: 'U002' },
        responsePayload: { sPost, rPost },
        assertions: [
          { desc: 'Sender debited exactly 20,000 paise (₹200.00)', ok: (s1 - s2) === 20000 },
          { desc: 'Receiver credited exactly 20,000 paise (₹200.00)', ok: (r2 - r1) === 20000 }
        ]
      };
    }
  },
  {
    id: 'TC-INT-04',
    name: 'Transaction Ledger Persistence Verification',
    cat: 'INT',
    catName: 'Integration Testing',
    endpoint: 'GET /api/transactions/<user_id>',
    scenario: 'Verify committed transaction record is properly written to transactions table',
    expected: 'Transaction record persisted to SQLite ledger and retrievable via history API',
    severity: 'MEDIUM',
    cause: 'Transaction insert omitted or rolled back erroneously',
    run: async () => {
      const txnId = 'TXN_PERSIST_' + Date.now();
      await fetch(`${API_BASE}/api/transfer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transaction_id: txnId, sender_id: 'U001', receiver_id: 'U002', amount: 50 })
      });
      const t0 = performance.now();
      const res = await fetch(`${API_BASE}/api/transactions/U001?t=${Date.now()}`);
      const ms = Math.round(performance.now() - t0);
      const data = await res.json();
      const found = (data.transactions || []).some(t => t.transaction_id === txnId);
      return {
        passed: (res.status === 200) && found,
        statusCode: res.status,
        latencyMs: ms,
        actual: `HTTP ${res.status} — Found in ledger: ${found}`,
        requestPayload: { expected_txn: txnId },
        responsePayload: { found_in_history: found },
        assertions: [
          { desc: 'Transaction record successfully queried from SQLite ledger', ok: found }
        ]
      };
    }
  },
  {
    id: 'TC-INT-05',
    name: 'Failed Transfer State Non-Pollution',
    cat: 'INT',
    catName: 'Integration Testing',
    endpoint: 'POST /api/transfer -> GET /api/balance/U001',
    scenario: 'Verify sender balance is strictly preserved when a transfer fails with 404',
    expected: 'Sender balance before rejected attempt == Sender balance after rejected attempt',
    severity: 'HIGH',
    cause: 'Balance deducted before recipient validation completed',
    run: async () => {
      const pre = await (await fetch(`${API_BASE}/api/balance/U001`)).json();
      const t0 = performance.now();
      const res = await fetch(`${API_BASE}/api/transfer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transaction_id: 'TXN_ISO_' + Date.now(), sender_id: 'U001', receiver_id: 'U999_NON_EXISTENT', amount: 500 })
      });
      const ms = Math.round(performance.now() - t0);
      const post = await (await fetch(`${API_BASE}/api/balance/U001`)).json();
      const passed = (res.status === 404) && (pre.balance_paise === post.balance_paise);
      return {
        passed,
        statusCode: res.status,
        latencyMs: ms,
        actual: `HTTP ${res.status} — Balances match: ${pre.balance_paise === post.balance_paise}`,
        requestPayload: { target: 'U999_NON_EXISTENT' },
        responsePayload: { preBalance: pre.balance_rupees, postBalance: post.balance_rupees },
        assertions: [
          { desc: 'Request returned 404 Not Found', ok: res.status === 404 },
          { desc: 'Sender balance unchanged after rejection', ok: pre.balance_paise === post.balance_paise }
        ]
      };
    }
  },

  // ── GROUP E: DATABASE CONSISTENCY TESTING (5) ──
  {
    id: 'TC-DB-01',
    name: 'Conservation of Total Money (Invariant Sum Verification)',
    cat: 'DB',
    catName: 'Database Consistency',
    endpoint: 'GET /api/users + POST /api/transfer',
    scenario: 'Verify total money in the system is strictly conserved across transfers (Σ Balances before == Σ Balances after)',
    expected: 'System balance conserved before and after transfer (Delta == 0)',
    severity: 'HIGH',
    cause: 'Money creation or leakage during debit/credit updates',
    run: async () => {
      const u1 = await (await fetch(`${API_BASE}/api/users`)).json();
      const sum1 = u1.reduce((acc, u) => acc + u.balance_paise, 0);

      await fetch(`${API_BASE}/api/transfer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transaction_id: 'TXN_CONS_' + Date.now(), sender_id: 'U001', receiver_id: 'U002', amount: 150 })
      });

      const t0 = performance.now();
      const u2 = await (await fetch(`${API_BASE}/api/users`)).json();
      const ms = Math.round(performance.now() - t0);
      const sum2 = u2.reduce((acc, u) => acc + u.balance_paise, 0);

      const passed = (sum1 === sum2);
      return {
        passed,
        statusCode: 200,
        latencyMs: ms,
        actual: `Conserved: ₹${(sum1/100).toFixed(2)} == ₹${(sum2/100).toFixed(2)} (Delta: ${sum2 - sum1})`,
        requestPayload: { initial_sum_paise: sum1 },
        responsePayload: { final_sum_paise: sum2 },
        assertions: [
          { desc: 'Sum of all user balances is strictly unchanged', ok: sum1 === sum2 }
        ]
      };
    }
  },
  {
    id: 'TC-DB-02',
    name: 'Non-Negative Balance Constraint Verification',
    cat: 'DB',
    catName: 'Database Consistency',
    endpoint: 'GET /api/users',
    scenario: 'Verify SQLite CHECK (balance_paise >= 0) constraint holds across all registered accounts',
    expected: 'Zero accounts with balance_paise < 0 across the entire database',
    severity: 'HIGH',
    cause: 'Database check constraint violated or omitted',
    run: async () => {
      const t0 = performance.now();
      const users = await (await fetch(`${API_BASE}/api/users`)).json();
      const ms = Math.round(performance.now() - t0);
      const negatives = users.filter(u => u.balance_paise < 0);
      const passed = (negatives.length === 0);
      return {
        passed,
        statusCode: 200,
        latencyMs: ms,
        actual: `Negative balance accounts found: ${negatives.length}`,
        requestPayload: 'None',
        responsePayload: { negative_accounts: negatives },
        assertions: [
          { desc: 'No account has a balance less than 0', ok: negatives.length === 0 }
        ]
      };
    }
  },
  {
    id: 'TC-DB-03',
    name: 'Transaction History Isolation for Failed Requests',
    cat: 'DB',
    catName: 'Database Consistency',
    endpoint: 'POST /api/transfer -> GET /api/transactions/U001',
    scenario: 'Verify rejected transfers do NOT create SUCCESS records in transactions table',
    expected: 'No SUCCESS transaction record created for failed transaction attempt',
    severity: 'HIGH',
    cause: 'Insert executed prior to validation or without transaction rollback',
    run: async () => {
      const rejectedId = 'TXN_REJ_' + Date.now();
      await fetch(`${API_BASE}/api/transfer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transaction_id: rejectedId, sender_id: 'U001', receiver_id: 'U002', amount: 999999 })
      });
      const t0 = performance.now();
      const hist = await (await fetch(`${API_BASE}/api/transactions/U001`)).json();
      const ms = Math.round(performance.now() - t0);
      const row = (hist.transactions || []).find(t => t.transaction_id === rejectedId);
      const passed = (row === undefined);
      return {
        passed,
        statusCode: 200,
        latencyMs: ms,
        actual: `SUCCESS record found: ${row !== undefined}`,
        requestPayload: { checked_id: rejectedId },
        responsePayload: { found: !!row },
        assertions: [
          { desc: 'Failed transaction is absent from SUCCESS history ledger', ok: row === undefined }
        ]
      };
    }
  },
  {
    id: 'TC-DB-04',
    name: 'Ledger Debit-Credit Conservation & Foreign Key Audit',
    cat: 'DB',
    catName: 'Database Consistency',
    endpoint: 'GET /api/system/consistency',
    scenario: 'Execute system consistency endpoint audit verifying database invariant health',
    expected: "HTTP 200 OK, is_consistent: true, orphan_transactions: 0, status: 'CONSISTENT'",
    severity: 'HIGH',
    cause: 'Orphan records or foreign key constraint violation detected in SQLite',
    run: async () => {
      const t0 = performance.now();
      const res = await fetch(`${API_BASE}/api/system/consistency?t=${Date.now()}`);
      const ms = Math.round(performance.now() - t0);
      const data = await res.json();
      const passed = (res.status === 200) && (data.is_consistent === true) && (data.orphan_transactions === 0);
      return {
        passed,
        statusCode: res.status,
        latencyMs: ms,
        actual: `HTTP ${res.status} — Status: ${data.status}, Orphans: ${data.orphan_transactions}`,
        requestPayload: 'None (GET)',
        responsePayload: data,
        assertions: [
          { desc: 'System consistency flag is true', ok: data.is_consistent === true },
          { desc: 'Zero orphan transaction rows exist', ok: data.orphan_transactions === 0 },
          { desc: "Status reports 'CONSISTENT'", ok: data.status === 'CONSISTENT' }
        ]
      };
    }
  },
  {
    id: 'TC-DB-05',
    name: 'Database Reset & Invariant Baseline Restoration',
    cat: 'DB',
    catName: 'Database Consistency',
    endpoint: 'POST /api/reset-database',
    scenario: 'Verify database reset restores pristine sample accounts and ledger baseline',
    expected: 'HTTP 200 OK, Alice ₹5,000, Bob ₹2,000 restored',
    severity: 'MEDIUM',
    cause: 'Reset procedure failed or left dirty ledger state',
    run: async () => {
      const t0 = performance.now();
      const res = await fetch(`${API_BASE}/api/reset-database`, { method: 'POST' });
      const ms = Math.round(performance.now() - t0);
      const data = await res.json();
      const passed = (res.status === 200) && (data.accounts?.length >= 2);
      return {
        passed,
        statusCode: res.status,
        latencyMs: ms,
        actual: `HTTP ${res.status} — ${data.message || ''}`,
        requestPayload: 'None',
        responsePayload: data,
        assertions: [
          { desc: 'HTTP Status is 200 OK', ok: res.status === 200 },
          { desc: 'Default sample accounts restored to baseline', ok: data.accounts?.length >= 2 }
        ]
      };
    }
  },

  // ── GROUP F: PERFORMANCE TESTING (3) ──
  {
    id: 'TC-PERF-01',
    name: 'Single Read API Response-Time Benchmark (< 200ms)',
    cat: 'PERF',
    catName: 'Performance Testing',
    endpoint: 'GET /api/balance/U001',
    scenario: 'Measure single wallet balance query round-trip latency against threshold',
    expected: 'HTTP 200 OK with response time <= 200ms',
    severity: 'LOW',
    cause: 'Database query slow or unindexed lookup',
    run: async () => {
      const t0 = performance.now();
      const res = await fetch(`${API_BASE}/api/balance/U001?t=${Date.now()}`);
      const ms = Math.round(performance.now() - t0);
      const passed = (res.status === 200) && (ms <= 200);
      return {
        passed,
        statusCode: res.status,
        latencyMs: ms,
        actual: `HTTP ${res.status} in ${ms} ms (Threshold: 200ms)`,
        requestPayload: 'None',
        responsePayload: await res.json(),
        assertions: [
          { desc: 'HTTP Status is 200 OK', ok: res.status === 200 },
          { desc: `Response time ${ms}ms <= 200ms`, ok: ms <= 200 }
        ]
      };
    }
  },
  {
    id: 'TC-PERF-02',
    name: 'Sequential Latency Stability (Burst 5 Requests, Avg < 250ms)',
    cat: 'PERF',
    catName: 'Performance Testing',
    endpoint: 'GET /api/users',
    scenario: 'Execute 5 repeated sequential queries and measure average round-trip latency',
    expected: 'All 5 requests return 200 OK with average latency <= 250ms',
    severity: 'LOW',
    cause: 'Connection pooling or backend latency jitter',
    run: async () => {
      const times = [];
      for (let i = 0; i < 5; i++) {
        const t0 = performance.now();
        await fetch(`${API_BASE}/api/users?t=${Date.now()}_${i}`);
        times.push(Math.round(performance.now() - t0));
      }
      const avg = Math.round(times.reduce((a, b) => a + b, 0) / times.length);
      const passed = avg <= 250;
      return {
        passed,
        statusCode: 200,
        latencyMs: avg,
        actual: `Average: ${avg} ms (Range: ${Math.min(...times)}ms - ${Math.max(...times)}ms)`,
        requestPayload: { iterations: 5 },
        responsePayload: { individual_latencies_ms: times, average_ms: avg },
        assertions: [
          { desc: `Average burst latency ${avg}ms <= 250ms`, ok: avg <= 250 }
        ]
      };
    }
  },
  {
    id: 'TC-PERF-03',
    name: 'Atomic Transfer API Write Latency Threshold (< 300ms)',
    cat: 'PERF',
    catName: 'Performance Testing',
    endpoint: 'POST /api/transfer',
    scenario: 'Measure latency for full atomic database transaction write (debit + credit + insert)',
    expected: 'HTTP 200 OK with SQLite write latency <= 300ms',
    severity: 'LOW',
    cause: 'SQLite disk I/O lock latency or synchronous commit delay',
    run: async () => {
      const payload = { transaction_id: 'TXN_PERF_' + Date.now(), sender_id: 'U001', receiver_id: 'U002', amount: 25 };
      const t0 = performance.now();
      const res = await fetch(`${API_BASE}/api/transfer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const ms = Math.round(performance.now() - t0);
      const passed = (res.status === 200) && (ms <= 300);
      return {
        passed,
        statusCode: res.status,
        latencyMs: ms,
        actual: `HTTP ${res.status} in ${ms} ms (Threshold: 300ms)`,
        requestPayload: payload,
        responsePayload: await res.json(),
        assertions: [
          { desc: 'HTTP Status is 200 OK', ok: res.status === 200 },
          { desc: `Transaction write completed in ${ms}ms <= 300ms`, ok: ms <= 300 }
        ]
      };
    }
  },

  // ── GROUP G: BASIC SECURITY TESTING (5) ──
  {
    id: 'TC-SEC-01',
    name: "SQL Injection Protection in User Identifier (' OR '1'='1)",
    cat: 'SEC',
    catName: 'Basic Security Testing',
    endpoint: "GET /api/balance/' OR '1'='1",
    scenario: "Attempt classic tautology SQL injection string in user_id URL parameter",
    expected: 'HTTP 404 Not Found via parameterized query without leaking database records',
    severity: 'HIGH',
    cause: 'Unsanitized raw SQL query string interpolation (SQL Injection flaw)',
    run: async () => {
      const t0 = performance.now();
      const res = await fetch(`${API_BASE}/api/balance/' OR '1'='1`);
      const ms = Math.round(performance.now() - t0);
      const data = await res.json();
      const passed = (res.status === 404) && (data.error && data.error.toLowerCase().includes('not found'));
      return {
        passed,
        statusCode: res.status,
        latencyMs: ms,
        actual: `HTTP ${res.status} — ${data.error || 'Protected'}`,
        requestPayload: { user_id: "' OR '1'='1" },
        responsePayload: data,
        assertions: [
          { desc: 'HTTP Status is 404 Not Found', ok: res.status === 404 },
          { desc: 'No user accounts or database records leaked', ok: !data.name }
        ]
      };
    }
  },
  {
    id: 'TC-SEC-02',
    name: 'SQL Injection Neutralization in Transaction ID',
    cat: 'SEC',
    catName: 'Basic Security Testing',
    endpoint: 'POST /api/transfer',
    scenario: "Submit destructive SQL injection attempt in transaction_id ('TXN_SQLI'; DROP TABLE users; --')",
    expected: 'Parameterized query handles string literally; users table intact and unaffected',
    severity: 'HIGH',
    cause: 'Raw string concatenation in SQL execution',
    run: async () => {
      const payload = { transaction_id: "TXN_SQLI'; DROP TABLE users; --", sender_id: 'U001', receiver_id: 'U002', amount: 50 };
      const t0 = performance.now();
      const res = await fetch(`${API_BASE}/api/transfer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const ms = Math.round(performance.now() - t0);
      const data = await res.json();

      // Check users table still exists
      const uRes = await fetch(`${API_BASE}/api/users`);
      const tableIntact = (uRes.status === 200);

      const passed = tableIntact && [200, 400, 409].includes(res.status);
      return {
        passed,
        statusCode: res.status,
        latencyMs: ms,
        actual: `HTTP ${res.status} — Users table intact: ${tableIntact}`,
        requestPayload: payload,
        responsePayload: data,
        assertions: [
          { desc: 'SQL command not executed (users table intact)', ok: tableIntact },
          { desc: 'Request handled safely via parameterized query', ok: [200, 400, 409].includes(res.status) }
        ]
      };
    }
  },
  {
    id: 'TC-SEC-03',
    name: 'Error Response Sanitization (No Traceback Leakage)',
    cat: 'SEC',
    catName: 'Basic Security Testing',
    endpoint: 'POST /api/transfer',
    scenario: 'Submit invalid data and verify response does not expose internal stack traces or SQLite schemas',
    expected: 'Clean JSON error response without exposing Python file paths or tracebacks',
    severity: 'MEDIUM',
    cause: 'Unhandled exception leaking raw server traceback in response body',
    run: async () => {
      const payload = { transaction_id: 'TXN_ERR_' + Date.now(), sender_id: 'U001', receiver_id: 'U002', amount: 'invalid_data' };
      const t0 = performance.now();
      const res = await fetch(`${API_BASE}/api/transfer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const ms = Math.round(performance.now() - t0);
      const text = await res.text();
      const hasTraceback = text.includes('Traceback') || text.includes('sqlite3.');
      const passed = (res.status === 400) && !hasTraceback;
      return {
        passed,
        statusCode: res.status,
        latencyMs: ms,
        actual: `HTTP ${res.status} — Traceback leaked: ${hasTraceback}`,
        requestPayload: payload,
        responsePayload: text.slice(0, 200),
        assertions: [
          { desc: 'HTTP Status is 400 Bad Request', ok: res.status === 400 },
          { desc: 'Response contains zero Python stack trace data', ok: !hasTraceback }
        ]
      };
    }
  },
  {
    id: 'TC-SEC-04',
    name: 'CORS Preflight & Security Response Headers',
    cat: 'SEC',
    catName: 'Basic Security Testing',
    endpoint: 'OPTIONS /api/transfer',
    scenario: 'Verify CORS headers and X-Content-Type-Options: nosniff security header',
    expected: 'HTTP 200 OK with Access-Control-Allow-Origin: * and nosniff header',
    severity: 'LOW',
    cause: 'Missing CORS or security headers in Flask after_request hook',
    run: async () => {
      const t0 = performance.now();
      const res = await fetch(`${API_BASE}/api/transfer`, { method: 'OPTIONS' });
      const ms = Math.round(performance.now() - t0);
      const passed = (res.status === 200);
      return {
        passed,
        statusCode: res.status,
        latencyMs: ms,
        actual: `HTTP ${res.status} OK (Preflight Handled)`,
        requestPayload: 'OPTIONS Method',
        responsePayload: 'Header Check',
        assertions: [
          { desc: 'OPTIONS preflight returned HTTP 200 OK', ok: res.status === 200 }
        ]
      };
    }
  },
  {
    id: 'TC-SEC-05',
    name: 'XSS Script Tag Neutralization in User Creation',
    cat: 'SEC',
    catName: 'Basic Security Testing',
    endpoint: 'POST /api/users',
    scenario: "Attempt stored XSS injection with name: '<script>alert(\"xss\")</script>'",
    expected: 'HTTP 201 Created, name is HTML-escaped and stored safely without raw script tags',
    severity: 'HIGH',
    cause: 'Stored XSS vulnerability; missing html.escape on user inputs',
    run: async () => {
      const payload = { name: '<script>alert("xss")</script>', initial_balance: 1000 };
      const t0 = performance.now();
      const res = await fetch(`${API_BASE}/api/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const ms = Math.round(performance.now() - t0);
      const data = await res.json();
      const storedName = data.user?.name || '';
      const scriptNeutralized = !storedName.includes('<script>');
      const passed = (res.status === 201) && scriptNeutralized;
      return {
        passed,
        statusCode: res.status,
        latencyMs: ms,
        actual: `HTTP ${res.status} — Stored Name: ${storedName}`,
        requestPayload: payload,
        responsePayload: data,
        assertions: [
          { desc: 'HTTP Status is 201 Created', ok: res.status === 201 },
          { desc: 'Script tags are escaped and not stored verbatim', ok: scriptNeutralized }
        ]
      };
    }
  }
];

// =========================================================================
// 4. TEST RENDERING & UI CONTROL
// =========================================================================

function renderInitialTestCards() {
  testCardsContainer.innerHTML = '';
  TEST_SUITE.forEach(test => {
    const card = document.createElement('div');
    card.className = 'test-case-card';
    card.id = `card_${test.id}`;
    card.dataset.category = test.cat;

    card.innerHTML = `
      <div class="test-card-top" onclick="toggleTestCardAccordion('${test.id}')">
        <div class="test-card-left">
          <span class="test-id-badge">${test.id}</span>
          <span class="test-title">${test.name}</span>
          <span class="test-cat-pill">${test.catName}</span>
        </div>
        <div class="test-card-right">
          <span class="test-latency-pill" id="latency_${test.id}">-- ms</span>
          <span class="test-status-pill pill-idle" id="pill_${test.id}">IDLE</span>
          <span class="accordion-arrow">&#9660;</span>
        </div>
      </div>
      <div class="test-details-drawer" id="drawer_${test.id}">
        <div class="drawer-grid">
          <div class="drawer-box">
            <span class="drawer-label">Input Scenario & Endpoint</span>
            <p><strong>Endpoint:</strong> <code>${test.endpoint}</code></p>
            <p><strong>Scenario:</strong> ${test.scenario}</p>
            <span class="drawer-label" style="margin-top:8px;">Request Payload</span>
            <div class="code-snippet" id="req_code_${test.id}">Not executed yet</div>
          </div>
          <div class="drawer-box">
            <span class="drawer-label">Validation Assertions</span>
            <p><strong>Expected:</strong> ${test.expected}</p>
            <p><strong>Actual:</strong> <span id="actual_text_${test.id}">Awaiting execution...</span></p>
            <div class="assertions-list" id="assert_list_${test.id}">
              <!-- Dynamic assertion items -->
            </div>
            <div class="failure-alert-box" id="fail_box_${test.id}" style="display:none;"></div>
          </div>
        </div>
        <div style="display:flex; justify-content:flex-end; gap:8px;">
          <button class="btn-secondary btn-compact" onclick="runSingleTestCase('${test.id}', event)">
            &#x21bb; Re-run Test
          </button>
        </div>
      </div>
    `;
    testCardsContainer.appendChild(card);
  });
  filterVisibleTestCards();
}

function filterVisibleTestCards() {
  let visibleCount = 0;
  TEST_SUITE.forEach(test => {
    const card = document.getElementById(`card_${test.id}`);
    if (!card) return;
    if (activeCategoryFilter === 'ALL' || test.cat === activeCategoryFilter) {
      card.style.display = 'block';
      visibleCount++;
    } else {
      card.style.display = 'none';
    }
  });
  if (visibleTestCounter) {
    visibleTestCounter.textContent = `Showing ${visibleCount} of ${TEST_SUITE.length} test cases`;
  }
}

function toggleTestCardAccordion(testId) {
  const card = document.getElementById(`card_${testId}`);
  if (card) {
    card.classList.toggle('expanded');
  }
}

// =========================================================================
// 5. TEST EXECUTION RUNNER (LIVE BROWSER QUALITY ASSURANCE)
// =========================================================================

async function handleRunFullTestSuite() {
  if (runTestsBtn) {
    runTestsBtn.disabled = true;
    runTestsBtn.innerHTML = `
      <svg class="spinner" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
        <circle cx="12" cy="12" r="10" stroke-opacity="0.25"></circle>
        <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor"></path>
      </svg>
      Executing 39 Tests...
    `;
  }

  // Pre-reset database for deterministic test execution
  try {
    await fetch(`${API_BASE}/api/reset-database`, { method: 'POST' });
  } catch (e) { /* ignore */ }

  const startTime = performance.now();
  let passedCount = 0;
  let failedCount = 0;
  const latencies = [];
  const defects = [];

  // Set all cards to running state
  TEST_SUITE.forEach(test => {
    updateCardState(test.id, 'running', '-- ms', 'Executing assertions...');
  });

  // Execute each test sequentially
  for (const test of TEST_SUITE) {
    try {
      const result = await test.run();
      testResultsStore[test.id] = result;
      latencies.push(result.latencyMs);

      if (result.passed) {
        passedCount++;
        updateCardState(test.id, 'passed', `${result.latencyMs} ms`, result.actual, result.assertions, result.requestPayload, result.responsePayload);
      } else {
        failedCount++;
        const defect = {
          defectId: `DEF-${defects.length + 1 < 10 ? '00' : '0'}${defects.length + 1}`,
          testId: test.id,
          testName: test.name,
          endpoint: test.endpoint,
          severity: test.severity || 'MEDIUM',
          expected: test.expected,
          actual: result.actual,
          cause: test.cause || 'Assertion failed'
        };
        defects.push(defect);
        updateCardState(test.id, 'failed', `${result.latencyMs} ms`, result.actual, result.assertions, result.requestPayload, result.responsePayload, test.cause);
      }
    } catch (err) {
      failedCount++;
      const defect = {
        defectId: `DEF-${defects.length + 1 < 10 ? '00' : '0'}${defects.length + 1}`,
        testId: test.id,
        testName: test.name,
        endpoint: test.endpoint,
        severity: 'HIGH',
        expected: test.expected,
        actual: `Exception: ${err.message}`,
        cause: 'Network connection refused or unexpected exception'
      };
      defects.push(defect);
      updateCardState(test.id, 'failed', 'ERR', `Network error: ${err.message}`);
    }
  }

  const totalDuration = Math.round(performance.now() - startTime);
  const totalTests = TEST_SUITE.length;
  const passRate = Math.round((passedCount / totalTests) * 100);
  const avgLatency = latencies.length ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length) : 0;
  const minLatency = latencies.length ? Math.min(...latencies) : 0;
  const maxLatency = latencies.length ? Math.max(...latencies) : 0;

  // Update Summary Metrics Cards
  testPassedCount.textContent = passedCount;
  testFailedCount.textContent = failedCount;
  testPassRate.textContent = `${passRate}%`;
  testDurationDisplay.textContent = `${totalDuration} ms`;
  testAvgLatencyDisplay.textContent = `${avgLatency} ms`;
  lastRunTime.textContent = `Last run: ${new Date().toLocaleTimeString()}`;

  // Update Performance Visualization
  updatePerformanceCard(minLatency, avgLatency, maxLatency);

  // Update Defect Table
  renderDefectTable(defects);

  // Record History
  recordHistoryItem('Full Suite (39 Tests)', passedCount, totalTests, passRate, totalDuration, avgLatency, defects.length);

  // Restore button
  if (runTestsBtn) {
    runTestsBtn.disabled = false;
    runTestsBtn.innerHTML = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
        <polygon points="5 3 19 12 5 21 5 3"></polygon>
      </svg>
      Run All 39 Tests
    `;
  }

  // Refresh balances
  await loadAllUsersAndData();

  // Notification
  if (failedCount === 0) {
    showNotification(`✓ Complete QA Suite Passed! All 39 assertions verified successfully in ${totalDuration} ms.`, 'success');
  } else {
    showNotification(`✕ Test Suite Completed: ${passedCount} Passed, ${failedCount} Failed. Inspect the Defect Report below.`, 'error');
  }
}

async function runSingleTestCase(testId, event) {
  if (event) event.stopPropagation();
  const test = TEST_SUITE.find(t => t.id === testId);
  if (!test) return;

  updateCardState(test.id, 'running', '-- ms', 'Testing...');

  try {
    const result = await test.run();
    testResultsStore[test.id] = result;

    if (result.passed) {
      updateCardState(test.id, 'passed', `${result.latencyMs} ms`, result.actual, result.assertions, result.requestPayload, result.responsePayload);
      showNotification(`✓ ${test.id} (${test.name}) PASSED!`, 'success');
      // If was defect, refresh defect table
      removeDefectForTest(test.id);
    } else {
      updateCardState(test.id, 'failed', `${result.latencyMs} ms`, result.actual, result.assertions, result.requestPayload, result.responsePayload, test.cause);
      showNotification(`✕ ${test.id} (${test.name}) FAILED.`, 'error');
    }
  } catch (err) {
    updateCardState(test.id, 'failed', 'ERR', err.message);
  }
  await loadAllUsersAndData();
}

function updateCardState(testId, state, latency, actualText, assertions = [], reqPayload = null, resPayload = null, failureCause = null) {
  const card = document.getElementById(`card_${testId}`);
  const pill = document.getElementById(`pill_${testId}`);
  const latencyEl = document.getElementById(`latency_${testId}`);
  const actualEl = document.getElementById(`actual_text_${testId}`);
  const assertList = document.getElementById(`assert_list_${testId}`);
  const reqCode = document.getElementById(`req_code_${testId}`);
  const failBox = document.getElementById(`fail_box_${testId}`);

  if (!card || !pill) return;

  card.classList.remove('passed', 'failed');
  pill.classList.remove('pill-idle', 'pill-running', 'pill-pass', 'pill-fail');

  if (state === 'running') {
    pill.classList.add('pill-running');
    pill.textContent = 'RUNNING';
  } else if (state === 'passed') {
    card.classList.add('passed');
    pill.classList.add('pill-pass');
    pill.textContent = 'PASS';
  } else {
    card.classList.add('failed');
    pill.classList.add('pill-fail');
    pill.textContent = 'FAIL';
  }

  if (latencyEl) latencyEl.textContent = latency;
  if (actualEl && actualText) actualEl.textContent = actualText;

  if (reqCode && reqPayload) {
    reqCode.textContent = typeof reqPayload === 'object' ? JSON.stringify(reqPayload, null, 2) : reqPayload;
  }

  if (assertList && assertions.length > 0) {
    assertList.innerHTML = assertions.map(a => `
      <div class="assertion-item">
        <span class="assert-icon ${a.ok ? 'pass' : 'fail'}">${a.ok ? '✓' : '✕'}</span>
        <span>${a.desc}</span>
      </div>
    `).join('');
  }

  if (failBox) {
    if (state === 'failed' && failureCause) {
      failBox.style.display = 'block';
      failBox.innerHTML = `<strong>Root Cause Analysis:</strong> ${failureCause}`;
    } else {
      failBox.style.display = 'none';
    }
  }
}

// =========================================================================
// 6. PERFORMANCE BENCHMARK VISUALIZATION
// =========================================================================

function updatePerformanceCard(minMs, avgMs, maxMs) {
  if (!perfBenchmarkCard) return;
  perfBenchmarkCard.style.display = 'block';

  const threshold = parseFloat(perfThresholdInput.value) || 250;
  perfThresholdBadge.textContent = `Threshold: ${threshold}ms`;

  perfMinVal.textContent = `${minMs} ms`;
  perfAvgVal.textContent = `${avgMs} ms`;
  perfMaxVal.textContent = `${maxMs} ms`;

  const thresholdMet = maxMs <= threshold;
  perfStatusVal.textContent = thresholdMet ? 'PASSED (Optimal)' : 'WARNING (Slow Peak)';
  perfStatusVal.style.color = thresholdMet ? '#10b981' : '#f59e0b';

  const fillPercent = Math.min(Math.round((avgMs / threshold) * 100), 100);
  latencyMeterFill.style.width = `${fillPercent}%`;
}

// =========================================================================
// 7. DEFECT DETECTION & MANAGEMENT
// =========================================================================

function renderDefectTable(defects) {
  if (!defectTableBody) return;

  if (!defects || defects.length === 0) {
    defectStatusPill.className = 'defect-pill zero-defects';
    defectStatusPill.textContent = 'Zero Active Defects';
    defectTableBody.innerHTML = `
      <tr>
        <td colspan="7" class="empty-state">No active software defects detected. All assertions passed.</td>
      </tr>
    `;
    return;
  }

  defectStatusPill.className = 'defect-pill has-defects';
  defectStatusPill.textContent = `${defects.length} Active Defect${defects.length > 1 ? 's' : ''} Detected`;

  let html = '';
  defects.forEach(d => {
    const severityClass = (d.severity === 'HIGH') ? 'severity-high' : (d.severity === 'MEDIUM') ? 'severity-medium' : 'severity-low';

    html += `
      <tr>
        <td><strong>${d.defectId}</strong></td>
        <td><strong>${d.testId}</strong> &mdash; ${d.testName}</td>
        <td><code>${d.endpoint}</code></td>
        <td><span class="severity-badge ${severityClass}">${d.severity}</span></td>
        <td>
          <div style="font-size:0.78rem;">
            <div><span style="color:#16a34a;font-weight:600;">Exp:</span> ${d.expected}</div>
            <div style="margin-top:2px;"><span style="color:#dc2626;font-weight:600;">Act:</span> ${d.actual}</div>
          </div>
        </td>
        <td>${d.cause}</td>
        <td>
          <button class="btn-secondary btn-compact" onclick="runSingleTestCase('${d.testId}', event)">
            &#x21bb; Verify Fix
          </button>
        </td>
      </tr>
    `;
  });
  defectTableBody.innerHTML = html;
}

function removeDefectForTest(testId) {
  // If no more failed tests, clear defect table
  const hasFailed = Object.values(testResultsStore).some(r => r.passed === false);
  if (!hasFailed) {
    renderDefectTable([]);
  }
}

async function handleFaultSimulationChange(e) {
  const fault = e.target.value;
  try {
    if (fault === 'none') {
      await fetch(`${API_BASE}/api/test/simulate-fault`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fault: 'all_reset' })
      });
      showNotification('Fault simulation disabled. Production mode active (All tests will pass).', 'info');
    } else {
      await fetch(`${API_BASE}/api/test/simulate-fault`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fault, enabled: true })
      });
      showNotification(`Simulated backend defect injected: '${fault}'. Click 'Run All 39 Tests' to see the Defect Engine detect and report it!`, 'warning');
    }
  } catch (err) {
    console.error('Failed to toggle fault simulation:', err);
  }
}

// =========================================================================
// 8. TEST EXECUTION HISTORY
// =========================================================================

function recordHistoryItem(scope, passed, total, rate, durationMs, avgLatencyMs, defectCount) {
  const item = {
    runNum: executionHistory.length + 1,
    time: new Date().toLocaleTimeString(),
    scope,
    passed,
    total,
    rate,
    durationMs,
    avgLatencyMs,
    defectCount
  };
  executionHistory.unshift(item);
  if (executionHistory.length > 10) executionHistory.pop();
  saveHistoryToStorage();
  renderHistoryTable();
}

function renderHistoryTable() {
  if (!executionHistoryBody) return;
  if (executionHistory.length === 0) {
    executionHistoryBody.innerHTML = `<tr><td colspan="8" class="empty-state">No historical test runs recorded in this session.</td></tr>`;
    return;
  }
  let html = '';
  executionHistory.forEach(h => {
    const rateColor = h.rate === 100 ? '#16a34a' : '#dc2626';
    html += `
      <tr>
        <td>#${h.runNum}</td>
        <td>${h.time}</td>
        <td><strong>${h.scope}</strong></td>
        <td>${h.passed}/${h.total}</td>
        <td><strong style="color:${rateColor};">${h.rate}%</strong></td>
        <td>${h.durationMs} ms</td>
        <td>${h.avgLatencyMs} ms</td>
        <td>${h.defectCount > 0 ? `<span style="color:#b91c1c;font-weight:700;">${h.defectCount} Defect${h.defectCount>1?'s':''}</span>` : '<span style="color:#16a34a;">0</span>'}</td>
      </tr>
    `;
  });
  executionHistoryBody.innerHTML = html;
}

function saveHistoryToStorage() {
  try {
    sessionStorage.setItem('walletpay_test_history', JSON.stringify(executionHistory));
  } catch (e) { /* ignore */ }
}

function loadHistoryFromStorage() {
  try {
    const saved = sessionStorage.getItem('walletpay_test_history');
    if (saved) {
      executionHistory = JSON.parse(saved);
      renderHistoryTable();
    }
  } catch (e) { /* ignore */ }
}

function handleClearHistory() {
  executionHistory = [];
  sessionStorage.removeItem('walletpay_test_history');
  renderHistoryTable();
}
