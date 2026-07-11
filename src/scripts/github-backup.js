// ============================================
// GitHub Cloud Backup Module
// ============================================
(function () {
    'use strict';

    const STORAGE_KEY_TOKEN = 'github_backup_token';
    const STORAGE_KEY_REPO = 'github_backup_repo';
    const STORAGE_KEY_LAST = 'github_backup_last_time';
    const REPO_DEFAULT_NAME = 'sevenphone-backup';
    const BACKUP_PATH_PREFIX = 'backups';
    const API_BASE = 'https://api.github.com';

    // --- Inject shared CSS once ---
    (function injectStyles() {
        if (document.getElementById('gbu-shared-styles')) return;
        const style = document.createElement('style');
        style.id = 'gbu-shared-styles';
        style.textContent = `
            @keyframes gbu-fadeIn { from { opacity: 0 } to { opacity: 1 } }
            @keyframes gbu-popIn { from { transform: scale(0.9); opacity: 0 } to { transform: scale(1); opacity: 1 } }
            @keyframes gbu-spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }
            .gbu-overlay {
                position: fixed; top: 0; left: 0; width: 100%; height: 100%;
                background: rgba(0,0,0,0.35);
                backdrop-filter: blur(15px); -webkit-backdrop-filter: blur(15px);
                z-index: 99999;
                display: flex; justify-content: center; align-items: center;
                font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", sans-serif;
                animation: gbu-fadeIn .3s forwards;
            }
            .gbu-card {
                background: rgba(255,255,255,0.85);
                backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px);
                padding: 24px; border-radius: 20px;
                box-shadow: 0 10px 40px rgba(0,0,0,0.2);
                width: 280px; text-align: center;
                animation: gbu-popIn .3s cubic-bezier(.175,.885,.32,1.275) forwards;
            }
            .gbu-icon-wrap { width: 50px; height: 50px; margin: 0 auto 15px; display: flex; align-items: center; justify-content: center }
            .gbu-title { font-size: 17px; font-weight: 600; color: #000; margin-bottom: 8px }
            .gbu-desc { font-size: 13px; color: #8e8e93; margin-bottom: 15px; min-height: 16px }
            .gbu-track { width: 100%; height: 6px; background: #E5E5EA; border-radius: 10px; overflow: hidden }
            .gbu-fill { height: 100%; background: #000; width: 0%; border-radius: 10px; transition: width .3s ease }
            .gbu-spinner { animation: gbu-spin 1.2s linear infinite }
        `;
        document.head.appendChild(style);
    })();

    // --- Utility ---
    function getToken() {
        return localStorage.getItem(STORAGE_KEY_TOKEN) || '';
    }
    function getRepo() {
        return localStorage.getItem(STORAGE_KEY_REPO) || '';
    }
    function getLastBackupTime() {
        return localStorage.getItem(STORAGE_KEY_LAST) || '';
    }
    function setLastBackupTime(t) {
        localStorage.setItem(STORAGE_KEY_LAST, t);
    }

    // --- GitHub API Helpers ---
    async function githubRequest(endpoint, options = {}) {
        const token = getToken();
        if (!token) throw new Error('未绑定 GitHub 账号');
        const resp = await fetch(`${API_BASE}${endpoint}`, {
            ...options,
            headers: {
                'Authorization': `token ${token}`,
                'Accept': 'application/vnd.github.v3+json',
                'Content-Type': 'application/json',
                ...(options.headers || {}),
            },
        });
        if (!resp.ok) {
            const body = await resp.json().catch(() => ({}));
            throw new Error(body.message || `GitHub API ${resp.status}`);
        }
        if (resp.status === 204) return null;
        return resp.json();
    }

    async function getAuthenticatedUser() {
        return githubRequest('/user');
    }

    async function ensureRepoExists(username) {
        const repoName = REPO_DEFAULT_NAME;
        try {
            const repo = await githubRequest(`/repos/${username}/${repoName}`);
            localStorage.setItem(STORAGE_KEY_REPO, repo.full_name);
            return repo.full_name;
        } catch (e) {
            const created = await githubRequest('/user/repos', {
                method: 'POST',
                body: JSON.stringify({
                    name: repoName,
                    description: 'SevenPhone automatic cloud backup',
                    private: true,
                    auto_init: true,
                }),
            });
            localStorage.setItem(STORAGE_KEY_REPO, created.full_name);
            return created.full_name;
        }
    }

    async function uploadFile(repoFullName, filePath, contentBase64, commitMessage) {
        let sha = undefined;
        try {
            const existing = await githubRequest(`/repos/${repoFullName}/contents/${filePath}`);
            sha = existing.sha;
        } catch (_) {
            // file doesn't exist yet
        }
        const body = { message: commitMessage, content: contentBase64 };
        if (sha) body.sha = sha;
        return githubRequest(`/repos/${repoFullName}/contents/${filePath}`, {
            method: 'PUT',
            body: JSON.stringify(body),
        });
    }

    // --- Blob-to-Base64 ---
    function blobToBase64Chunked(blob) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result.split(',')[1]);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    }

    // --- Progress Modal (uses shared .gbu-* classes) ---
    function createProgressModal() {
        const overlay = document.createElement('div');
        overlay.className = 'gbu-overlay';
        overlay.id = 'github-backup-overlay';
        overlay.innerHTML = `
            <div class="gbu-card">
                <div class="gbu-icon-wrap">
                    <svg class="gbu-spinner" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#000" stroke-width="2" stroke-linecap="round"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                </div>
                <div class="gbu-title" id="gbu-title">云端备份</div>
                <div class="gbu-desc" id="gbu-status">准备中...</div>
                <div class="gbu-track">
                    <div class="gbu-fill" id="gbu-progress"></div>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);
        return {
            overlay,
            setTitle(t) { document.getElementById('gbu-title').textContent = t; },
            setStatus(t) { document.getElementById('gbu-status').textContent = t; },
            setProgress(pct) { document.getElementById('gbu-progress').style.width = pct + '%'; },
            destroy() {
                overlay.style.opacity = '0';
                overlay.style.transition = 'opacity .3s';
                setTimeout(() => overlay.remove(), 300);
            },
        };
    }

    // --- Core Cloud Backup ---
    async function performCloudBackup() {
        const token = getToken();
        if (!token) {
            showBindModal();
            return;
        }

        const progress = createProgressModal();
        try {
            progress.setStatus('验证 GitHub 账号...');
            progress.setProgress(5);
            const user = await getAuthenticatedUser();
            const repoFullName = await ensureRepoExists(user.login);
            progress.setProgress(10);

            progress.setStatus('正在收集数据...');
            if (typeof JSZip === 'undefined') {
                throw new Error('JSZip 未加载，请稍后再试');
            }
            const now = new Date();
            const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
            const timeStr = `${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
            const zip = new JSZip();
            const dataFolder = zip.folder('data');
            const imagesFolder = zip.folder('images');

            const storeNames = [
                'settingsStore', 'messageContacts', 'groupChats', 'worldBooks',
                'worldBookGroups', 'gachaPosts', 'emojiStore', 'emojiCategoryStore',
                'iconPresets', 'datingSetupStore', 'datingHistoryStore', 'writingStylePresets',
                'fontUrlStore', 'wowoData', 'memoryCheques', 'musicPlaylists', 'imageGenCache',
            ];

            const imgStats = { count: 0, loopTick: 0 };
            const dedupeMap = new Map();

            for (let idx = 0; idx < storeNames.length; idx++) {
                const name = storeNames[idx];
                progress.setStatus(`提取: ${name}`);
                const jsonStr = await extractStoreData(name, imagesFolder, imgStats, dedupeMap);
                dataFolder.file(`${name}.json`, jsonStr);
                const pct = 10 + Math.round(((idx + 1) / storeNames.length) * 40);
                progress.setProgress(pct);
            }
            dedupeMap.clear();

            // Presets from IndexedDB
            const presets = {
                themePresets: JSON.stringify(await window.Kl.getPreset('theme')),
                bubblePresets: JSON.stringify(await window.Kl.getPreset('bubble')),
                meetuStyles: JSON.stringify(await window.Kl.getPreset('meetu')),
            };
            zip.file('localStoragePresets.json', JSON.stringify(presets));

            // Fanfic (同人创作) data from localStorage
            if (window.FanficModule) {
                const fanficData = window.FanficModule.exportAllFanficData();
                if (Object.keys(fanficData).length > 0) {
                    dataFolder.file('fanficData.json', JSON.stringify(fanficData));
                }
            }

            // 导出天气感知 & 日程 (localStorage)
            {
                const lsBackup = {};
                const PREFIXES = ['weather_cfg_', 'weather_data_', 'schedule_data_'];
                for (let ki = 0; ki < localStorage.length; ki++) {
                    const key = localStorage.key(ki);
                    if (key && PREFIXES.some(p => key.startsWith(p))) {
                        lsBackup[key] = localStorage.getItem(key);
                    }
                }
                if (Object.keys(lsBackup).length > 0) {
                    zip.file('localStorageMisc.json', JSON.stringify(lsBackup));
                    console.log(`[CloudBackup] 已导出天气/日程 localStorage (${Object.keys(lsBackup).length} 条)`);
                }
            }

            zip.file('version.json', JSON.stringify({
                version: '3.2',
                type: 'SevenPhoneBackup_Cloud',
                date: dateStr,
            }));

            progress.setStatus('压缩中...');
            progress.setProgress(55);

            const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
            const blob = await zip.generateAsync(
                { type: 'blob', compression: 'DEFLATE', compressionOptions: { level: isIOS ? 1 : 5 }, streamFiles: true },
                (meta) => {
                    const pct = 55 + Math.round(meta.percent * 0.25);
                    progress.setStatus(`压缩: ${meta.percent.toFixed(0)}%`);
                    progress.setProgress(pct);
                },
            );

            // Upload to GitHub
            progress.setStatus('上传到 GitHub...');
            progress.setProgress(80);

            const fileName = `phone_77_${dateStr}_${timeStr}.zip`;
            const filePath = `${BACKUP_PATH_PREFIX}/${fileName}`;

            const sizeMB = blob.size / 1024 / 1024;
            if (sizeMB > 90) {
                throw new Error(`备份文件过大 (${sizeMB.toFixed(1)}MB)，超出 GitHub 限制`);
            }

            const base64Content = await blobToBase64Chunked(blob);
            progress.setStatus('正在写入仓库...');
            progress.setProgress(90);

            await uploadFile(repoFullName, filePath, base64Content, `Backup ${dateStr} ${timeStr}`);

            const doneTime = new Date().toLocaleString('zh-CN');
            setLastBackupTime(doneTime);
            updateCloudStatusUI();
            progress.setProgress(100);
            progress.setStatus('备份成功');
            setTimeout(() => progress.destroy(), 1200);

        } catch (err) {
            console.error('[CloudBackup] 失败:', err);
            progress.destroy();
            alert(`云端备份失败: ${err.message}`);
        }
    }

    // --- Image dedup processor ---
    async function processImageFields(obj, imagesFolder, stats, dedupeMap) {
        if (!obj || typeof obj !== 'object') return;
        for (const key in obj) {
            const val = obj[key];
            if (typeof val === 'string' && val.startsWith('data:image/')) {
                const match = val.match(/^data:image\/(\w+);base64,/);
                if (!match) continue;
                const ext = match[1];
                let b64 = val.substring(match[0].length);
                const fp = b64.length < 100
                    ? b64
                    : `${b64.length}_${b64.substring(0, 50)}_${b64.substring(b64.length - 50)}`;
                const existing = dedupeMap.get(fp);
                if (existing) {
                    obj[key] = `backup://images/${existing}`;
                } else {
                    stats.count++;
                    const filename = `img_${stats.count}.${ext}`;
                    imagesFolder.file(filename, b64, { base64: true });
                    dedupeMap.set(fp, filename);
                    obj[key] = `backup://images/${filename}`;
                    b64 = null;
                }
                stats.loopTick++;
            } else if (typeof val === 'string' && val.trim().startsWith('url(') && val.includes('data:image/')) {
                const urlMatch = val.match(/^url\(["']?(data:image\/[^"']+)["']?\)$/);
                if (urlMatch) {
                    const dataUrl = urlMatch[1];
                    const m2 = dataUrl.match(/^data:image\/(\w+);base64,/);
                    if (!m2) continue;
                    const ext = m2[1];
                    let b64 = dataUrl.substring(m2[0].length);
                    const fp = b64.length < 100
                        ? b64
                        : `${b64.length}_${b64.substring(0, 50)}_${b64.substring(b64.length - 50)}`;
                    const existing = dedupeMap.get(fp);
                    if (existing) {
                        obj[key] = `url("backup://images/${existing}")`;
                    } else {
                        stats.count++;
                        const filename = `img_${stats.count}.${ext}`;
                        imagesFolder.file(filename, b64, { base64: true });
                        dedupeMap.set(fp, filename);
                        obj[key] = `url("backup://images/${filename}")`;
                        b64 = null;
                    }
                    stats.loopTick++;
                }
            } else if (typeof val === 'object' && val !== null) {
                await processImageFields(val, imagesFolder, stats, dedupeMap);
            }
        }
    }

    // --- Extract store data from IndexedDB ---
    function extractStoreData(storeName, imagesFolder, progressObj, dedupeMap) {
        return new Promise((resolve, reject) => {
            const dbReq = indexedDB.open(window.Kl.dbName, window.Kl.dbVersion || 20);
            dbReq.onerror = (e) => reject(new Error(`DB open failed: ${e.target.error}`));
            dbReq.onsuccess = async (e) => {
                const db = e.target.result;
                try {
                    if (!db.objectStoreNames.contains(storeName)) {
                        resolve('[]');
                        return;
                    }
                    // Get all keys
                    const keys = await new Promise((res, rej) => {
                        const txn = db.transaction([storeName], 'readonly');
                        const store = txn.objectStore(storeName);
                        if (store.getAllKeys) {
                            const req = store.getAllKeys();
                            req.onsuccess = (ev) => res(ev.target.result);
                            req.onerror = (ev) => rej(ev.target.error);
                        } else {
                            // Fallback for old browsers
                            const k = [];
                            const cursor = store.openKeyCursor();
                            cursor.onsuccess = (ev) => {
                                const c = ev.target.result;
                                if (c) { k.push(c.key); c.continue(); }
                                else res(k);
                            };
                            cursor.onerror = (ev) => rej(ev.target.error);
                        }
                    });

                    const parts = ['['];
                    let first = true;
                    const BATCH = 20;
                    for (let i = 0; i < keys.length; i += BATCH) {
                        const chunk = keys.slice(i, i + BATCH);
                        const values = await new Promise((res, rej) => {
                            const txn = db.transaction([storeName], 'readonly');
                            const st = txn.objectStore(storeName);
                            Promise.all(chunk.map(k => new Promise((r, j) => {
                                const rq = st.get(k);
                                rq.onsuccess = (ev) => r(ev.target.result);
                                rq.onerror = (ev) => j(ev.target.error);
                            }))).then(res).catch(rej);
                        });
                        for (const rec of values) {
                            if (!rec) continue;
                            if (first) first = false; else parts.push(',');
                            try {
                                const clone = typeof structuredClone === 'function'
                                    ? structuredClone(rec)
                                    : JSON.parse(JSON.stringify(rec));
                                if (typeof clone === 'object' && clone !== null) {
                                    await processImageFields(clone, imagesFolder, progressObj, dedupeMap);
                                }
                                parts.push(JSON.stringify(clone));
                            } catch (err) {
                                console.warn(`[CloudBackup] Skip record in ${storeName}:`, err);
                            }
                        }
                        await new Promise(r => setTimeout(r, 5));
                    }
                    parts.push(']');
                    resolve(parts.join(''));
                } catch (err) {
                    reject(err);
                }
            };
        });
    }

    // --- Bind Modal (uses shared .gbu-* animations) ---
    function showBindModal() {
        const prev = document.getElementById('github-bind-overlay');
        if (prev) prev.remove();

        const overlay = document.createElement('div');
        overlay.id = 'github-bind-overlay';
        overlay.className = 'gbu-overlay';
        overlay.style.padding = '20px';
        overlay.innerHTML = `
            <div style="background:#fff;border-radius:24px;padding:28px 24px;max-width:320px;width:100%;box-shadow:0 20px 60px rgba(0,0,0,0.25);animation:gbu-popIn .3s cubic-bezier(.175,.885,.32,1.275) forwards">
                <div style="display:flex;align-items:center;gap:12px;margin-bottom:20px">
                    <div style="width:44px;height:44px;border-radius:14px;background:#1D1D1F;display:flex;align-items:center;justify-content:center;flex-shrink:0">
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"/></svg>
                    </div>
                    <div>
                        <div style="font-size:18px;font-weight:700;color:#1D1D1F">绑定 GitHub</div>
                        <div style="font-size:12px;color:#8e8e93;margin-top:2px">用于云端备份数据</div>
                    </div>
                </div>

                <div style="background:#F5F5F7;border-radius:14px;padding:14px;margin-bottom:16px">
                    <div style="font-size:11px;font-weight:600;color:#8e8e93;text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px">Personal Access Token</div>
                    <input id="gbu-token-input" type="password" placeholder="ghp_xxxxxxxxxxxx" style="width:100%;padding:10px 12px;border:1.5px solid #E5E5EA;border-radius:10px;font-size:14px;font-family:SF Mono,ui-monospace,monospace;background:#fff;box-sizing:border-box;outline:none;transition:border-color .2s" onfocus="this.style.borderColor='#1D1D1F'" onblur="this.style.borderColor='#E5E5EA'" />
                </div>

                <div style="background:#F5F5F7;border-radius:14px;padding:14px;margin-bottom:20px">
                    <div style="font-size:11px;color:#8e8e93;line-height:1.6">
                        <div style="font-weight:600;margin-bottom:4px">如何获取 Token:</div>
                        1. 访问 GitHub Settings<br/>
                        2. Developer settings<br/>
                        3. Personal access tokens → Tokens (classic)<br/>
                        4. Generate new token<br/>
                        5. 勾选 <span style="font-weight:600;color:#1D1D1F">repo</span> 权限
                    </div>
                </div>

                <div style="display:flex;gap:10px">
                    <button id="gbu-cancel-bind" style="flex:1;padding:12px;border-radius:12px;border:1.5px solid #E5E5EA;background:#fff;font-size:15px;font-weight:600;color:#8e8e93;cursor:pointer">取消</button>
                    <button id="gbu-confirm-bind" style="flex:1;padding:12px;border-radius:12px;border:none;background:#1D1D1F;font-size:15px;font-weight:600;color:#fff;cursor:pointer">绑定</button>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);

        // Pre-fill
        const existingToken = getToken();
        if (existingToken) {
            document.getElementById('gbu-token-input').value = existingToken;
        }

        // Close handlers
        const closeModal = () => {
            overlay.style.opacity = '0';
            overlay.style.transition = 'opacity .3s';
            setTimeout(() => overlay.remove(), 300);
        };

        document.getElementById('gbu-cancel-bind').addEventListener('click', closeModal);
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) closeModal();
        });

        document.getElementById('gbu-confirm-bind').addEventListener('click', async () => {
            const tokenInput = document.getElementById('gbu-token-input');
            const token = tokenInput.value.trim();
            if (!token) {
                tokenInput.style.borderColor = '#FF3B30';
                return;
            }
            const btn = document.getElementById('gbu-confirm-bind');
            btn.textContent = '验证中...';
            btn.disabled = true;
            try {
                localStorage.setItem(STORAGE_KEY_TOKEN, token);
                const user = await getAuthenticatedUser();
                await ensureRepoExists(user.login);
                updateCloudStatusUI();
                closeModal();
            } catch (err) {
                localStorage.removeItem(STORAGE_KEY_TOKEN);
                btn.textContent = '绑定';
                btn.disabled = false;
                tokenInput.style.borderColor = '#FF3B30';
                alert(`绑定失败: ${err.message}`);
            }
        });
    }

    // --- Unbind ---
    function unbindGitHub() {
        if (!confirm('确定要解除 GitHub 绑定吗？')) return;
        localStorage.removeItem(STORAGE_KEY_TOKEN);
        localStorage.removeItem(STORAGE_KEY_REPO);
        updateCloudStatusUI();
    }

    // --- Update UI State ---
    function updateCloudStatusUI() {
        const token = getToken();
        const isBound = !!token;
        const lastTime = getLastBackupTime();

        const badge = document.getElementById('gbu-status-badge');
        if (badge) {
            if (isBound) {
                badge.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#34C759" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg><span>已绑定</span>';
                badge.style.background = 'rgba(52,199,89,0.1)';
                badge.style.color = '#34C759';
            } else {
                badge.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#8e8e93" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg><span>未绑定</span>';
                badge.style.background = 'rgba(0,0,0,0.05)';
                badge.style.color = '#8e8e93';
            }
        }

        const lastEl = document.getElementById('gbu-last-time');
        if (lastEl) {
            lastEl.textContent = lastTime || '从未备份';
        }

        const bindBtn = document.getElementById('gbu-bind-btn');
        if (bindBtn) {
            bindBtn.textContent = isBound ? '重新绑定' : '绑定账号';
        }
        const unbindBtn = document.getElementById('gbu-unbind-btn');
        if (unbindBtn) {
            unbindBtn.style.display = isBound ? '' : 'none';
        }
    }

    // --- Init ---
    function initCloudBackup() {
        const cloudBtn = document.getElementById('cloud-backup-btn');
        if (cloudBtn) cloudBtn.addEventListener('click', performCloudBackup);

        const bindBtn = document.getElementById('gbu-bind-btn');
        if (bindBtn) bindBtn.addEventListener('click', showBindModal);

        const unbindBtn = document.getElementById('gbu-unbind-btn');
        if (unbindBtn) unbindBtn.addEventListener('click', unbindGitHub);

        updateCloudStatusUI();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initCloudBackup);
    } else {
        initCloudBackup();
    }

    window.GitHubBackup = {
        performCloudBackup,
        showBindModal,
        unbindGitHub,
        updateCloudStatusUI,
    };
})();
