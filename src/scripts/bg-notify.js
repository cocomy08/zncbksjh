/**
 * 后台推送通知 + 静音保活
 *
 * iOS PWA 限制：
 * - 不支持 new Notification()，必须通过 SW 的 registration.showNotification()
 * - requestPermission 必须在用户手势（点击）事件中调用
 * - 需要 iOS 16.4+ 且已添加到主屏幕的 PWA 才支持通知
 */
(function () {
    'use strict';

    const KEEPALIVE_ENABLED_KEY = 'bgNotify_keepalive';
    const NOTIFY_ENABLED_KEY = 'bgNotify_enabled';

    let silentAudio = null;
    let audioCtx = null;
    let isBackground = false;
    let keepaliveRunning = false;

    function isEnabled() {
        return localStorage.getItem(NOTIFY_ENABLED_KEY) !== 'false';
    }
    function isKeepaliveEnabled() {
        return localStorage.getItem(KEEPALIVE_ENABLED_KEY) !== 'false';
    }

    // ==================== 静音保活 ====================
    function startSilentKeepalive() {
        if (keepaliveRunning || !isKeepaliveEnabled()) return;
        keepaliveRunning = true;

        try {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            if (audioCtx.state === 'suspended') audioCtx.resume();
            const oscillator = audioCtx.createOscillator();
            const gainNode = audioCtx.createGain();
            gainNode.gain.value = 0.001;
            oscillator.connect(gainNode);
            gainNode.connect(audioCtx.destination);
            oscillator.start();
            console.log('[BgNotify] 静音保活已启动 (WebAudio)');
        } catch (e) {
            try {
                const silentMp3 = 'data:audio/mp3;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4Ljc2LjEwMAAAAAAAAAAAAAAA//tQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAACAAABhgC7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7//////////////////////////////////////////////////////////////////8AAAAATGF2YzU4LjEzAAAAAAAAAAAAAAAAJAAAAAAAAAAAAYYoRBqSAAAAAAAAAAAAAAAAAAAA//tQZAAP8AAAaQAAAAgAAA0gAAABAAABpAAAACAAADSAAAAETEFNRTMuMTAwVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV//tQZB8P8AAAaQAAAAgAAA0gAAABAAABpAAAACAAADSAAAAEVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVQ==';
                silentAudio = new Audio(silentMp3);
                silentAudio.loop = true;
                silentAudio.volume = 0.01;
                silentAudio.setAttribute('data-bg-keepalive', 'true');
                silentAudio.play().catch(() => {});
                console.log('[BgNotify] 静音保活已启动 (Audio element)');
            } catch (e2) {
                console.warn('[BgNotify] 静音保活启动失败:', e2);
                keepaliveRunning = false;
            }
        }
    }

    function stopSilentKeepalive() {
        if (!keepaliveRunning) return;
        keepaliveRunning = false;
        if (audioCtx) {
            try { audioCtx.close(); } catch (e) {}
            audioCtx = null;
        }
        if (silentAudio) {
            silentAudio.pause();
            silentAudio.src = '';
            silentAudio = null;
        }
        console.log('[BgNotify] 静音保活已停止');
    }

    // ==================== 可见性监听 ====================
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            isBackground = true;
            startSilentKeepalive();
        } else {
            isBackground = false;
            stopSilentKeepalive();
        }
    });

    // ==================== 通过 Service Worker 发通知 ====================
    async function sendNotificationViaSW(title, body, tag, icon) {
        try {
            const reg = await navigator.serviceWorker.ready;
            await reg.showNotification(title, {
                body: body,
                icon: icon || 'https://i.postimg.cc/s2n0gxBB/appicon.png',
                badge: 'https://i.postimg.cc/s2n0gxBB/appicon.png',
                tag: tag || 'chat-msg',
                renotify: true,
                vibrate: [100, 50, 100],
                data: { url: './' }
            });
            return true;
        } catch (e) {
            try {
                const reg = await navigator.serviceWorker.ready;
                if (reg.active) {
                    reg.active.postMessage({
                        type: 'SHOW_NOTIFICATION',
                        title: title,
                        body: body,
                        tag: tag,
                        icon: icon
                    });
                    return true;
                }
            } catch (e2) {}
            console.warn('[BgNotify] SW showNotification 失败:', e);
            return false;
        }
    }

    // fallback: 非 iOS 桌面浏览器直接用 new Notification
    function sendNotificationDirect(title, body, tag, icon) {
        try {
            const n = new Notification(title, {
                body: body,
                icon: icon || 'https://i.postimg.cc/s2n0gxBB/appicon.png',
                tag: tag || 'chat-msg',
                renotify: true,
            });
            n.onclick = function () { window.focus(); n.close(); };
            setTimeout(() => n.close(), 5000);
            return true;
        } catch (e) {
            return false;
        }
    }

    async function sendLocalNotification(aiName, messageText, contactId, avatarUrl) {
        if (!isEnabled() || !isBackground) return;
        if (!('Notification' in window) || Notification.permission !== 'granted') return;

        const body = messageText.length > 80
            ? messageText.substring(0, 80) + '…'
            : messageText;
        const title = aiName || '新消息';
        const tag = 'chat-' + (contactId || 'default');
        const icon = avatarUrl || 'https://i.postimg.cc/s2n0gxBB/appicon.png';

        if ('serviceWorker' in navigator) {
            const ok = await sendNotificationViaSW(title, body, tag, icon);
            if (ok) return;
        }
        sendNotificationDirect(title, body, tag, icon);
    }

    // ==================== 请求权限（必须在用户手势中调用） ====================
    async function requestPermission() {
        if (!('Notification' in window)) return 'unsupported';
        if (Notification.permission === 'granted') return 'granted';
        if (Notification.permission === 'denied') return 'denied';
        return await Notification.requestPermission();
    }

    // ==================== 预热 AudioContext（iOS 要求用户手势） ====================
    function warmupAudio() {
        try {
            if (!audioCtx) {
                audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            }
            if (audioCtx.state === 'suspended') {
                audioCtx.resume();
            }
            // 播放极短静音来解锁音频上下文
            const buf = audioCtx.createBuffer(1, 1, 22050);
            const src = audioCtx.createBufferSource();
            src.buffer = buf;
            src.connect(audioCtx.destination);
            src.start(0);
            console.log('[BgNotify] AudioContext 已预热');
        } catch (e) {}
    }

    // ==================== 对外接口 ====================
    window.BgNotify = {
        onAIMessage: function (message, contact) {
            if (!message || message.sender !== 'ai') return;
            if (message.type === 'system' || message.hidden) return;

            const text = message.text || (message.content && message.content.html) || '';
            if (!text) return;

            let cleanText = text.split('状态：')[0].trim();
            cleanText = cleanText.replace(/\\/g, ' ').replace(/\s+/g, ' ').trim();
            if (!cleanText) return;

            const aiName = contact && contact.ai ? contact.ai.name : null;
            const aiAvatar = contact && contact.ai ? contact.ai.avatar : null;
            const contactId = contact ? contact.id : null;

            sendLocalNotification(aiName, cleanText, contactId, aiAvatar);
        },

        requestPermission: requestPermission,
        warmupAudio: warmupAudio,

        setEnabled: function (v) {
            localStorage.setItem(NOTIFY_ENABLED_KEY, v ? 'true' : 'false');
        },
        setKeepaliveEnabled: function (v) {
            localStorage.setItem(KEEPALIVE_ENABLED_KEY, v ? 'true' : 'false');
        },
        isEnabled: isEnabled,
        isKeepaliveEnabled: isKeepaliveEnabled,
        isBackground: function () { return isBackground; },

        testNotification: async function () {
            if (Notification.permission !== 'granted') {
                if (window.showToast) window.showToast('请先授权通知权限');
                return;
            }
            await sendLocalNotification('测试', '这是一条后台推送测试通知 ✅', 'test');
            if (window.showToast) window.showToast('测试通知已发送（切到后台查看）');
        }
    };

    console.log('[BgNotify] 后台通知模块已加载');

    // ==================== 设置页 UI 绑定 ====================
    function initSettingsUI() {
        const notifyToggle = document.getElementById('bg-notify-toggle');
        const keepaliveToggle = document.getElementById('bg-keepalive-toggle');
        const permStatus = document.getElementById('bg-notify-permission-status');
        const requestBtn = document.getElementById('bg-notify-request-btn');

        if (notifyToggle) {
            notifyToggle.checked = isEnabled();
            notifyToggle.addEventListener('change', function () {
                window.BgNotify.setEnabled(this.checked);
            });
        }

        if (keepaliveToggle) {
            keepaliveToggle.checked = isKeepaliveEnabled();
            keepaliveToggle.addEventListener('change', function () {
                window.BgNotify.setKeepaliveEnabled(this.checked);
                if (!this.checked) stopSilentKeepalive();
            });
        }

        function updatePermUI() {
            // iOS PWA 从 16.4 开始支持通知，但必须是添加到主屏幕的 PWA
            const isIOSPWA = /iPad|iPhone|iPod/.test(navigator.userAgent) &&
                             window.navigator.standalone === true;
            const isIOSBrowser = /iPad|iPhone|iPod/.test(navigator.userAgent) &&
                                 !window.navigator.standalone;

            if (!('Notification' in window)) {
                if (permStatus) {
                    if (isIOSBrowser) {
                        permStatus.textContent = '请先将 App 添加到主屏幕再开启通知';
                    } else {
                        permStatus.textContent = '此浏览器不支持通知';
                    }
                }
                if (requestBtn) requestBtn.style.display = 'none';
                return;
            }

            const perm = Notification.permission;
            if (perm === 'granted') {
                if (permStatus) { permStatus.textContent = '✓ 已授权'; permStatus.style.color = '#34C759'; }
                if (requestBtn) {
                    requestBtn.textContent = '测试通知';
                    requestBtn.style.background = '#34C759';
                    requestBtn.onclick = function () {
                        window.BgNotify.testNotification();
                    };
                }
            } else if (perm === 'denied') {
                if (permStatus) {
                    permStatus.textContent = '✗ 已拒绝';
                    permStatus.style.color = '#FF3B30';
                }
                if (requestBtn) {
                    requestBtn.textContent = '已拒绝';
                    requestBtn.disabled = true;
                    requestBtn.style.opacity = '0.5';
                }
            } else {
                if (permStatus) {
                    permStatus.textContent = isIOSPWA
                        ? '点击授权按钮开启推送'
                        : '未授权';
                }
                if (requestBtn) {
                    requestBtn.textContent = '授权通知';
                    requestBtn.onclick = async function () {
                        // iOS 要求同时预热 audio context
                        warmupAudio();
                        const result = await requestPermission();
                        updatePermUI();
                        if (result === 'granted') {
                            if (window.showToast) window.showToast('通知权限已开启 ✅');
                        } else if (result === 'denied') {
                            if (window.showToast) window.showToast('通知权限被拒绝，请到系统设置中开启');
                        }
                    };
                }
            }
        }

        updatePermUI();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initSettingsUI);
    } else {
        initSettingsUI();
    }
})();
