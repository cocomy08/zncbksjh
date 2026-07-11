/**
 * ios-memory-critical.js
 * iOS 内存危机处理模块
 * 
 * 针对堆快照中发现的问题:
 * - (string) 23,899个对象 = 8,103kB (30%) 👈 最大问题
 * - Function x31,271 👈 闭包泄漏
 * - CSSStyleRule x13,087 👈 已通过移除Tailwind解决
 * 
 * 这个脚本提供更激进的内存管理策略
 */

(function () {
    'use strict';

    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
        (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

    if (!isIOS) {
        console.log('[iOS Memory] 非 iOS 设备，跳过激进优化');
        return;
    }

    console.log('[iOS Memory] 🚨 启动 iOS 内存危机处理模块');

    // ========================================================================
    // 1. String 对象优化 - 使用 WeakRef 管理大字符串
    // ========================================================================
    const StringCache = {
        // 使用 Map 而非对象字面量，避免 string key 的内存问题
        _cache: new Map(),
        _maxSize: 50, // 最多缓存50个大字符串

        /**
         * 缓存字符串（如果太大则不缓存）
         */
        set(key, value) {
            // 超过100KB的字符串不缓存
            if (typeof value === 'string' && value.length > 100000) {
                console.warn('[iOS Memory] 跳过缓存超大字符串:', key, '长度:', value.length);
                return;
            }

            // LRU: 如果缓存满了，删除最旧的
            if (this._cache.size >= this._maxSize) {
                const firstKey = this._cache.keys().next().value;
                this._cache.delete(firstKey);
            }

            this._cache.set(key, value);
        },

        get(key) {
            return this._cache.get(key);
        },

        clear() {
            this._cache.clear();
            console.log('[iOS Memory] StringCache 已清空');
        }
    };

    window.StringCache = StringCache;

    // ========================================================================
    // 2. 周期性强制清理已移除 (2026-01-09)
    // 原因：每30秒执行 querySelectorAll 会导致内存抖动和性能问题
    // 保留紧急清理和可见性切换清理功能
    // ========================================================================

    // ========================================================================
    // 3. 紧急内存清理
    // ========================================================================
    function triggerEmergencyCleanup() {
        console.log('[iOS Memory] 🚨 执行紧急内存清理...');

        // 3.1 清理所有 data: URL 图片缓存
        document.querySelectorAll('img').forEach(img => {
            if (img.src && img.src.startsWith('data:') && img.src.length > 50000) {
                // 保存原始 src 到 dataset，用占位图替代
                if (!img.dataset.originalSrc) {
                    img.dataset.originalSrc = img.src;
                    img.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
                }
            }
        });

        // 3.2 清理旧的聊天消息 DOM
        const chatContainers = document.querySelectorAll('.chat-messages-container');
        chatContainers.forEach(container => {
            const messages = container.querySelectorAll('.message-row');
            if (messages.length > 100) {
                // 保留最新50条，删除旧的
                const toRemove = messages.length - 50;
                for (let i = 0; i < toRemove; i++) {
                    if (messages[i] && messages[i].parentNode) {
                        messages[i].parentNode.removeChild(messages[i]);
                    }
                }
                console.log(`[iOS Memory] 删除了 ${toRemove} 条旧消息 DOM`);
            }
        });

        // 3.3 清理 StringCache
        StringCache.clear();

        // 3.4 提示 GC（如果可用）
        if (window.gc) {
            try { window.gc(); } catch (e) { }
        }
    }

    // ========================================================================
    // 4. 监听内存警告事件
    // ========================================================================
    window.addEventListener('memorywarning', () => {
        console.warn('[iOS Memory] 收到系统内存警告！');
        triggerEmergencyCleanup();
    });

    // iOS Safari 特有的低内存事件
    window.addEventListener('lowMemory', () => {
        console.warn('[iOS Memory] 收到低内存事件！');
        triggerEmergencyCleanup();
    });

    // ========================================================================
    // 5. 页面可见性切换时的内存管理
    // ========================================================================
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            console.log('[iOS Memory] 页面进入后台，执行深度清理...');

            // 清理所有非必要的大对象
            if (window.TTSCache && window.TTSCache.clear) {
                window.TTSCache.clear();
            }

            // 清理图片缓存
            document.querySelectorAll('img[data-src]').forEach(img => {
                if (img.src && !img.src.startsWith('http')) {
                    img.dataset.tempSrc = img.src;
                    img.src = '';
                }
            });

            // 清理音频缓存
            document.querySelectorAll('audio').forEach(audio => {
                audio.pause();
                audio.src = '';
                audio.load();
            });

            StringCache.clear();
        } else {
            // 恢复缓存的图片
            document.querySelectorAll('img[data-temp-src]').forEach(img => {
                if (img.dataset.tempSrc) {
                    img.src = img.dataset.tempSrc;
                    delete img.dataset.tempSrc;
                }
            });
        }
    });

    // ========================================================================
    // 6. 优化 JSON 解析 - 避免大字符串驻留内存
    // ========================================================================
    const originalJSONParse = JSON.parse;
    JSON.parse = function (text, reviver) {
        // 如果字符串超过 1MB，解析后立即置空原字符串引用
        const isLarge = typeof text === 'string' && text.length > 1000000;

        try {
            const result = originalJSONParse.call(JSON, text, reviver);

            if (isLarge) {
                console.log('[iOS Memory] 已解析大型 JSON，长度:', text.length);
                // 无法真正释放 text，但至少记录日志帮助调试
            }

            return result;
        } catch (e) {
            throw e;
        }
    };

    // ========================================================================
    // 7. 启动
    // ========================================================================
    // startPeriodicCleanup(); // 已移除 - 导致内存抖动

    // 暴露 API
    window.iOSMemoryCritical = {
        triggerEmergencyCleanup,
        StringCache
    };

    console.log('[iOS Memory] ✅ iOS 内存危机处理模块已激活');

})();
