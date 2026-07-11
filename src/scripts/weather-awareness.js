/* ==========================================================
 * 天气感知 (Weather Awareness)
 * - 数据源: Open-Meteo (免key)
 * - 作用域: 每个联系人独立配置
 * - 刷新: 每次进入网页都刷新 (lazy: 首次取用时拉一次, 不挂任何定时器/visibility监听器)
 * ========================================================== */
(function () {
    'use strict';

    // === 常量 ===
    var STORAGE_PREFIX_CFG = 'weather_cfg_';   // 配置: enabled + location
    var STORAGE_PREFIX_DATA = 'weather_data_'; // 缓存: 当前+7日
    var GEOCODE_URL = 'https://geocoding-api.open-meteo.com/v1/search';
    var FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';
    // 这次页面加载的会话ID, 用来判定缓存是否"本次会话已刷新过"
    var SESSION_ID = Date.now();

    // 模态弹窗的所有交互, 都通过 modalContext 在 open 时绑定一次, 关闭时一次性 cleanup, 防止累积监听器导致内存泄露.
    var modalContext = null;

    // === WMO 天气代码 → 中文 + emoji ===
    function describeWeatherCode(code, isDay) {
        var day = (typeof isDay === 'undefined') ? true : !!isDay;
        var map = {
            0: { t: '晴', e: day ? '☀️' : '🌙' },
            1: { t: '少云', e: day ? '🌤' : '🌙' },
            2: { t: '多云', e: '⛅️' },
            3: { t: '阴', e: '☁️' },
            45: { t: '雾', e: '🌫' },
            48: { t: '雾凇', e: '🌫' },
            51: { t: '小毛毛雨', e: '🌦' },
            53: { t: '毛毛雨', e: '🌦' },
            55: { t: '大毛毛雨', e: '🌧' },
            56: { t: '冻毛毛雨', e: '🌧' },
            57: { t: '冻毛毛雨', e: '🌧' },
            61: { t: '小雨', e: '🌦' },
            63: { t: '中雨', e: '🌧' },
            65: { t: '大雨', e: '🌧' },
            66: { t: '冻雨', e: '🌧' },
            67: { t: '强冻雨', e: '🌧' },
            71: { t: '小雪', e: '🌨' },
            73: { t: '中雪', e: '🌨' },
            75: { t: '大雪', e: '❄️' },
            77: { t: '米雪', e: '🌨' },
            80: { t: '阵雨', e: '🌦' },
            81: { t: '强阵雨', e: '🌧' },
            82: { t: '暴阵雨', e: '⛈' },
            85: { t: '阵雪', e: '🌨' },
            86: { t: '强阵雪', e: '❄️' },
            95: { t: '雷阵雨', e: '⛈' },
            96: { t: '雷阵雨夹冰雹', e: '⛈' },
            99: { t: '强雷阵雨夹冰雹', e: '⛈' }
        };
        return map[code] || { t: '未知天气', e: '🌡' };
    }

    // === 存储读写 ===
    function readJSON(key) {
        try {
            var raw = localStorage.getItem(key);
            if (!raw) return null;
            return JSON.parse(raw);
        } catch (e) {
            console.warn('[Weather] 读取存储失败:', key, e);
            return null;
        }
    }
    function writeJSON(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
            return true;
        } catch (e) {
            console.warn('[Weather] 写入存储失败:', key, e);
            return false;
        }
    }
    function loadConfig(contactId) {
        if (!contactId) return null;
        return readJSON(STORAGE_PREFIX_CFG + contactId);
    }
    function saveConfig(contactId, cfg) {
        if (!contactId) return;
        writeJSON(STORAGE_PREFIX_CFG + contactId, cfg);
    }
    function loadData(contactId) {
        if (!contactId) return null;
        return readJSON(STORAGE_PREFIX_DATA + contactId);
    }
    function saveData(contactId, data) {
        if (!contactId) return;
        writeJSON(STORAGE_PREFIX_DATA + contactId, data);
    }
    function clearWeather(contactId) {
        if (!contactId) return;
        try {
            localStorage.removeItem(STORAGE_PREFIX_CFG + contactId);
            localStorage.removeItem(STORAGE_PREFIX_DATA + contactId);
        } catch (e) { /* ignore */ }
    }

    // === 网络: 地理编码 + 天气 ===
    function geocode(name) {
        var url = GEOCODE_URL + '?name=' + encodeURIComponent(name) +
            '&count=1&language=zh&format=json';
        return fetch(url, { method: 'GET' }).then(function (r) {
            if (!r.ok) throw new Error('geocode HTTP ' + r.status);
            return r.json();
        }).then(function (j) {
            if (!j || !j.results || !j.results.length) {
                throw new Error('未找到「' + name + '」的位置');
            }
            var p = j.results[0];
            return {
                name: p.name,
                latitude: p.latitude,
                longitude: p.longitude,
                country: p.country || '',
                admin1: p.admin1 || '',
                timezone: p.timezone || 'auto'
            };
        });
    }

    function fetchForecast(loc) {
        var params = [
            'latitude=' + loc.latitude,
            'longitude=' + loc.longitude,
            'current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,wind_speed_10m',
            'daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max,sunrise,sunset',
            'timezone=auto',
            'forecast_days=7'
        ].join('&');
        return fetch(FORECAST_URL + '?' + params).then(function (r) {
            if (!r.ok) throw new Error('forecast HTTP ' + r.status);
            return r.json();
        });
    }

    // === 拉取并落库 ===
    function refreshFor(contactId) {
        var cfg = loadConfig(contactId);
        if (!cfg || !cfg.enabled || !cfg.location) {
            return Promise.resolve(null);
        }
        return fetchForecast(cfg.location).then(function (raw) {
            var data = {
                fetchedAt: new Date().toISOString(),
                fetchedSessionId: SESSION_ID,
                location: cfg.location,
                current: raw.current || null,
                daily: raw.daily || null
            };
            saveData(contactId, data);
            return data;
        }).catch(function (e) {
            console.warn('[Weather] 刷新失败:', contactId, e);
            return null;
        });
    }

    // === 给聊天注入用的 prompt 文本 ===
    // 调用入口: main.min.js 的 prompt 组装阶段
    // 行为: 若本会话还未刷新过 → 拉一次再返回; 已刷新过 → 直接用缓存
    function getWeatherText(contactId) {
        return new Promise(function (resolve) {
            try {
                if (!contactId) return resolve('');
                var cfg = loadConfig(contactId);
                if (!cfg || !cfg.enabled || !cfg.location) return resolve('');
                var data = loadData(contactId);
                var needRefresh = !data || data.fetchedSessionId !== SESSION_ID;

                var go = function () {
                    var d = loadData(contactId);
                    if (!d || !d.current || !d.daily) return resolve('');
                    resolve(buildPromptText(d));
                };

                if (needRefresh) {
                    refreshFor(contactId).then(go).catch(function () { resolve(''); });
                } else {
                    go();
                }
            } catch (e) {
                console.warn('[Weather] getWeatherText 异常:', e);
                resolve('');
            }
        });
    }

    function buildPromptText(d) {
        if (!d || !d.current || !d.daily) return '';
        var loc = d.location || {};
        var locName = loc.name || '';
        if (loc.admin1 && loc.admin1 !== loc.name) locName = loc.admin1 + ' · ' + locName;
        if (loc.country) locName = (loc.country) + ' / ' + locName;

        var c = d.current;
        var nowDesc = describeWeatherCode(c.weather_code, c.is_day);
        var fetchedDate = (function () {
            try { return new Date(d.fetchedAt).toLocaleString('zh-CN'); }
            catch (e) { return d.fetchedAt; }
        })();

        var lines = [];
        lines.push('### 🌤 当前user所在地的天气 (Weather Awareness)');
        lines.push('数据更新时间: ' + fetchedDate + '');
        lines.push('地点: ' + locName);
        lines.push('当前天气: ' + nowDesc.t +
            ', 气温 ' + Math.round(c.temperature_2m) + '°C' +
            ' (体感 ' + Math.round(c.apparent_temperature) + '°C)' +
            ', 湿度 ' + Math.round(c.relative_humidity_2m) + '%' +
            ', 风速 ' + Math.round(c.wind_speed_10m) + ' km/h');
        lines.push('');
        lines.push('未来 7 日预报:');
        var dy = d.daily;
        var n = (dy.time || []).length;
        for (var i = 0; i < n; i++) {
            var date = dy.time[i];
            var dd = describeWeatherCode(dy.weather_code[i], true);
            var lo = Math.round(dy.temperature_2m_min[i]);
            var hi = Math.round(dy.temperature_2m_max[i]);
            var rain = dy.precipitation_sum && dy.precipitation_sum[i] != null
                ? (' 降水 ' + dy.precipitation_sum[i] + 'mm') : '';
            lines.push('- ' + date + ' ' + dd.t + ' ' + lo + '°/' + hi + '°C' + rain);
        }
        lines.push('');
        lines.push('请参考user所在地的天气情况，在对话中自然地关心user（例如：冷时提醒保暖，雨天提醒带伞）。' +
            '【重要提示】这是user所在地的天气，绝对不要把它当做你自己所在地的天气。' +
            '请自然地融入对话，不要像机器人一样直接念出预报数字，也不要每次都强调天气。');
        lines.push('---');
        return lines.join('\n');
    }

    // === 解析当前激活的联系人ID ===
    function getActiveContactId() {
        try {
            var c = window.currentOpenContact;
            if (c && c.id) return c.id;
        } catch (e) { /* ignore */ }
        return null;
    }

    // === 弹窗 UI ===
    function escapeHtml(s) {
        if (s == null) return '';
        return String(s)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    function buildModalDom(contactId, cfg, data) {
        var enabled = !!(cfg && cfg.enabled);
        var loc = (cfg && cfg.location) || (data && data.location) || null;

        var html = ''
            + '<div class="weather-modal-overlay" id="weather-modal-overlay">'
            + '  <div class="weather-modal" role="dialog" aria-modal="true">'
            + '    <div class="weather-modal-header">'
            + '      <div class="weather-modal-title">'
            + '        <svg viewBox="0 0 24 24"><path d="M17.5 19a4.5 4.5 0 1 0 -1.7 -8.7 6 6 0 0 0 -11.5 2.2 4 4 0 0 0 .7 7.9z"></path><circle cx="6.5" cy="7.5" r="2.5"></circle></svg>'
            + '        天气感知'
            + '      </div>'
            + '      <button class="weather-modal-close" id="weather-close-btn" aria-label="关闭">'
            + '        <svg viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12"/></svg>'
            + '      </button>'
            + '    </div>'
            + '    <div class="weather-modal-body">'
            + '      <div class="weather-setting-row">'
            + '        <div>'
            + '          <div class="weather-setting-label">启用天气感知</div>'
            + '          <div class="weather-setting-hint">开启后, 当前联系人聊天时会把当地天气作为环境背景注入prompt</div>'
            + '        </div>'
            + '        <div class="weather-switch ' + (enabled ? 'active' : '') + '" id="weather-toggle"></div>'
            + '      </div>'
            + '      <div class="weather-input-section">'
            + '        <div class="weather-setting-label" style="margin-bottom: 8px;">地点</div>'
            + '        <div class="weather-input-row">'
            + '          <input class="weather-input-field" id="weather-loc-input" type="text" autocomplete="off" placeholder="例如: 上海 / Tokyo / 拉萨" value="' + escapeHtml(loc ? loc.name : '') + '"/>'
            + '          <button class="weather-fetch-btn" id="weather-fetch-btn">查询</button>'
            + '        </div>'
            + '        <div class="weather-status-bar" id="weather-status"></div>'
            + '      </div>'
            + '      <div class="weather-result-section" id="weather-result-section">'
            + '        <div id="weather-result-content"></div>'
            + '      </div>'
            + '      <div class="weather-empty-state" id="weather-empty-state" style="display:none;">'
            + '        <svg viewBox="0 0 24 24"><path d="M17.5 19a4.5 4.5 0 1 0 -1.7 -8.7 6 6 0 0 0 -11.5 2.2 4 4 0 0 0 .7 7.9z"/></svg>'
            + '        输入地点点击查询, 即可获取该地的实时天气和未来7日预报'
            + '      </div>'
            + '    </div>'
            + '    <div class="weather-modal-footer">'
            + '      <button class="weather-btn-secondary" id="weather-cancel-btn">取消</button>'
            + '      <button class="weather-btn-primary" id="weather-save-btn">保存</button>'
            + '    </div>'
            + '  </div>'
            + '</div>';
        return html;
    }

    function renderResultBlock(d) {
        if (!d || !d.current || !d.daily) return '';
        var c = d.current;
        var loc = d.location || {};
        var locStr = loc.name || '';
        if (loc.admin1 && loc.admin1 !== loc.name) locStr = loc.admin1 + ' · ' + locStr;
        if (loc.country) locStr = locStr + ' (' + loc.country + ')';
        var nowDesc = describeWeatherCode(c.weather_code, c.is_day);
        var stamp = (function () {
            try { return new Date(d.fetchedAt).toLocaleString('zh-CN'); } catch (e) { return d.fetchedAt; }
        })();

        var head = ''
            + '<div class="weather-current-card">'
            + '  <div class="weather-current-top">'
            + '    <div>'
            + '      <div class="weather-location-name">' + escapeHtml(locStr) + '</div>'
            + '      <div class="weather-update-stamp">更新于 ' + escapeHtml(stamp) + '</div>'
            + '    </div>'
            + '    <div class="weather-icon-emoji" style="font-size: 28px;">' + nowDesc.e + '</div>'
            + '  </div>'
            + '  <div class="weather-temp-now">' + Math.round(c.temperature_2m) + '°<span>体感 ' + Math.round(c.apparent_temperature) + '°</span></div>'
            + '  <div class="weather-condition-row">'
            + '    <span>' + escapeHtml(nowDesc.t) + '</span>'
            + '  </div>'
            + '  <div class="weather-meta-grid">'
            + '    <div class="weather-meta-cell"><div class="weather-meta-cell-label">湿度</div><div class="weather-meta-cell-value">' + Math.round(c.relative_humidity_2m) + '%</div></div>'
            + '    <div class="weather-meta-cell"><div class="weather-meta-cell-label">风速</div><div class="weather-meta-cell-value">' + Math.round(c.wind_speed_10m) + ' km/h</div></div>'
            + '    <div class="weather-meta-cell"><div class="weather-meta-cell-label">降水</div><div class="weather-meta-cell-value">' + (c.precipitation || 0) + ' mm</div></div>'
            + '  </div>'
            + '</div>';

        var rows = '';
        var dy = d.daily;
        var n = (dy.time || []).length;
        var weekday = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
        for (var i = 0; i < n; i++) {
            var dd = describeWeatherCode(dy.weather_code[i], true);
            var dayLabel = i === 0 ? '今天' : (function () {
                var t = new Date(dy.time[i]);
                if (isNaN(t.getTime())) return dy.time[i];
                return weekday[t.getDay()] + ' ' + (t.getMonth() + 1) + '/' + t.getDate();
            })();
            rows += ''
                + '<div class="weather-forecast-row">'
                + '  <div class="weather-forecast-day">' + escapeHtml(dayLabel) + '</div>'
                + '  <div class="weather-forecast-icon">' + dd.e + '</div>'
                + '  <div class="weather-forecast-desc">' + escapeHtml(dd.t) + '</div>'
                + '  <div class="weather-forecast-temps"><span class="lo">' + Math.round(dy.temperature_2m_min[i]) + '°</span>' + Math.round(dy.temperature_2m_max[i]) + '°</div>'
                + '</div>';
        }

        return head
            + '<div class="weather-forecast-title">未来 7 日</div>'
            + '<div class="weather-forecast-list">' + rows + '</div>';
    }

    // === 模态打开/关闭 ===
    // 设计要点: 整个 modal 的 DOM 每次打开时创建, 关闭时整体移除并 cleanup 所有事件,
    // 所以不会有累积的监听器/定时器残留 → 防内存泄露.
    function openModal(contactId) {
        if (!contactId) {
            console.warn('[Weather] 无激活联系人, 无法打开');
            return;
        }
        if (modalContext) closeModal(true); // 强制清掉旧的

        var root = document.getElementById('weather-modal-root');
        if (!root) {
            // 兜底: 找不到挂载点时, 临时挂在 body 末尾
            root = document.createElement('div');
            root.id = 'weather-modal-root';
            document.body.appendChild(root);
        }

        var cfg = loadConfig(contactId) || { enabled: false, location: null };
        var data = loadData(contactId);
        root.innerHTML = buildModalDom(contactId, cfg, data);

        var overlay = root.querySelector('#weather-modal-overlay');
        var modal = overlay.querySelector('.weather-modal');
        var toggle = overlay.querySelector('#weather-toggle');
        var input = overlay.querySelector('#weather-loc-input');
        var fetchBtn = overlay.querySelector('#weather-fetch-btn');
        var status = overlay.querySelector('#weather-status');
        var resultSection = overlay.querySelector('#weather-result-section');
        var resultContent = overlay.querySelector('#weather-result-content');
        var emptyState = overlay.querySelector('#weather-empty-state');
        var saveBtn = overlay.querySelector('#weather-save-btn');
        var cancelBtn = overlay.querySelector('#weather-cancel-btn');
        var closeBtn = overlay.querySelector('#weather-close-btn');

        // 状态: 编辑中的临时态, 保存时才落库
        var draft = {
            enabled: !!cfg.enabled,
            location: cfg.location || (data && data.location) || null,
            data: data || null
        };

        function showStatus(text, isError) {
            if (!text) {
                status.classList.remove('show', 'error');
                status.textContent = '';
                return;
            }
            status.textContent = text;
            status.classList.add('show');
            status.classList.toggle('error', !!isError);
        }
        function showResult(d) {
            if (!d || !d.current) {
                resultSection.classList.remove('show');
                emptyState.style.display = 'block';
                return;
            }
            resultContent.innerHTML = renderResultBlock(d);
            resultSection.classList.add('show');
            emptyState.style.display = 'none';
        }
        function refreshUI() {
            toggle.classList.toggle('active', !!draft.enabled);
            if (draft.data) showResult(draft.data);
            else if (draft.location) {
                resultSection.classList.remove('show');
                emptyState.style.display = 'block';
            } else {
                resultSection.classList.remove('show');
                emptyState.style.display = 'block';
            }
        }
        refreshUI();

        var handlers = []; // 收集 (el, type, fn) 以便统一移除

        function on(el, type, fn) {
            if (!el) return;
            el.addEventListener(type, fn);
            handlers.push({ el: el, type: type, fn: fn });
        }

        // 切换 switch
        on(toggle, 'click', function () {
            draft.enabled = !draft.enabled;
            toggle.classList.toggle('active', draft.enabled);
        });

        // 查询位置 + 拉天气
        var fetching = false;
        function doFetch() {
            if (fetching) return;
            var name = (input.value || '').trim();
            if (!name) {
                showStatus('请输入地点名', true);
                return;
            }
            fetching = true;
            fetchBtn.disabled = true;
            fetchBtn.textContent = '查询中…';
            showStatus('正在解析地点…', false);

            geocode(name).then(function (loc) {
                showStatus('正在获取天气…', false);
                return fetchForecast(loc).then(function (raw) {
                    var d = {
                        fetchedAt: new Date().toISOString(),
                        fetchedSessionId: SESSION_ID,
                        location: loc,
                        current: raw.current || null,
                        daily: raw.daily || null
                    };
                    draft.location = loc;
                    draft.data = d;
                    showResult(d);
                    showStatus('', false);
                });
            }).catch(function (e) {
                console.warn('[Weather] 查询失败:', e);
                showStatus('查询失败: ' + (e && e.message ? e.message : '网络错误, 请稍后重试'), true);
            }).then(function () {
                fetching = false;
                fetchBtn.disabled = false;
                fetchBtn.textContent = '查询';
            });
        }
        on(fetchBtn, 'click', doFetch);
        on(input, 'keydown', function (e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                doFetch();
            }
        });

        // 取消 / 关闭
        function close() { closeModal(false); }
        on(cancelBtn, 'click', close);
        on(closeBtn, 'click', close);
        on(overlay, 'click', function (e) {
            // 点击遮罩空白处关闭
            if (e.target === overlay) close();
        });

        // 保存
        on(saveBtn, 'click', function () {
            // 启用但没有位置 → 阻止保存
            if (draft.enabled && !draft.location) {
                showStatus('启用前请先查询并设置一个地点', true);
                return;
            }
            var newCfg = {
                enabled: draft.enabled,
                location: draft.location || null
            };
            saveConfig(contactId, newCfg);
            if (draft.data) saveData(contactId, draft.data);

            // 关闭后给一个轻提示
            try {
                if (window.showToast) window.showToast(draft.enabled ? '天气感知已开启' : '天气感知已关闭');
            } catch (e) { /* ignore */ }
            close();
        });

        // 显示动画 (next frame)
        requestAnimationFrame(function () {
            overlay.classList.add('active');
        });

        modalContext = {
            root: root,
            overlay: overlay,
            handlers: handlers
        };
    }

    function closeModal(immediate) {
        if (!modalContext) return;
        var ctx = modalContext;
        modalContext = null; // 立即置空, 防止重入

        // 一次性移除所有事件监听器
        if (ctx.handlers) {
            for (var i = 0; i < ctx.handlers.length; i++) {
                var h = ctx.handlers[i];
                try { h.el.removeEventListener(h.type, h.fn); } catch (e) { /* ignore */ }
            }
            ctx.handlers.length = 0;
        }

        var doRemove = function () {
            try { if (ctx.root) ctx.root.innerHTML = ''; } catch (e) { /* ignore */ }
        };
        if (immediate) {
            doRemove();
        } else {
            try { ctx.overlay.classList.remove('active'); } catch (e) { /* ignore */ }
            setTimeout(doRemove, 280); // 等过渡动画结束
        }
    }

    // === 入口绑定 ===
    // 用一次性的事件委托, 整个生命周期只挂这一个 listener.
    var entryBoundOnce = false;
    function bindEntryButton() {
        if (entryBoundOnce) return;
        entryBoundOnce = true;
        document.addEventListener('click', function (e) {
            var btn = e.target && e.target.closest && e.target.closest('#weather-entry-btn');
            if (!btn) return;
            var cid = getActiveContactId();
            if (!cid) {
                try { if (window.showToast) window.showToast('请先选择一个联系人'); } catch (err) { }
                return;
            }
            openModal(cid);
        });
    }

    // === 暴露全局 API ===
    window.WeatherAwareness = {
        getWeatherText: getWeatherText,   // 给 main.min.js prompt 注入用
        open: openModal,
        close: function () { closeModal(false); },
        clear: clearWeather,
        // 调试用: 强制刷新某联系人的天气数据
        refresh: refreshFor,
        SESSION_ID: SESSION_ID
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', bindEntryButton);
    } else {
        bindEntryButton();
    }
})();
