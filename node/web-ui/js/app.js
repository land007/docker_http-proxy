/**
 * HTTP Proxy Admin - Main Application
 */

// State management
const state = {
    currentView: 'dashboard',
    user: null,
    config: null,
    httpRules: [],
    wsRules: [],
    certificates: [],
    acme: {
        available: false,
        providers: [],
        defaultServer: '',
        certs: []
    },
    users: [],
    backups: []
};

// API helper functions
const api = {
    async request(url, options = {}) {
        const defaultOptions = {
            headers: {
                'Content-Type': 'application/json'
            }
        };

        const response = await fetch(url, { ...defaultOptions, ...options });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Request failed');
        }

        return response.json();
    },

    async get(url) {
        return this.request(url, { method: 'GET' });
    },

    async post(url, data) {
        return this.request(url, {
            method: 'POST',
            body: JSON.stringify(data)
        });
    },

    async postForm(url, formData) {
        const response = await fetch(url, {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Request failed');
        }

        return response.json();
    },

    async put(url, data) {
        return this.request(url, {
            method: 'PUT',
            body: JSON.stringify(data)
        });
    },

    async delete(url) {
        return this.request(url, { method: 'DELETE' });
    }
};

// UI helper functions
const ui = {
    showToast(message, type = 'info') {
        const toast = document.getElementById('toast');
        const toastTitle = document.getElementById('toastTitle');
        const toastBody = document.getElementById('toastBody');

        toastTitle.textContent = type.charAt(0).toUpperCase() + type.slice(1);
        toastBody.textContent = message;

        toast.classList.remove('text-bg-success', 'text-bg-danger', 'text-bg-warning', 'text-bg-info');

        const typeClass = {
            success: 'text-bg-success',
            error: 'text-bg-danger',
            warning: 'text-bg-warning',
            info: 'text-bg-info'
        }[type] || 'text-bg-info';

        toast.classList.add(typeClass);

        const bsToast = new bootstrap.Toast(toast);
        bsToast.show();
    },

    showLoading(show = true) {
        document.querySelectorAll('.loading').forEach(el => {
            el.classList.toggle('loading', show);
        });
    },

    formatDate(dateString) {
        if (!dateString) return '-';
        const date = new Date(dateString);
        return date.toLocaleString();
    },

    formatBytes(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
    },

    formatUptime(seconds) {
        const days = Math.floor(seconds / 86400);
        const hours = Math.floor((seconds % 86400) / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);

        if (days > 0) {
            return `${days}d ${hours}h ${minutes}m`;
        } else if (hours > 0) {
            return `${hours}h ${minutes}m`;
        } else {
            return `${minutes}m`;
        }
    }
};

// View management
function navigateTo(viewName) {
    // Update navigation
    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.remove('active');
        if (link.getAttribute('data-view') === viewName) {
            link.classList.add('active');
        }
    });

    // Hide all views
    document.querySelectorAll('.view').forEach(view => {
        view.classList.add('d-none');
    });

    // Show selected view
    const targetView = document.getElementById(`${viewName}-view`);
    if (targetView) {
        targetView.classList.remove('d-none');
    }

    state.currentView = viewName;

    // Load view-specific data
    loadViewData(viewName);
}

// Load data for specific view
async function loadViewData(viewName) {
    switch (viewName) {
        case 'dashboard':
            await loadDashboard();
            break;
        case 'http-rules':
            await loadHttpRules();
            break;
        case 'ws-rules':
            await loadWsRules();
            break;
        case 'certificates':
            await loadCertificates();
            break;
        case 'users':
            await loadUsers();
            break;
        case 'settings':
            await loadSettings();
            break;
        case 'backups':
            await loadBackups();
            break;
    }
}

// Dashboard
async function loadDashboard() {
    try {
        const status = await api.get('/api/status');
        const config = await api.get('/api/config');

        document.getElementById('httpRulesCount').textContent = status.httpRulesCount;
        document.getElementById('wsRulesCount').textContent = status.wsRulesCount;
        document.getElementById('certsCount').textContent = status.certificatesCount;

        document.getElementById('uptime').textContent = ui.formatUptime(status.uptime);
        document.getElementById('memoryUsed').textContent = ui.formatBytes(status.memory.heapUsed);
        document.getElementById('configVersion').textContent = status.version;
        document.getElementById('lastModified').textContent = ui.formatDate(status.lastModified);

        // Load users count
        const users = await api.get('/api/users');
        document.getElementById('usersCount').textContent = users.length;
    } catch (error) {
        console.error('Error loading dashboard:', error);
        ui.showToast('Failed to load dashboard', 'error');
    }
}

// HTTP Rules
async function loadHttpRules() {
    try {
        const rules = await api.get('/api/http-rules');
        state.httpRules = rules;
        renderHttpRules();
    } catch (error) {
        console.error('Error loading HTTP rules:', error);
        ui.showToast('Failed to load HTTP rules', 'error');
    }
}

function renderHttpRules() {
    const tbody = document.getElementById('httpRulesTable');

    if (state.httpRules.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="text-center">No HTTP proxy rules configured</td></tr>';
        return;
    }

    tbody.innerHTML = state.httpRules.map(rule => `
        <tr>
            <td>
                <span class="badge ${rule.enabled ? 'bg-success' : 'bg-secondary'}">
                    ${rule.enabled ? 'Enabled' : 'Disabled'}
                </span>
            </td>
            <td class="text-truncate">${rule.domain || '-'}</td>
            <td class="text-truncate">${rule.path}</td>
            <td class="text-truncate">${rule.targetHost}:${rule.targetPort}</td>
            <td>
                <span class="badge ${rule.protocol === 'https:' ? 'bg-primary' : 'bg-secondary'}">
                    ${rule.protocol === 'https:' ? 'HTTPS' : 'HTTP'}
                </span>
            </td>
            <td>${rule.pretendMode ? 'Yes' : 'No'}</td>
            <td>${rule.priority}</td>
            <td>
                <div class="action-buttons">
                    <button class="btn btn-sm btn-primary" onclick="editHttpRule('${rule.id}')">
                        <i class="bi bi-pencil"></i>
                    </button>
                    <button class="btn btn-sm btn-danger" onclick="deleteHttpRule('${rule.id}')">
                        <i class="bi bi-trash"></i>
                    </button>
                </div>
            </td>
        </tr>
    `).join('');
}

function editHttpRule(id) {
    const rule = state.httpRules.find(r => r.id === id);
    if (!rule) return;

    document.getElementById('httpRuleModalTitle').textContent = 'Edit HTTP Rule';
    document.getElementById('httpRuleId').value = rule.id;
    document.getElementById('httpRuleEnabled').checked = rule.enabled;
    document.getElementById('httpRuleProtocol').value = rule.protocol;
    document.getElementById('httpRuleDomain').value = rule.domain || '';
    document.getElementById('httpRulePath').value = rule.path;
    document.getElementById('httpRuleTargetHost').value = rule.targetHost;
    document.getElementById('httpRuleTargetPort').value = rule.targetPort;
    document.getElementById('httpRulePretendMode').checked = rule.pretendMode;
    document.getElementById('httpRulePriority').value = rule.priority;

    const modal = new bootstrap.Modal(document.getElementById('httpRuleModal'));
    modal.show();
}

async function deleteHttpRule(id) {
    if (!confirm('Are you sure you want to delete this rule?')) {
        return;
    }

    try {
        await api.delete(`/api/http-rules/${id}`);
        ui.showToast('Rule deleted successfully', 'success');
        await loadHttpRules();
    } catch (error) {
        console.error('Error deleting rule:', error);
        ui.showToast('Failed to delete rule', 'error');
    }
}

// WebSocket Rules
async function loadWsRules() {
    try {
        const rules = await api.get('/api/ws-rules');
        state.wsRules = rules;
        renderWsRules();
    } catch (error) {
        console.error('Error loading WS rules:', error);
        ui.showToast('Failed to load WebSocket rules', 'error');
    }
}

function renderWsRules() {
    const tbody = document.getElementById('wsRulesTable');

    if (state.wsRules.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="text-center">No WebSocket proxy rules configured</td></tr>';
        return;
    }

    tbody.innerHTML = state.wsRules.map(rule => `
        <tr>
            <td>
                <span class="badge ${rule.enabled ? 'bg-success' : 'bg-secondary'}">
                    ${rule.enabled ? 'Enabled' : 'Disabled'}
                </span>
            </td>
            <td class="text-truncate">${rule.domain || '-'}</td>
            <td class="text-truncate">${rule.path}</td>
            <td class="text-truncate">${rule.targetHost}:${rule.targetPort}</td>
            <td>
                <span class="badge ${rule.protocol === 'wss:' ? 'bg-primary' : 'bg-secondary'}">
                    ${rule.protocol === 'wss:' ? 'WSS' : 'WS'}
                </span>
            </td>
            <td>${rule.pretendMode ? 'Yes' : 'No'}</td>
            <td>${rule.priority}</td>
            <td>
                <div class="action-buttons">
                    <button class="btn btn-sm btn-primary" onclick="editWsRule('${rule.id}')">
                        <i class="bi bi-pencil"></i>
                    </button>
                    <button class="btn btn-sm btn-danger" onclick="deleteWsRule('${rule.id}')">
                        <i class="bi bi-trash"></i>
                    </button>
                </div>
            </td>
        </tr>
    `).join('');
}

function editWsRule(id) {
    const rule = state.wsRules.find(r => r.id === id);
    if (!rule) return;

    document.getElementById('wsRuleModalTitle').textContent = 'Edit WebSocket Rule';
    document.getElementById('wsRuleId').value = rule.id;
    document.getElementById('wsRuleEnabled').checked = rule.enabled;
    document.getElementById('wsRuleProtocol').value = rule.protocol;
    document.getElementById('wsRuleDomain').value = rule.domain || '';
    document.getElementById('wsRulePath').value = rule.path;
    document.getElementById('wsRuleTargetHost').value = rule.targetHost;
    document.getElementById('wsRuleTargetPort').value = rule.targetPort;
    document.getElementById('wsRulePretendMode').checked = rule.pretendMode;
    document.getElementById('wsRulePriority').value = rule.priority;

    const modal = new bootstrap.Modal(document.getElementById('wsRuleModal'));
    modal.show();
}

async function deleteWsRule(id) {
    if (!confirm('Are you sure you want to delete this rule?')) {
        return;
    }

    try {
        await api.delete(`/api/ws-rules/${id}`);
        ui.showToast('Rule deleted successfully', 'success');
        await loadWsRules();
    } catch (error) {
        console.error('Error deleting rule:', error);
        ui.showToast('Failed to delete rule', 'error');
    }
}

// Certificates
async function loadCertificates() {
    try {
        const certs = await api.get('/api/certificates');
        state.certificates = certs;
        renderCertificates();
        await loadAcme();
    } catch (error) {
        console.error('Error loading certificates:', error);
        ui.showToast('Failed to load certificates', 'error');
    }
}

async function loadAcme() {
    const section = document.getElementById('acmeSection');
    if (!section) return;

    try {
        const status = await api.get('/api/acme/status');
        state.acme.available = status.available;
        state.acme.providers = status.providers || [];
        state.acme.defaultServer = status.defaultServer || '';

        section.classList.toggle('d-none', !state.acme.available);

        if (!state.acme.available) {
            return;
        }

        renderAcmeProviders();
        state.acme.certs = await api.get('/api/acme/certs');
        renderAcmeCerts();
    } catch (error) {
        console.error('Error loading ACME status:', error);
        section.classList.add('d-none');
    }
}

function renderAcmeProviders() {
    const providerSelect = document.getElementById('acmeDnsProvider');
    const serverInput = document.getElementById('acmeServer');
    if (!providerSelect) return;

    providerSelect.innerHTML = state.acme.providers.map(provider => `
        <option value="${provider.id}">${provider.name}</option>
    `).join('');

    if (serverInput && !serverInput.value) {
        serverInput.value = state.acme.defaultServer || '';
    }

    renderAcmeCredentialFields();
}

function renderAcmeCredentialFields() {
    const providerId = document.getElementById('acmeDnsProvider').value;
    const provider = state.acme.providers.find(item => item.id === providerId);
    const fields = document.getElementById('acmeCredentialFields');

    if (!provider || !fields) {
        return;
    }

    fields.innerHTML = provider.fields.map(field => `
        <div class="col-md-6">
            <label class="form-label" for="acmeCred_${field.name}">${field.label}</label>
            <input
                class="form-control acme-credential"
                id="acmeCred_${field.name}"
                data-credential-name="${field.name}"
                type="${field.type || 'text'}"
                ${field.optional ? '' : 'required'}>
        </div>
    `).join('');
}

function renderAcmeCerts() {
    const tbody = document.getElementById('acmeCertsTable');
    if (!tbody) return;

    if (state.acme.certs.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="text-center">No ACME certificates configured</td></tr>';
        return;
    }

    tbody.innerHTML = state.acme.certs.map(cert => `
        <tr>
            <td>${cert.domain}</td>
            <td>${cert.expiresAt ? ui.formatDate(cert.expiresAt) : '-'}</td>
            <td class="text-truncate">${cert.certFile}</td>
            <td>
                <button class="btn btn-sm btn-success" onclick="renewAcmeCertificate('${cert.domain}')">
                    <i class="bi bi-arrow-clockwise"></i> Renew
                </button>
            </td>
        </tr>
    `).join('');
}

async function renewAcmeCertificate(domain) {
    try {
        await api.post(`/api/acme/${encodeURIComponent(domain)}/renew`);
        ui.showToast('Certificate renewed successfully', 'success');
        await loadCertificates();
    } catch (error) {
        console.error('Error renewing ACME certificate:', error);
        ui.showToast(error.message || 'Failed to renew certificate', 'error');
    }
}

function renderCertificates() {
    const tbody = document.getElementById('certsTable');

    if (state.certificates.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center">No SSL certificates configured</td></tr>';
        return;
    }

    tbody.innerHTML = state.certificates.map(cert => `
        <tr>
            <td>${cert.domain}</td>
            <td class="text-truncate">${cert.certFile}</td>
            <td class="text-truncate">${cert.keyFile}</td>
            <td>${cert.expiresAt ? ui.formatDate(cert.expiresAt) : '-'}</td>
            <td>
                <button class="btn btn-sm btn-danger" onclick="deleteCertificate('${cert.domain}')">
                    <i class="bi bi-trash"></i> Delete
                </button>
            </td>
        </tr>
    `).join('');
}

async function deleteCertificate(domain) {
    if (!confirm(`Are you sure you want to delete the certificate for ${domain}?`)) {
        return;
    }

    try {
        await api.delete(`/api/certificates/${domain}`);
        ui.showToast('Certificate deleted successfully', 'success');
        await loadCertificates();
    } catch (error) {
        console.error('Error deleting certificate:', error);
        ui.showToast('Failed to delete certificate', 'error');
    }
}

// Users
async function loadUsers() {
    try {
        const users = await api.get('/api/users');
        state.users = users;
        renderUsers();
    } catch (error) {
        console.error('Error loading users:', error);
        ui.showToast('Failed to load users', 'error');
    }
}

function renderUsers() {
    const tbody = document.getElementById('usersTable');

    if (state.users.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="text-center">No proxy users configured</td></tr>';
        return;
    }

    tbody.innerHTML = state.users.map(user => `
        <tr>
            <td>${user.host}</td>
            <td>${user.username}</td>
            <td class="text-truncate">${user.passwordHash}</td>
            <td>
                <button class="btn btn-sm btn-danger" onclick="deleteUser('${user.host}', '${user.username}')">
                    <i class="bi bi-trash"></i> Delete
                </button>
            </td>
        </tr>
    `).join('');
}

async function deleteUser(host, username) {
    if (!confirm(`Are you sure you want to delete user ${username}@${host}?`)) {
        return;
    }

    try {
        await api.delete(`/api/users/${encodeURIComponent(host)}/${encodeURIComponent(username)}`);
        ui.showToast('User deleted successfully', 'success');
        await loadUsers();
    } catch (error) {
        console.error('Error deleting user:', error);
        ui.showToast('Failed to delete user', 'error');
    }
}

// Settings
async function loadSettings() {
    try {
        const settings = await api.get('/api/settings');

        document.getElementById('maxSession').value = settings.maxSession || 0;
        document.getElementById('defaultUsername').value = settings.defaultAuth?.username || '';
        document.getElementById('defaultPassword').value = settings.defaultAuth?.password || '';
        document.getElementById('defaultAuthEnabled').checked = settings.defaultAuth?.enabled || false;
    } catch (error) {
        console.error('Error loading settings:', error);
        ui.showToast('Failed to load settings', 'error');
    }
}

async function saveSettings() {
    try {
        const settings = {
            maxSession: parseInt(document.getElementById('maxSession').value),
            defaultAuth: {
                enabled: document.getElementById('defaultAuthEnabled').checked,
                username: document.getElementById('defaultUsername').value,
                password: document.getElementById('defaultPassword').value
            }
        };

        await api.put('/api/settings', settings);
        ui.showToast('Settings saved successfully', 'success');
    } catch (error) {
        console.error('Error saving settings:', error);
        ui.showToast('Failed to save settings', 'error');
    }
}

// Backups
async function loadBackups() {
    try {
        const backups = await api.get('/api/backups');
        state.backups = backups;
        renderBackups();
    } catch (error) {
        console.error('Error loading backups:', error);
        ui.showToast('Failed to load backups', 'error');
    }
}

function renderBackups() {
    const tbody = document.getElementById('backupsTable');

    if (state.backups.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="text-center">No backups found</td></tr>';
        return;
    }

    tbody.innerHTML = state.backups.map(backup => `
        <tr>
            <td class="text-truncate">${backup.name}</td>
            <td>${ui.formatBytes(backup.size)}</td>
            <td>${ui.formatDate(backup.created)}</td>
            <td>
                <div class="action-buttons">
                    <button class="btn btn-sm btn-success" onclick="restoreBackup('${backup.name}')">
                        <i class="bi bi-arrow-clockwise"></i> Restore
                    </button>
                    <button class="btn btn-sm btn-danger" onclick="deleteBackup('${backup.name}')">
                        <i class="bi bi-trash"></i>
                    </button>
                </div>
            </td>
        </tr>
    `).join('');
}

async function createBackup() {
    try {
        await api.post('/api/backups');
        ui.showToast('Backup created successfully', 'success');
        await loadBackups();
    } catch (error) {
        console.error('Error creating backup:', error);
        ui.showToast('Failed to create backup', 'error');
    }
}

async function restoreBackup(name) {
    if (!confirm(`Are you sure you want to restore from backup ${name}? This will replace the current configuration.`)) {
        return;
    }

    try {
        await api.post(`/api/backups/${name}/restore`);
        ui.showToast('Backup restored successfully', 'success');
        await loadBackups();
    } catch (error) {
        console.error('Error restoring backup:', error);
        ui.showToast('Failed to restore backup', 'error');
    }
}

async function deleteBackup(name) {
    if (!confirm(`Are you sure you want to delete backup ${name}?`)) {
        return;
    }

    try {
        await api.delete(`/api/backups/${name}`);
        ui.showToast('Backup deleted successfully', 'success');
        await loadBackups();
    } catch (error) {
        console.error('Error deleting backup:', error);
        ui.showToast('Failed to delete backup', 'error');
    }
}

// Authentication
async function checkAuth() {
    try {
        const response = await api.get('/api/auth/me');
        state.user = response.user;
        document.getElementById('currentUser').textContent = response.user.username;
        if (response.user.mustChangePassword) {
            showChangePasswordModal();
        }
        return true;
    } catch (error) {
        // Redirect to login
        window.location.href = '/admin/login.html';
        return false;
    }
}

function showChangePasswordModal() {
    const modalEl = document.getElementById('changePasswordModal');
    if (!modalEl) return;

    const modal = new bootstrap.Modal(modalEl, {
        backdrop: 'static',
        keyboard: false
    });
    modal.show();
}

async function logout() {
    try {
        await api.post('/api/auth/logout');
        window.location.href = '/admin/login.html';
    } catch (error) {
        console.error('Error during logout:', error);
        ui.showToast('Logout failed', 'error');
    }
}

// Event Listeners
document.addEventListener('DOMContentLoaded', async () => {
    // Check authentication
    const isAuthenticated = await checkAuth();
    if (!isAuthenticated) return;

    // Navigation
    document.querySelectorAll('.nav-link[data-view]').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const view = link.getAttribute('data-view');
            navigateTo(view);
        });
    });

    // Logout button
    document.getElementById('logoutBtn').addEventListener('click', logout);

    document.getElementById('changePasswordBtn').addEventListener('click', async () => {
        const oldPassword = document.getElementById('oldAdminPassword').value;
        const newPassword = document.getElementById('newAdminPassword').value;
        const confirmPassword = document.getElementById('confirmAdminPassword').value;

        if (newPassword !== confirmPassword) {
            ui.showToast('New passwords do not match', 'error');
            return;
        }

        try {
            const response = await api.post('/api/auth/change-password', {
                oldPassword,
                newPassword
            });
            state.user = response.user;
            ui.showToast('Password changed successfully', 'success');
            bootstrap.Modal.getInstance(document.getElementById('changePasswordModal')).hide();
        } catch (error) {
            console.error('Error changing password:', error);
            ui.showToast(error.message || 'Failed to change password', 'error');
        }
    });

    // HTTP Rule buttons
    document.getElementById('addHttpRuleBtn').addEventListener('click', () => {
        document.getElementById('httpRuleModalTitle').textContent = 'Add HTTP Rule';
        document.getElementById('httpRuleForm').reset();
        document.getElementById('httpRuleId').value = '';
        document.getElementById('httpRuleEnabled').checked = true;
        document.getElementById('httpRulePretendMode').checked = true;
        document.getElementById('httpRulePriority').value = '1';
        document.getElementById('httpRuleTargetPort').value = '80';

        const modal = new bootstrap.Modal(document.getElementById('httpRuleModal'));
        modal.show();
    });

    document.getElementById('uploadCertBtn').addEventListener('click', () => {
        document.getElementById('certificateForm').reset();
        const modal = new bootstrap.Modal(document.getElementById('certificateModal'));
        modal.show();
    });

    document.getElementById('saveCertificateBtn').addEventListener('click', async () => {
        const formData = new FormData();
        formData.append('domain', document.getElementById('certificateDomain').value);
        formData.append('cert', document.getElementById('certificateCertFile').files[0]);
        formData.append('key', document.getElementById('certificateKeyFile').files[0]);

        try {
            await api.postForm('/api/certificates', formData);
            ui.showToast('Certificate uploaded successfully', 'success');
            bootstrap.Modal.getInstance(document.getElementById('certificateModal')).hide();
            await loadCertificates();
        } catch (error) {
            console.error('Error uploading certificate:', error);
            ui.showToast(error.message || 'Failed to upload certificate', 'error');
        }
    });

    document.getElementById('acmeDnsProvider').addEventListener('change', renderAcmeCredentialFields);

    document.getElementById('issueAcmeBtn').addEventListener('click', async () => {
        const credentials = {};
        document.querySelectorAll('.acme-credential').forEach(input => {
            credentials[input.dataset.credentialName] = input.value;
        });

        try {
            await api.post('/api/acme/issue', {
                domain: document.getElementById('acmeDomain').value,
                dnsProvider: document.getElementById('acmeDnsProvider').value,
                server: document.getElementById('acmeServer').value,
                credentials
            });
            ui.showToast('Certificate issued successfully', 'success');
            document.getElementById('acmeIssueForm').reset();
            await loadCertificates();
        } catch (error) {
            console.error('Error issuing ACME certificate:', error);
            ui.showToast(error.message || 'Failed to issue certificate', 'error');
        }
    });

    document.getElementById('saveHttpRuleBtn').addEventListener('click', async () => {
        const id = document.getElementById('httpRuleId').value;
        const rule = {
            enabled: document.getElementById('httpRuleEnabled').checked,
            protocol: document.getElementById('httpRuleProtocol').value,
            domain: document.getElementById('httpRuleDomain').value,
            path: document.getElementById('httpRulePath').value,
            targetHost: document.getElementById('httpRuleTargetHost').value,
            targetPort: parseInt(document.getElementById('httpRuleTargetPort').value),
            pretendMode: document.getElementById('httpRulePretendMode').checked,
            priority: parseInt(document.getElementById('httpRulePriority').value)
        };

        try {
            if (id) {
                await api.put(`/api/http-rules/${id}`, rule);
            } else {
                await api.post('/api/http-rules', rule);
            }

            ui.showToast('Rule saved successfully', 'success');
            bootstrap.Modal.getInstance(document.getElementById('httpRuleModal')).hide();
            await loadHttpRules();
        } catch (error) {
            console.error('Error saving rule:', error);
            ui.showToast(error.message || 'Failed to save rule', 'error');
        }
    });

    // WebSocket Rule buttons
    document.getElementById('addWsRuleBtn').addEventListener('click', () => {
        document.getElementById('wsRuleModalTitle').textContent = 'Add WebSocket Rule';
        document.getElementById('wsRuleForm').reset();
        document.getElementById('wsRuleId').value = '';
        document.getElementById('wsRuleEnabled').checked = true;
        document.getElementById('wsRulePretendMode').checked = true;
        document.getElementById('wsRulePriority').value = '1';
        document.getElementById('wsRuleTargetPort').value = '80';

        const modal = new bootstrap.Modal(document.getElementById('wsRuleModal'));
        modal.show();
    });

    document.getElementById('saveWsRuleBtn').addEventListener('click', async () => {
        const id = document.getElementById('wsRuleId').value;
        const rule = {
            enabled: document.getElementById('wsRuleEnabled').checked,
            protocol: document.getElementById('wsRuleProtocol').value,
            domain: document.getElementById('wsRuleDomain').value,
            path: document.getElementById('wsRulePath').value,
            targetHost: document.getElementById('wsRuleTargetHost').value,
            targetPort: parseInt(document.getElementById('wsRuleTargetPort').value),
            pretendMode: document.getElementById('wsRulePretendMode').checked,
            priority: parseInt(document.getElementById('wsRulePriority').value)
        };

        try {
            if (id) {
                await api.put(`/api/ws-rules/${id}`, rule);
            } else {
                await api.post('/api/ws-rules', rule);
            }

            ui.showToast('Rule saved successfully', 'success');
            bootstrap.Modal.getInstance(document.getElementById('wsRuleModal')).hide();
            await loadWsRules();
        } catch (error) {
            console.error('Error saving rule:', error);
            ui.showToast(error.message || 'Failed to save rule', 'error');
        }
    });

    // User buttons
    document.getElementById('addUserBtn').addEventListener('click', () => {
        document.getElementById('userForm').reset();
        const modal = new bootstrap.Modal(document.getElementById('userModal'));
        modal.show();
    });

    document.getElementById('saveUserBtn').addEventListener('click', async () => {
        const user = {
            host: document.getElementById('userHost').value,
            username: document.getElementById('userUsername').value,
            password: document.getElementById('userPassword').value
        };

        try {
            await api.post('/api/users', user);
            ui.showToast('User created successfully', 'success');
            bootstrap.Modal.getInstance(document.getElementById('userModal')).hide();
            await loadUsers();
        } catch (error) {
            console.error('Error creating user:', error);
            ui.showToast(error.message || 'Failed to create user', 'error');
        }
    });

    // Settings form
    document.getElementById('settingsForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        await saveSettings();
    });

    // Backup button
    document.getElementById('createBackupBtn').addEventListener('click', createBackup);

    // Load initial view
    navigateTo('dashboard');
});
