/**
 * 77 Cloud 认证守卫模块
 * 负责卡密验证、自动续期、强制登录等功能
 */

const AuthGuard = (function () {
    'use strict';

    // ============ 配置 ============
    const IS_HTTPS = location.protocol === 'https:';
    // HTTPS 环境用代理，HTTP 环境直连
    const API_BASE = IS_HTTPS ? '/auth-api' : 'http://121.4.83.241:3002/api';

    const STORAGE_KEY = '77_auth';
    const VERIFY_INTERVAL = 30 * 60 * 1000; // 30 分钟

    // ============ 状态 ============
    let _isAuthenticated = false;
    let _authData = null; // { key, deviceId, token, plan }
    let _verifyTimer = null;

    // ============ 初始化 ============
    function init() {
        // 恢复本地存储的认证信息
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            try {
                _authData = JSON.parse(saved);
                _isAuthenticated = true;
                console.log('[AuthGuard] 已恢复登录状态');

                // 立即验证一次
                verify().then(result => {
                    if (result.valid) {
                        startPeriodicVerify();
                    } else {
                        handleVerifyFailed(result);
                    }
                });
            } catch (e) {
                console.warn('[AuthGuard] 恢复认证信息失败:', e);
                localStorage.removeItem(STORAGE_KEY);
            }
        } else {
            // 未登录，显示登录弹窗
            showLoginModal();
        }
    }

    // ============ HTTP 请求 ============
    async function apiPost(path, data = {}) {
        const response = await fetch(API_BASE + path, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        return response.json();
    }

    // ============ 登录 ============
    async function login(key) {
        try {
            const deviceId = getDeviceId();
            const result = await apiPost('/auth', { key, deviceId });

            if (result.success) {
                // 登录成功
                _authData = {
                    key,
                    deviceId: result.deviceId || deviceId,
                    token: result.token,
                    plan: result.plan
                };
                _isAuthenticated = true;
                localStorage.setItem(STORAGE_KEY, JSON.stringify(_authData));

                startPeriodicVerify();
                return { success: true };
            } else if (result.canForceLogin) {
                // 有其他设备在线
                return {
                    success: false,
                    needForceLogin: true,
                    currentDevice: result.currentDevice,
                    error: result.error
                };
            } else {
                return { success: false, error: result.error };
            }
        } catch (err) {
            console.error('[AuthGuard] 登录失败:', err);
            return { success: false, error: '网络错误，请检查连接' };
        }
    }

    // ============ 强制登录（踢掉旧设备） ============
    async function forceLogin(key) {
        try {
            const deviceId = getDeviceId();
            const result = await apiPost('/kick', { key, deviceId });

            if (result.success) {
                _authData = {
                    key,
                    deviceId: result.deviceId || deviceId,
                    token: result.token,
                    plan: result.plan
                };
                _isAuthenticated = true;
                localStorage.setItem(STORAGE_KEY, JSON.stringify(_authData));

                startPeriodicVerify();
                return { success: true };
            } else {
                return { success: false, error: result.error };
            }
        } catch (err) {
            console.error('[AuthGuard] 强制登录失败:', err);
            return { success: false, error: '网络错误' };
        }
    }

    // ============ 静默验证 ============
    async function verify() {
        if (!_authData) {
            return { valid: false, error: '未登录' };
        }

        try {
            const result = await apiPost('/verify', {
                key: _authData.key,
                deviceId: _authData.deviceId
            });
            return result;
        } catch (err) {
            console.error('[AuthGuard] 验证失败:', err);
            // 网络错误时不退出，等待下次验证
            return { valid: true };
        }
    }

    // ============ 退出登录 ============
    async function logout() {
        if (_authData) {
            try {
                await apiPost('/logout', {
                    key: _authData.key,
                    deviceId: _authData.deviceId
                });
            } catch (e) {
                console.warn('[AuthGuard] 退出请求失败:', e);
            }
        }

        _isAuthenticated = false;
        _authData = null;
        localStorage.removeItem(STORAGE_KEY);
        stopPeriodicVerify();

        showLoginModal();
    }

    // ============ 定时验证 ============
    function startPeriodicVerify() {
        stopPeriodicVerify();

        _verifyTimer = setInterval(async () => {
            console.log('[AuthGuard] 执行定时验证...');
            const result = await verify();

            if (!result.valid) {
                handleVerifyFailed(result);
            }
        }, VERIFY_INTERVAL);
    }

    function stopPeriodicVerify() {
        if (_verifyTimer) {
            clearInterval(_verifyTimer);
            _verifyTimer = null;
        }
    }

    function handleVerifyFailed(result) {
        stopPeriodicVerify();
        _isAuthenticated = false;

        if (result.shouldLogout) {
            localStorage.removeItem(STORAGE_KEY);
            _authData = null;
        }

        // 显示提示
        let message = result.error || '验证失败';
        if (result.newDevice) {
            message = `已在其他设备登录 (${result.newDevice.platform})`;
        }

        showKickedModal(message);
    }

    // ============ 设备 ID ============
    function getDeviceId() {
        let deviceId = localStorage.getItem('77_device_id');
        if (!deviceId) {
            deviceId = 'dev_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
            localStorage.setItem('77_device_id', deviceId);
        }
        return deviceId;
    }

    // ============ UI: 登录弹窗 ============
    function showLoginModal() {
        // 移除可能存在的旧弹窗
        closeModal();

        const overlay = document.createElement('div');
        overlay.id = 'auth-modal-overlay';
        overlay.innerHTML = `
            <style>
                #auth-modal-overlay {
                    position: fixed;
                    inset: 0;
                    background: rgba(0,0,0,0.6);
                    backdrop-filter: blur(8px);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 99999;
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                }
                .auth-modal {
                    background: #fff;
                    border-radius: 16px;
                    width: 90%;
                    max-width: 360px;
                    padding: 32px 24px;
                    box-shadow: 0 20px 60px rgba(0,0,0,0.3);
                    animation: authModalIn 0.3s ease;
                }
                @keyframes authModalIn {
                    from { opacity: 0; transform: scale(0.9) translateY(20px); }
                    to { opacity: 1; transform: scale(1) translateY(0); }
                }
                .auth-modal h2 {
                    margin: 0 0 8px 0;
                    font-size: 22px;
                    font-weight: 600;
                    text-align: center;
                    color: #1c1c1e;
                }
                .auth-modal p {
                    margin: 0 0 24px 0;
                    font-size: 14px;
                    text-align: center;
                    color: #86868b;
                }
                .auth-modal input {
                    width: 100%;
                    padding: 14px 16px;
                    border: 1px solid #d2d2d7;
                    border-radius: 10px;
                    font-size: 16px;
                    margin-bottom: 16px;
                    box-sizing: border-box;
                    transition: border-color 0.2s;
                }
                .auth-modal input:focus {
                    outline: none;
                    border-color: #0071e3;
                }
                .auth-modal button {
                    width: 100%;
                    padding: 14px;
                    border: none;
                    border-radius: 10px;
                    font-size: 16px;
                    font-weight: 500;
                    cursor: pointer;
                    transition: all 0.2s;
                }
                .auth-modal .btn-primary {
                    background: #0071e3;
                    color: white;
                }
                .auth-modal .btn-primary:hover {
                    background: #0077ED;
                }
                .auth-modal .btn-primary:disabled {
                    background: #ccc;
                    cursor: not-allowed;
                }
                .auth-modal .error-msg {
                    color: #ff3b30;
                    font-size: 14px;
                    text-align: center;
                    margin-top: 12px;
                    display: none;
                }
                .auth-modal .force-login-section {
                    display: none;
                    margin-top: 16px;
                    padding-top: 16px;
                    border-top: 1px solid #e5e5ea;
                }
                .auth-modal .device-info {
                    background: #f5f5f7;
                    border-radius: 8px;
                    padding: 12px;
                    margin-bottom: 12px;
                    font-size: 13px;
                    color: #1c1c1e;
                }
                .auth-modal .device-info span {
                    color: #86868b;
                }
                .auth-modal .btn-danger {
                    background: #ff3b30;
                    color: white;
                }
                .auth-modal .btn-danger:hover {
                    background: #ff453a;
                }
            </style>
            <div class="auth-modal">
                <h2>🔐 欢迎回来</h2>
                <p>请输入您的访问密钥</p>
                <input type="text" id="auth-key-input" placeholder="请输入卡密" autocomplete="off" />
                <button class="btn-primary" id="auth-login-btn">验证登录</button>
                <div class="error-msg" id="auth-error"></div>
                
                <div class="force-login-section" id="force-login-section">
                    <div class="device-info" id="device-info"></div>
                    <button class="btn-danger" id="force-login-btn">强制登录（踢掉旧设备）</button>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);

        const input = document.getElementById('auth-key-input');
        const loginBtn = document.getElementById('auth-login-btn');
        const errorEl = document.getElementById('auth-error');
        const forceSection = document.getElementById('force-login-section');
        const deviceInfo = document.getElementById('device-info');
        const forceBtn = document.getElementById('force-login-btn');

        let currentKey = '';

        loginBtn.onclick = async () => {
            const key = input.value.trim();
            if (!key) {
                showError('请输入卡密');
                return;
            }

            currentKey = key;
            loginBtn.disabled = true;
            loginBtn.textContent = '验证中...';
            errorEl.style.display = 'none';
            forceSection.style.display = 'none';

            const result = await login(key);

            if (result.success) {
                closeModal();
                showToast('登录成功');
            } else if (result.needForceLogin) {
                // 显示强制登录选项
                const dev = result.currentDevice;
                deviceInfo.innerHTML = `
                    当前有设备在线：<br>
                    <span>设备：</span>${dev.platform}<br>
                    <span>登录时间：</span>${new Date(dev.loginTime).toLocaleString()}<br>
                    <span>IP：</span>${dev.ip || '未知'}
                `;
                forceSection.style.display = 'block';
                loginBtn.disabled = false;
                loginBtn.textContent = '验证登录';
            } else {
                showError(result.error || '登录失败');
                loginBtn.disabled = false;
                loginBtn.textContent = '验证登录';
            }
        };

        forceBtn.onclick = async () => {
            forceBtn.disabled = true;
            forceBtn.textContent = '正在踢出...';

            const result = await forceLogin(currentKey);

            if (result.success) {
                closeModal();
                showToast('已踢掉旧设备，登录成功');
            } else {
                showError(result.error || '强制登录失败');
                forceBtn.disabled = false;
                forceBtn.textContent = '强制登录（踢掉旧设备）';
            }
        };

        // 回车登录
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') loginBtn.click();
        });

        function showError(msg) {
            errorEl.textContent = msg;
            errorEl.style.display = 'block';
        }

        input.focus();
    }

    // ============ UI: 被踢下线提示 ============
    function showKickedModal(message) {
        closeModal();

        const overlay = document.createElement('div');
        overlay.id = 'auth-modal-overlay';
        overlay.innerHTML = `
            <style>
                #auth-modal-overlay {
                    position: fixed;
                    inset: 0;
                    background: rgba(0,0,0,0.6);
                    backdrop-filter: blur(8px);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 99999;
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                }
                .auth-modal {
                    background: #fff;
                    border-radius: 16px;
                    width: 90%;
                    max-width: 360px;
                    padding: 32px 24px;
                    box-shadow: 0 20px 60px rgba(0,0,0,0.3);
                    text-align: center;
                }
                .auth-modal .icon {
                    font-size: 48px;
                    margin-bottom: 16px;
                }
                .auth-modal h2 {
                    margin: 0 0 8px 0;
                    font-size: 20px;
                    color: #1c1c1e;
                }
                .auth-modal p {
                    margin: 0 0 24px 0;
                    font-size: 14px;
                    color: #86868b;
                }
                .auth-modal button {
                    width: 100%;
                    padding: 14px;
                    border: none;
                    border-radius: 10px;
                    font-size: 16px;
                    font-weight: 500;
                    background: #0071e3;
                    color: white;
                    cursor: pointer;
                }
            </style>
            <div class="auth-modal">
                <div class="icon">⚠️</div>
                <h2>登录已失效</h2>
                <p>${message}</p>
                <button id="auth-relogin-btn">重新登录</button>
            </div>
        `;
        document.body.appendChild(overlay);

        document.getElementById('auth-relogin-btn').onclick = () => {
            closeModal();
            showLoginModal();
        };
    }

    // ============ UI: Toast 提示 ============
    function showToast(message) {
        const toast = document.createElement('div');
        toast.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: rgba(0,0,0,0.8);
            color: white;
            padding: 16px 32px;
            border-radius: 12px;
            font-size: 16px;
            z-index: 999999;
            animation: toastIn 0.3s ease;
        `;
        toast.textContent = message;
        document.body.appendChild(toast);

        setTimeout(() => {
            toast.style.animation = 'toastOut 0.3s ease forwards';
            setTimeout(() => toast.remove(), 300);
        }, 2000);
    }

    function closeModal() {
        const modal = document.getElementById('auth-modal-overlay');
        if (modal) modal.remove();
    }

    // ============ 公开 API ============
    return {
        init,
        login,
        forceLogin,
        verify,
        logout,
        isAuthenticated: () => _isAuthenticated,
        getAuthData: () => _authData,
        showLoginModal
    };

})();

// 挂载到全局
window.AuthGuard = AuthGuard;

// 页面加载后自动初始化
// 注意：如果需要延迟初始化，可以注释掉下面这行，手动调用 AuthGuard.init()
// document.addEventListener('DOMContentLoaded', () => AuthGuard.init());
