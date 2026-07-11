/**
 * 后台推送通知 + 静音保活
 * 功能：
 * 1. 页面进入后台时播放静音音频保持 PWA 进程存活（iOS/Android）
 * 2. AI 回复时如果页面不在前台，发送本地 Notification
 * 3. 点击通知聚焦回 App
 */
(function () {
    'use strict';

    // ==================== 配置 ====================
    const KEEPALIVE_ENABLED_KEY = 'bgNotify_keepalive';
    const NOTIFY_ENABLED_KEY = 'bgNotify_enabled';

    // ==================== 状态 ====================
    let silentAudio = null;
    let audioCtx = null;
    let isBackground = false;
    let keepaliveRunning = false;

    // ==================== 工具 ====================
    function isEnabled() {
        return localStorage.getItem(NOTIFY_ENABLED_KEY) !== 'false';
    }
    function isKeepaliveEnabled() {
        return localStorage.getItem(KEEPALIVE_ENABLED_KEY) !== 'false';
    }

    // ==================== 静音保活 ====================
    function startSilentKeepalive() {
        if (keepaliveRunning) return;
        if (!isKeepaliveEnabled()) return;
        keepaliveRunning = true;

        try {
            // 方案 1: Web Audio API 生成静音信号（不需要文件）
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = audioCtx.createOscillator();
            const gainNode = audioCtx.createGain();
            gainNode.gain.value = 0.001; // 几乎无声
            oscillator.connect(gainNode);
            gainNode.connect(audioCtx.destination);
            oscillator.start();
            console.log('[BgNotify] 静音保活已启动 (WebAudio)');
        } catch (e) {
            // 方案 2: 播放 data-uri 静音音频循环
            try {
                // 极短的静音 MP3（约 100ms）
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

    // ==================== 通知发送 ====================
    function sendLocalNotification(aiName, messageText, contactId) {
        if (!isEnabled()) return;
        if (!isBackground) return;
        if (Notification.permission !== 'granted') return;

        const body = messageText.length > 80
            ? messageText.substring(0, 80) + '…'
            : messageText;

        const notification = new Notification(aiName || '新消息', {
            body: body,
            icon: 'https://i.postimg.cc/s2n0gxBB/appicon.png',
            badge: 'https://i.postimg.cc/s2n0gxBB/appicon.png',
            tag: 'chat-' + (contactId || 'default'),
            renotify: true,
            silent: false
        });

        notification.onclick = function () {
            window.focus();
            notification.close();
        };

        // 5 秒后自动关闭
        setTimeout(() => notification.close(), 5000);
    }

    // ==================== 请求通知权限 ====================
    function requestPermission() {
        if (!('Notification' in window)) return Promise.resolve('unsupported');
        if (Notification.permission === 'granted') return Promise.resolve('granted');
        if (Notification.permission === 'denied') return Promise.resolve('denied');
        return Notification.requestPermission();
    }

    // ==================== 对外接口 ====================
    window.BgNotify = {
        // 由 Ac 函数调用：AI 发消息时触发
        onAIMessage: function (message, contact) {
            if (!message || message.sender !== 'ai') return;
            if (message.type === 'system' || message.hidden) return;

            const text = message.text || (message.content && message.content.html) || '';
            if (!text) return;

            // 清理文本：去掉状态/内心独白元数据
            let cleanText = text.split('状态：')[0].trim();
            cleanText = cleanText.replace(/\\/g, ' ').replace(/\s+/g, ' ').trim();
            if (!cleanText) return;

            const aiName = contact && contact.ai ? contact.ai.name : '角色';
            const contactId = contact ? contact.id : null;

            sendLocalNotification(aiName, cleanText, contactId);
        },

        // 手动请求权限（设置页调用）
        requestPermission: requestPermission,

        // 开关控制
        setEnabled: function (v) {
            localStorage.setItem(NOTIFY_ENABLED_KEY, v ? 'true' : 'false');
        },
        setKeepaliveEnabled: function (v) {
            localStorage.setItem(KEEPALIVE_ENABLED_KEY, v ? 'true' : 'false');
        },
        isEnabled: isEnabled,
        isKeepaliveEnabled: isKeepaliveEnabled,
        isBackground: function () { return isBackground; },

        // 测试
        testNotification: function () {
            sendLocalNotification('测试', '这是一条后台推送测试通知', 'test');
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
            if (!('Notification' in window)) {
                if (permStatus) permStatus.textContent = '此浏览器不支持通知';
                if (requestBtn) requestBtn.style.display = 'none';
                return;
            }
            const perm = Notification.permission;
            if (perm === 'granted') {
                if (permStatus) { permStatus.textContent = '✓ 已授权'; permStatus.style.color = '#34C759'; }
                if (requestBtn) { requestBtn.textContent = '测试'; requestBtn.onclick = function () { window.BgNotify.testNotification(); }; }
            } else if (perm === 'denied') {
                if (permStatus) { permStatus.textContent = '✗ 已拒绝（请到浏览器设置中开启）'; permStatus.style.color = '#FF3B30'; }
                if (requestBtn) requestBtn.style.display = 'none';
            } else {
                if (permStatus) permStatus.textContent = '未授权';
                if (requestBtn) {
                    requestBtn.textContent = '授权';
                    requestBtn.onclick = function () {
                        requestPermission().then(function (result) {
                            updatePermUI();
                            if (result === 'granted' && window.showToast) window.showToast('通知权限已开启');
                        });
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
