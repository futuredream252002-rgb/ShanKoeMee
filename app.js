const BACKEND_URL = 'http://43.229.150.54:3000';
const SERVER_IP = '43.229.150.54';
const SERVER_USER = 'ubuntu';
const SERVER_PASS = '7777777';

let currentLogProject = '';
let detectedType = null;
const uploadedContents = { js: '', py: '' };
const uploadedFileNames = { js: '', py: '' };
let isRunning = false;
let cachedDeviceId = null;
let deviceIdLoading = false;
let deviceIdResolvers = [];

async function getDeviceId() {
    try {
        if (typeof FingerprintJS !== 'undefined') {
            const fp = await FingerprintJS.load();
            const result = await fp.get();
            const fingerprint = result.visitorId;
            localStorage.setItem('vps_device_fingerprint', fingerprint);
            return fingerprint;
        } else {
            console.warn('FingerprintJS not loaded, using fallback');
            return getFallbackDeviceId();
        }
    } catch (error) {
        console.warn('FingerprintJS error, using fallback:', error);
        return getFallbackDeviceId();
    }
}

function getFallbackDeviceId() {
    try {
        let deviceId = localStorage.getItem('vps_device_id');
        if (!deviceId) {
            deviceId = 'device_' + Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
            localStorage.setItem('vps_device_id', deviceId);
        }
        return deviceId;
    } catch (_) {
        return 'device_fallback_' + Date.now();
    }
}

async function getCachedDeviceId() {
    if (cachedDeviceId) return cachedDeviceId;

    const stored = localStorage.getItem('vps_device_fingerprint');
    if (stored) {
        cachedDeviceId = stored;
        return stored;
    }

    if (deviceIdLoading) {
        return new Promise((resolve) => {
            deviceIdResolvers.push(resolve);
        });
    }

    deviceIdLoading = true;
    try {
        cachedDeviceId = await getDeviceId();
        deviceIdResolvers.forEach(resolve => resolve(cachedDeviceId));
        deviceIdResolvers = [];
        return cachedDeviceId;
    } finally {
        deviceIdLoading = false;
    }
}

async function displayDeviceId() {
    const el = document.getElementById('device-id-display');
    if (el) {
        try {
            const deviceId = await getCachedDeviceId();
            el.textContent = deviceId;
        } catch (e) {
            el.textContent = 'Error loading device ID';
        }
    }
}

async function copyDeviceId() {
    try {
        const deviceId = await getCachedDeviceId();
        await navigator.clipboard.writeText(deviceId);
        showToast('📋 Device ID ကို Copy ကူးပြီးပါပြီ။', 'success');
    } catch (_) {
        try {
            const deviceId = await getCachedDeviceId();
            showToast('📋 Device ID: ' + deviceId, 'info');
        } catch (e) {
            showToast('❌ Device ID ရယူ၍မရပါ', 'error');
        }
    }
}

function showToast(message, type = 'info') {
    const existingToasts = document.querySelectorAll('.toast');
    existingToasts.forEach(t => t.remove());

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 5000);
}

function ensureExtension(fileName, type) {
    const cleaned = fileName.trim().replace(/\s+/g, '-');
    if (!cleaned) return '';
    return /\.[a-z0-9]+$/i.test(cleaned) ? cleaned : `${cleaned}.${type}`;
}

function handleUnifiedFileSelect() {
    const fileInput = document.getElementById('unified-file');
    const file = fileInput.files[0];
    const panel = document.getElementById('runner-panel');
    const title = document.getElementById('runner-title');
    const runBtn = document.getElementById('dynamic-run-btn');
    
    if (!file) {
        resetPanelUI();
        return;
    }

    const extension = file.name.split('.').pop().toLowerCase();
    
    if (extension === 'js') {
        detectedType = 'js';
        panel.classList.remove('hidden-runner');
        panel.className = "box box-runner box-js-active";
        title.innerHTML = "📦 Node.js Ready to Run";
        runBtn.className = "run-btn run-btn-js";
        runBtn.textContent = "▶️ Run Start (Node.js)";
        runBtn.classList.remove('hidden');
        setupFileData('js', file);
    } else if (extension === 'py') {
        detectedType = 'py';
        panel.classList.remove('hidden-runner');
        panel.className = "box box-runner box-py-active";
        title.innerHTML = "🐍 Python Ready to Run";
        runBtn.className = "run-btn run-btn-py";
        runBtn.textContent = "▶️ Run Start (Python)";
        runBtn.classList.remove('hidden');
        setupFileData('py', file);
    } else {
        showToast('❌ .js သို့မဟုတ် .py file သာ လက်ခံပါသည်', 'error');
        fileInput.value = '';
        resetPanelUI();
    }
}

function resetPanelUI() {
    detectedType = null;
    const panel = document.getElementById('runner-panel');
    const title = document.getElementById('runner-title');
    const runBtn = document.getElementById('dynamic-run-btn');
    
    panel.className = "box box-runner hidden-runner";
    title.innerHTML = "🤖 Bot Runner Panel";
    runBtn.className = "run-btn hidden";
    
    uploadedContents.js = '';
    uploadedContents.py = '';
    uploadedFileNames.js = '';
    uploadedFileNames.py = '';
}

function setupFileData(type, file) {
    const otherType = type === 'js' ? 'py' : 'js';
    if (file.size > 10 * 1024 * 1024) {
        showToast(`⚠️ File size ${(file.size / 1024 / 1024).toFixed(2)}MB - Processing large file...`, 'info');
    }
    
    uploadedFileNames[type] = file.name;
    uploadedFileNames[otherType] = '';

    const reader = new FileReader();
    reader.onload = e => {
        uploadedContents[type] = e.target.result || '';
        uploadedContents[otherType] = '';
    };
    reader.onerror = () => {
        showToast('❌ File ဖတ်ရာတွင် အဆင်မပြေပါ', 'error');
    };
    reader.readAsText(file);
}

async function autoLoginVPS() {
    const connStatus = document.getElementById('connecting-status');
    try {
        const res = await fetch(`${BACKEND_URL}/api/verify-vps`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ip: SERVER_IP, username: SERVER_USER, password: SERVER_PASS })
        });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const data = await res.json();
        if (data.success) {
            document.getElementById('login-section').classList.add('hidden');
            document.getElementById('dashboard-section').classList.remove('hidden');
            document.getElementById('dashboard-section-table').classList.remove('hidden');
            await loadActivePM2Processes();
        } else {
            if (connStatus) connStatus.innerHTML = '❌ Connection Failed: ' + data.message;
        }
    } catch (err) {
        console.error(err);
        if (connStatus) {
            connStatus.innerHTML = '⚠️ Network Error!<br /><span style="font-size:14px; color:#f38ba8;">Backend Server သို့ ချိတ်ဆက်မရပါ။</span>';
        }
    }
}

function resetAllInputs() {
    const fileInput = document.getElementById('unified-file');
    if (fileInput) fileInput.value = '';
    isRunning = false;
    resetPanelUI();
}

function triggerExecution() {
    if(detectedType) {
        runFile(detectedType);
    }
}

async function runFile(type) {
    if (isRunning) return;

    const runBtn = document.getElementById('dynamic-run-btn');
    const fileName = ensureExtension(uploadedFileNames[type], type);

    if (!fileName) {
        showToast('ကျေးဇူးပြု၍ File အရင် ရွေးပေးပါ', 'error');
        return;
    }

    if (!uploadedContents[type] || !String(uploadedContents[type]).trim()) {
        showToast('File ထဲတွင် Code မရှိပါ', 'error');
        return;
    }

    isRunning = true;
    runBtn.disabled = true;
    const originalText = runBtn.textContent;
    runBtn.textContent = '⏳ Saving file...';

    try {
        const deviceId = await getCachedDeviceId();

        const saveRes = await fetch(`${BACKEND_URL}/api/save-file`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                botType: type,
                fileName,
                content: uploadedContents[type],
                ip: SERVER_IP,
                username: SERVER_USER,
                password: SERVER_PASS
            })
        });

        const saveData = await saveRes.json();
        if (!saveData.success) {
            showToast('❌ Save failed: ' + (saveData.message || 'Unknown error'), 'error');
            runBtn.disabled = false;
            runBtn.textContent = originalText;
            isRunning = false;
            return;
        }

        showToast('💾 File saved: ' + fileName, 'success');
        runBtn.textContent = '⏳ Starting process...';

        const runRes = await fetch(`${BACKEND_URL}/api/run-file`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                botType: type,
                fileName,
                deviceId: deviceId,
                ip: SERVER_IP,
                username: SERVER_USER,
                password: SERVER_PASS
            })
        });

        const runData = await runRes.json();
        if (!runData.success) {
            showToast('❌ Run failed: ' + (runData.message || 'Unknown error'), 'error');
            runBtn.disabled = false;
            runBtn.textContent = originalText;
            isRunning = false;
            return;
        }

        showToast(`✅ ${runData.message || 'Process started successfully'}`, 'success');
        resetAllInputs();
        await loadActivePM2Processes();

    } catch (err) {
        showToast('❌ Network Error: ' + err.message, 'error');
        runBtn.disabled = false;
        runBtn.textContent = originalText;
        isRunning = false;
    }
}

function updateUploadUIState(processes, maxAllowed = 1) {
    const limitReached = processes.length >= maxAllowed;
    document.getElementById('file-selector-box').classList.toggle('hidden', limitReached);
    document.getElementById('runner-panel').classList.toggle('hidden', limitReached);
    document.getElementById('running-notice-section').classList.toggle('hidden', !limitReached);
    if(limitReached) {
        resetPanelUI();
    }
}

async function loadActivePM2Processes() {
    const tbody = document.getElementById('history-list');
    try {
        const deviceId = await getCachedDeviceId();

        const res = await fetch(`${BACKEND_URL}/api/get-pm2-list`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                deviceId: deviceId,
                ip: SERVER_IP,
                username: SERVER_USER,
                password: SERVER_PASS
            })
        });

        if (!res.ok) throw new Error('HTTP ' + res.status);
        const data = await res.json();
        tbody.innerHTML = '';
        const processes = data.processes || [];
        const maxAllowed = data.maxAllowed || 1;
        updateUploadUIState(processes, maxAllowed);

        if (processes.length === 0) {
            tbody.innerHTML = '<tr><td colspan="3" style="text-align:center; color:#cdd6f4; padding:24px;">📭 မည်သည့် PM2 process မှ Run မထားပါ။</td></tr>';
            return;
        }

        processes.forEach((proc, index) => {
            const projectName = proc.name;
            const isOnline = proc.status === 'online';
            const pid = proc.pm_id !== undefined ? proc.pm_id : index;
            tbody.innerHTML += `
                <tr>
                    <td><strong>${projectName}</strong></td>
                    <td><span class="status-badge ${isOnline ? 'status-online' : 'status-offline'}">${isOnline ? '🟢 Running' : '🔴 Stopped'}</span></td>
                    <td>
                        <div class="action-buttons">
                            <button class="btn-logs" onclick="openLogsPage('${projectName}')">📄 Logs</button>
                            <button class="btn-delete" onclick="deleteProcess('${pid}', '${projectName}')">🗑️ Delete</button>
                        </div>
                    </td>
                </tr>
            `;
        });
    } catch (err) {
        console.error('Load processes error:', err);
        tbody.innerHTML = `<tr><td colspan="3" style="text-align:center; color:#f38ba8; padding:24px;">❌ Server Connection Error: ${err.message}</td></tr>`;
    }
}

async function deleteProcess(processId, projectName) {
    if (!confirm(`"${projectName}" ကို ဖျက်မှာ သေချာပါသလား?`)) return;
    try {
        const deviceId = await getCachedDeviceId();

        const res = await fetch(`${BACKEND_URL}/api/history/${processId}`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: projectName,
                deviceId: deviceId,
                ip: SERVER_IP,
                username: SERVER_USER,
                password: SERVER_PASS
            })
        });
        const data = await res.json();
        if (data.success) {
            showToast(`✅ Deleted: ${projectName}`, 'success');
            await loadActivePM2Processes();
        } else {
            showToast('❌ Delete failed: ' + (data.message || 'Unknown error'), 'error');
        }
    } catch (err) {
        showToast('❌ Delete API Error: ' + err.message, 'error');
    }
}

function openLogsPage(projectName) {
    currentLogProject = projectName;
    document.getElementById('main-content').classList.add('hidden');
    document.getElementById('logs-page').classList.add('active');
    document.getElementById('logs-title').textContent = `📋 PM2 Logs - ${projectName}`;
    fetchLogs(projectName);
}

function closeLogs() {
    document.getElementById('logs-page').classList.remove('active');
    document.getElementById('main-content').classList.remove('hidden');
}

function refreshLogs() {
    if (currentLogProject) fetchLogs(currentLogProject);
}

async function fetchLogs(projectName) {
    const contentDiv = document.getElementById('logs-content');
    contentDiv.innerHTML = '<div style="color:#89b4fa; text-align:center; padding:40px 0;">⏳ Fetching logs...</div>';
    try {
        const deviceId = await getCachedDeviceId();

        const res = await fetch(`${BACKEND_URL}/api/logs`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                projectName,
                deviceId: deviceId,
                ip: SERVER_IP,
                username: SERVER_USER,
                password: SERVER_PASS
            })
        });
        const data = await res.json();
        contentDiv.textContent = data.logs || 'No logs found.';
    } catch (err) {
        contentDiv.textContent = 'Error fetching logs: ' + err.message;
    }
}

window.onload = async function() {
    await displayDeviceId();
    await autoLoginVPS();

    setInterval(async () => {
        if (!document.getElementById('dashboard-section').classList.contains('hidden')) {
            await loadActivePM2Processes();
        }
    }, 15000);
};
