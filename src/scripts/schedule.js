/* ==========================================================
 * 近7天日程 (7-Day Schedule)
 * - 每个联系人独立日程, 绝不串联
 * - AI 根据人设 + 世界书 + 近期聊天生成7天行程
 * - 支持逐条编辑/删除/新增, 支持整体重新生成
 * - 已完成/进行中状态通过 new Date() 即时计算, 零定时器
 * ========================================================== */
(function () {
    'use strict';

    var STORAGE_KEY_PREFIX = 'schedule_data_';

    var WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

    function storageKey(contactId) {
        return STORAGE_KEY_PREFIX + contactId;
    }

    function readSchedule(contactId) {
        try {
            var raw = localStorage.getItem(storageKey(contactId));
            return raw ? JSON.parse(raw) : null;
        } catch (e) {
            return null;
        }
    }

    function saveSchedule(contactId, data) {
        try {
            localStorage.setItem(storageKey(contactId), JSON.stringify(data));
        } catch (e) {
            console.error('[Schedule] 保存失败:', e);
        }
    }

    function getDefaultData() {
        return {
            enabled: false,
            items: [],
            generatedAt: null
        };
    }

    // === 日期工具 ===
    function dateStr(d) {
        var y = d.getFullYear();
        var m = String(d.getMonth() + 1).padStart(2, '0');
        var day = String(d.getDate()).padStart(2, '0');
        return y + '-' + m + '-' + day;
    }

    function get7Days() {
        var days = [];
        var now = new Date();
        for (var i = 0; i < 7; i++) {
            var d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
            days.push({
                date: dateStr(d),
                weekday: WEEKDAYS[d.getDay()],
                isToday: i === 0
            });
        }
        return days;
    }

    function computeStatus(item) {
        var now = new Date();
        var today = dateStr(now);
        if (item.date < today) return 'done';
        if (item.date > today) return '';
        if (!item.startTime) return '';
        var nowMinutes = now.getHours() * 60 + now.getMinutes();
        var parts = item.startTime.split(':');
        var startMin = parseInt(parts[0], 10) * 60 + parseInt(parts[1] || '0', 10);
        var endMin = startMin + 120;
        if (item.endTime) {
            var ep = item.endTime.split(':');
            endMin = parseInt(ep[0], 10) * 60 + parseInt(ep[1] || '0', 10);
        }
        if (nowMinutes >= endMin) return 'done';
        if (nowMinutes >= startMin) return 'ongoing';
        return '';
    }

    // === 获取世界书内容 ===
    async function getWorldBookContent(contact) {
        var linkedIds = [];
        if (contact.linkedWorldBookIds && contact.linkedWorldBookIds.length > 0) {
            linkedIds = contact.linkedWorldBookIds.slice();
        } else if (contact.linkedWorldbooks && contact.linkedWorldbooks.length > 0) {
            linkedIds = contact.linkedWorldbooks.slice();
        } else if (contact.linkedWorldBookGroupIds && contact.linkedWorldBookGroupIds.length > 0) {
            try {
                var gData = await window.dbHelper.loadData('worldBookGroups', 'allGroups');
                var groups = gData && Array.isArray(gData.value) ? gData.value : [];
                var gSet = new Set(contact.linkedWorldBookGroupIds);
                groups.forEach(function (g) {
                    if (gSet.has(g.id) && Array.isArray(g.bookIds)) {
                        g.bookIds.forEach(function (bid) { linkedIds.push(bid); });
                    }
                });
            } catch (e) {
                console.error('[Schedule] 读取世界书分组失败:', e);
            }
        }
        if (linkedIds.length === 0) return '';

        try {
            var wbData = await window.dbHelper.loadData('worldBooks', 'allWorldBooks');
            if (!wbData || !wbData.value) {
                wbData = await window.dbHelper.loadData('worldbooksStore', 'allWorldbooks');
            }
            var allBooks = wbData && Array.isArray(wbData.value) ? wbData.value : [];
            var idSet = new Set(linkedIds);
            var content = '';
            allBooks.forEach(function (wb) {
                if (idSet.has(wb.id) && wb.entries && wb.entries.length > 0) {
                    wb.entries.forEach(function (entry) {
                        if (entry.content) content += entry.content + '\n';
                    });
                }
            });
            return content.trim().substring(0, 3000);
        } catch (e) {
            console.error('[Schedule] 读取世界书失败:', e);
            return '';
        }
    }

    // === AI 生成日程 ===
    async function generateSchedule(contact) {
        var settingsData = await window.dbHelper.loadData('settingsStore', 'apiSettings');
        if (!settingsData || !settingsData.value) {
            throw new Error('未配置API');
        }

        var aiName = (contact.ai && contact.ai.name) || 'AI';
        var aiPersona = (contact.ai && contact.ai.persona) || '';
        var userName = (contact.user && contact.user.name) || '用户';
        var userPersona = (contact.user && contact.user.persona) || '';

        var worldBookContent = await getWorldBookContent(contact);

        var history = contact.history || [];
        var recentMessages = history.slice(-100);
        var chatContext = '';
        if (recentMessages.length > 0) {
            chatContext = recentMessages.map(function (m) {
                var sender = m.sender === 'ai' ? aiName : userName;
                var text = (m.text || '').substring(0, 150);
                return sender + ': ' + text;
            }).join('\n');
        }

        var days = get7Days();
        var daysStr = days.map(function (d) {
            return d.date + ' (' + d.weekday + (d.isToday ? ', 今天' : '') + ')';
        }).join('\n');

        var systemPrompt = '你是一个日程规划助手。你需要为角色"' + aiName + '"安排接下来7天的日程。\n' +
            '请根据角色的人设、世界观背景和最近的对话情节，安排合理且有故事感的日程。\n' +
            '日程应该符合角色性格和当前剧情发展。\n\n' +
            '严格按照JSON数组格式输出，每个元素包含：\n' +
            '- date: 日期字符串 (YYYY-MM-DD)\n' +
            '- startTime: 开始时间 (HH:MM)\n' +
            '- endTime: 结束时间 (HH:MM)\n' +
            '- activity: 活动描述 (简短，15字以内)\n\n' +
            '每天安排3-5个活动，时间段合理分布（早中晚）。\n' +
            '只输出JSON数组，不要输出其他内容。不要用markdown代码块包裹。';

        var userPrompt = '## 角色信息\n' +
            '角色名: ' + aiName + '\n' +
            '角色人设:\n' + (aiPersona.substring(0, 800) || '（未设置）') + '\n\n' +
            '## 用户信息\n' +
            '用户名: ' + userName + '\n' +
            (userPersona ? '用户人设:\n' + userPersona.substring(0, 300) + '\n\n' : '\n') +
            (worldBookContent ? '## 世界观/背景\n' + worldBookContent.substring(0, 1500) + '\n\n' : '') +
            (chatContext ? '## 近期对话\n' + chatContext.substring(0, 3000) + '\n\n' : '') +
            '## 需要安排日程的日期\n' + daysStr + '\n\n' +
            '请为' + aiName + '安排这7天的日程，直接输出JSON数组。';

        var messages = [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
        ];

        var data = await window.universalApiRequest(settingsData.value, messages, { customTemperature: 0.7 });
        var content = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
        if (!content) throw new Error('AI返回为空');

        var cleaned = content.trim();
        if (cleaned.startsWith('```')) {
            cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
        }

        var items = JSON.parse(cleaned);
        if (!Array.isArray(items)) throw new Error('返回格式不是数组');

        return items.map(function (it) {
            return {
                id: 'si_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
                date: it.date || '',
                startTime: it.startTime || '',
                endTime: it.endTime || '',
                activity: it.activity || ''
            };
        });
    }

    // === 构建 prompt 文本 ===
    function buildPromptText(contactId) {
        var data = readSchedule(contactId);
        if (!data || !data.enabled || !data.items || data.items.length === 0) return '';

        var now = new Date();
        var todayStr = dateStr(now);

        var relevantItems = data.items.filter(function (it) {
            return it.date >= todayStr;
        });

        if (relevantItems.length === 0) return '';

        var lines = ['【日程安排】以下是你接下来的日程，你必须严格按照这个日程行事。当用户问你在做什么或有什么安排时，请参照此日程回答。\n'];

        var grouped = {};
        relevantItems.forEach(function (it) {
            if (!grouped[it.date]) grouped[it.date] = [];
            grouped[it.date].push(it);
        });

        Object.keys(grouped).sort().forEach(function (date) {
            var d = new Date(date + 'T00:00:00');
            var label = date + ' ' + WEEKDAYS[d.getDay()];
            if (date === todayStr) label += '（今天）';
            lines.push(label + ':');
            grouped[date].sort(function (a, b) {
                return (a.startTime || '').localeCompare(b.startTime || '');
            }).forEach(function (it) {
                var timeRange = it.startTime;
                if (it.endTime) timeRange += '-' + it.endTime;
                var status = computeStatus(it);
                var statusTag = status === 'done' ? '（已完成）' : status === 'ongoing' ? '（正在进行）' : '';
                lines.push('  ' + timeRange + ' ' + it.activity + statusTag);
            });
        });

        return lines.join('\n');
    }

    // === Toast ===
    function showToast(msg) {
        var el = document.getElementById('schedule-toast');
        if (!el) {
            el = document.createElement('div');
            el.id = 'schedule-toast';
            el.className = 'schedule-toast';
            document.body.appendChild(el);
        }
        el.textContent = msg;
        el.classList.add('show');
        setTimeout(function () { el.classList.remove('show'); }, 2000);
    }

    // === 渲染覆盖层 ===
    var overlayHandlers = [];

    function collectDisplayDays(data) {
        var days = get7Days();
        var todayStr = days[0].date;
        var daySet = {};
        days.forEach(function (d) { daySet[d.date] = d; });

        if (data.items) {
            data.items.forEach(function (it) {
                if (!daySet[it.date] && it.date < todayStr) {
                    var d = new Date(it.date + 'T00:00:00');
                    daySet[it.date] = {
                        date: it.date,
                        weekday: WEEKDAYS[d.getDay()],
                        isToday: false,
                        isPast: true
                    };
                }
            });
        }

        return Object.keys(daySet).sort().map(function (k) {
            var day = daySet[k];
            if (!day.isPast && day.date < todayStr) day.isPast = true;
            return day;
        });
    }

    function renderOverlay(contactId) {
        var root = document.getElementById('schedule-overlay-root');
        if (!root) return;

        var data = readSchedule(contactId) || getDefaultData();
        var days = collectDisplayDays(data);
        var todayStr = dateStr(new Date());

        var itemsByDate = {};
        if (data.items) {
            data.items.forEach(function (it) {
                if (!itemsByDate[it.date]) itemsByDate[it.date] = [];
                itemsByDate[it.date].push(it);
            });
        }

        var hasItems = data.items && data.items.length > 0;

        var html = '<div id="schedule-overlay">';

        // 导航栏
        html += '<div class="schedule-nav-bar">';
        html += '<button class="schedule-back-btn" id="schedule-close-btn"><svg viewBox="0 0 24 24"><path d="M15 18l-6-6 6-6"/></svg></button>';
        html += '<div class="schedule-nav-title">近7天日程</div>';
        html += '<div class="schedule-nav-right"></div>';
        html += '</div>';

        // 内容区
        html += '<div class="schedule-body">';

        // 开关卡
        html += '<div class="schedule-settings-card">';
        html += '<div class="schedule-setting-row">';
        html += '<div class="schedule-setting-left">';
        html += '<div class="schedule-setting-label">启用日程</div>';
        html += '<div class="schedule-setting-hint">开启后AI将按照日程行事</div>';
        html += '</div>';
        html += '<div class="schedule-switch' + (data.enabled ? ' active' : '') + '" id="schedule-toggle"></div>';
        html += '</div>';
        html += '</div>';

        // 操作按钮
        html += '<div class="schedule-actions">';
        html += '<button class="schedule-btn schedule-btn-primary" id="schedule-generate-btn">';
        html += '<svg viewBox="0 0 24 24"><path d="M12 2v4m0 12v4m-7.07-3.93l2.83-2.83m8.48-8.48l2.83-2.83M2 12h4m12 0h4m-3.93 7.07l-2.83-2.83M7.76 7.76L4.93 4.93"/></svg>';
        html += hasItems ? '重新生成' : '生成日程';
        html += '</button>';
        html += '</div>';

        // 日程列表
        if (!hasItems) {
            html += '<div class="schedule-empty-state">';
            html += '<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/></svg>';
            html += '<p>还没有日程安排<br>点击「生成日程」让AI为角色规划一周行程</p>';
            html += '</div>';
        } else {
            days.forEach(function (day) {
                var dayItems = itemsByDate[day.date] || [];
                var isPast = day.date < todayStr;
                if (dayItems.length === 0 && isPast) return;

                html += '<div class="schedule-day-group" data-date="' + day.date + '">';
                html += '<div class="schedule-day-header">';
                html += '<span class="schedule-day-date">' + day.date.substring(5) + '</span>';
                html += '<span class="schedule-day-weekday">' + day.weekday + '</span>';
                if (day.isToday) html += '<span class="schedule-day-badge-today">今天</span>';
                else if (isPast) html += '<span class="schedule-day-badge-past">已过</span>';
                html += '</div>';

                if (dayItems.length > 0) {
                    dayItems.sort(function (a, b) {
                        return (a.startTime || '').localeCompare(b.startTime || '');
                    });
                    dayItems.forEach(function (item) {
                        var status = computeStatus(item);
                        html += '<div class="schedule-item-card' + (status === 'done' ? ' past' : '') + '" data-item-id="' + item.id + '">';
                        html += '<div class="schedule-item-time-col">';
                        html += '<div class="schedule-item-time">' + (item.startTime || '--:--') + '</div>';
                        if (item.endTime) html += '<div class="schedule-item-period">' + item.endTime + '</div>';
                        html += '</div>';
                        html += '<div class="schedule-item-content-col">';
                        html += '<div class="schedule-item-activity">' + escapeHtml(item.activity) + '</div>';
                        if (status === 'done') html += '<span class="schedule-item-status done">已完成</span>';
                        else if (status === 'ongoing') html += '<span class="schedule-item-status ongoing">进行中</span>';
                        html += '</div>';
                        html += '<div class="schedule-item-actions">';
                        html += '<button class="schedule-item-btn edit-btn" data-edit-id="' + item.id + '"><svg viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>';
                        html += '<button class="schedule-item-btn delete-btn" data-delete-id="' + item.id + '"><svg viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12"/></svg></button>';
                        html += '</div>';
                        html += '</div>';
                    });
                }

                // 添加按钮 (只在今天和未来显示)
                if (!isPast) {
                    html += '<button class="schedule-add-item-btn" data-add-date="' + day.date + '">';
                    html += '<svg viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>';
                    html += '添加';
                    html += '</button>';
                }

                html += '</div>';
            });
        }

        html += '</div>'; // schedule-body
        html += '</div>'; // schedule-overlay

        root.innerHTML = html;

        // 启动滑入动画
        requestAnimationFrame(function () {
            var overlay = document.getElementById('schedule-overlay');
            if (overlay) overlay.classList.add('active');
        });

        // 绑定事件
        bindOverlayEvents(contactId);
    }

    function escapeHtml(str) {
        var div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    function bindOverlayEvents(contactId) {
        cleanupOverlayEvents();

        function addHandler(el, event, fn) {
            if (!el) return;
            el.addEventListener(event, fn);
            overlayHandlers.push({ el: el, event: event, fn: fn });
        }

        // 关闭
        addHandler(document.getElementById('schedule-close-btn'), 'click', function () {
            closeOverlay();
        });

        // 开关
        addHandler(document.getElementById('schedule-toggle'), 'click', function () {
            var data = readSchedule(contactId) || getDefaultData();
            data.enabled = !data.enabled;
            saveSchedule(contactId, data);
            var sw = document.getElementById('schedule-toggle');
            if (sw) sw.classList.toggle('active', data.enabled);
            showToast(data.enabled ? '日程已启用' : '日程已关闭');
        });

        // 生成
        addHandler(document.getElementById('schedule-generate-btn'), 'click', function () {
            doGenerate(contactId);
        });

        // 事件委托: 编辑/删除/添加
        var body = document.querySelector('#schedule-overlay .schedule-body');
        if (body) {
            addHandler(body, 'click', function (e) {
                var editBtn = e.target.closest('[data-edit-id]');
                if (editBtn) {
                    openEditModal(contactId, editBtn.getAttribute('data-edit-id'));
                    return;
                }
                var deleteBtn = e.target.closest('[data-delete-id]');
                if (deleteBtn) {
                    deleteItem(contactId, deleteBtn.getAttribute('data-delete-id'));
                    return;
                }
                var addBtn = e.target.closest('[data-add-date]');
                if (addBtn) {
                    openEditModal(contactId, null, addBtn.getAttribute('data-add-date'));
                    return;
                }
            });
        }
    }

    function cleanupOverlayEvents() {
        overlayHandlers.forEach(function (h) {
            h.el.removeEventListener(h.event, h.fn);
        });
        overlayHandlers = [];
    }

    function closeOverlay() {
        var overlay = document.getElementById('schedule-overlay');
        if (!overlay) return;
        overlay.classList.remove('active');
        setTimeout(function () {
            cleanupOverlayEvents();
            var root = document.getElementById('schedule-overlay-root');
            if (root) root.innerHTML = '';
        }, 320);
    }

    // === 确认弹窗 ===
    function showConfirmDialog(message) {
        return new Promise(function (resolve) {
            var overlay = document.createElement('div');
            overlay.className = 'schedule-edit-overlay active';
            overlay.innerHTML =
                '<div class="schedule-edit-modal">' +
                '<div class="schedule-edit-header">' +
                '<div class="schedule-edit-title">确认</div>' +
                '</div>' +
                '<div class="schedule-edit-body">' +
                '<p style="font-size:14px;color:var(--london-text-primary,#45494D);line-height:1.6;margin:0">' + escapeHtml(message) + '</p>' +
                '</div>' +
                '<div class="schedule-edit-footer">' +
                '<button class="schedule-btn schedule-btn-secondary" id="confirm-cancel">取消</button>' +
                '<button class="schedule-btn schedule-btn-primary" id="confirm-ok">确定</button>' +
                '</div>' +
                '</div>';

            document.body.appendChild(overlay);

            function cleanup(result) {
                if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
                resolve(result);
            }

            overlay.querySelector('#confirm-cancel').addEventListener('click', function () { cleanup(false); });
            overlay.querySelector('#confirm-ok').addEventListener('click', function () { cleanup(true); });
            overlay.addEventListener('click', function (e) { if (e.target === overlay) cleanup(false); });
        });
    }

    // === 生成日程 ===
    async function doGenerate(contactId) {
        var contact = window.currentOpenContact;
        if (!contact || contact.id !== contactId) {
            showToast('请先打开对应联系人');
            return;
        }

        var existingData = readSchedule(contactId);
        if (existingData && existingData.items && existingData.items.length > 0) {
            var confirmed = await showConfirmDialog('重新生成将覆盖当前所有日程，确定继续吗？');
            if (!confirmed) return;
        }

        var btn = document.getElementById('schedule-generate-btn');
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<div class="schedule-loading-spinner" style="width:16px;height:16px;border-width:2px;margin:0"></div> 生成中...';
        }

        try {
            var items = await generateSchedule(contact);
            var data = readSchedule(contactId) || getDefaultData();
            data.items = items;
            data.enabled = true;
            data.generatedAt = Date.now();
            saveSchedule(contactId, data);
            showToast('日程生成完成');
            // re-render 时需要重新创建整个覆盖层来刷新动画状态
            var root = document.getElementById('schedule-overlay-root');
            if (root) root.innerHTML = '';
            renderOverlay(contactId);
        } catch (e) {
            console.error('[Schedule] 生成失败:', e);
            showToast('生成失败: ' + (e.message || '未知错误'));
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = '<svg viewBox="0 0 24 24"><path d="M12 2v4m0 12v4m-7.07-3.93l2.83-2.83m8.48-8.48l2.83-2.83M2 12h4m12 0h4m-3.93 7.07l-2.83-2.83M7.76 7.76L4.93 4.93"/></svg> 重试';
            }
        }
    }

    // === 删除项 ===
    function deleteItem(contactId, itemId) {
        var data = readSchedule(contactId);
        if (!data || !data.items) return;
        data.items = data.items.filter(function (it) { return it.id !== itemId; });
        saveSchedule(contactId, data);

        var card = document.querySelector('[data-item-id="' + itemId + '"]');
        if (card) {
            card.style.transition = 'opacity 0.2s, transform 0.2s';
            card.style.opacity = '0';
            card.style.transform = 'translateX(20px)';
            setTimeout(function () {
                renderOverlay(contactId);
            }, 200);
        } else {
            renderOverlay(contactId);
        }
        showToast('已删除');
    }

    // === 编辑弹窗 ===
    var editHandlers = [];

    function openEditModal(contactId, itemId, addDate) {
        var data = readSchedule(contactId) || getDefaultData();
        var existing = null;
        if (itemId) {
            existing = data.items.find(function (it) { return it.id === itemId; });
        }

        var isNew = !existing;
        var date = isNew ? (addDate || dateStr(new Date())) : existing.date;
        var startTime = isNew ? '' : (existing.startTime || '');
        var endTime = isNew ? '' : (existing.endTime || '');
        var activity = isNew ? '' : (existing.activity || '');

        var overlay = document.createElement('div');
        overlay.className = 'schedule-edit-overlay active';
        overlay.innerHTML =
            '<div class="schedule-edit-modal">' +
            '<div class="schedule-edit-header">' +
            '<div class="schedule-edit-title">' + (isNew ? '添加日程' : '编辑日程') + '</div>' +
            '<button class="schedule-edit-close" id="schedule-edit-close"><svg viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12"/></svg></button>' +
            '</div>' +
            '<div class="schedule-edit-body">' +
            '<div class="schedule-edit-field"><label>日期</label><input class="schedule-edit-input" type="date" id="edit-date" value="' + date + '"></div>' +
            '<div class="schedule-edit-field"><label>开始时间</label><input class="schedule-edit-input" type="time" id="edit-start" value="' + startTime + '"></div>' +
            '<div class="schedule-edit-field"><label>结束时间</label><input class="schedule-edit-input" type="time" id="edit-end" value="' + endTime + '"></div>' +
            '<div class="schedule-edit-field"><label>活动内容</label><textarea class="schedule-edit-textarea" id="edit-activity" placeholder="描述活动内容...">' + escapeHtml(activity) + '</textarea></div>' +
            '</div>' +
            '<div class="schedule-edit-footer">' +
            '<button class="schedule-btn schedule-btn-secondary" id="edit-cancel">取消</button>' +
            '<button class="schedule-btn schedule-btn-primary" id="edit-save">保存</button>' +
            '</div>' +
            '</div>';

        document.body.appendChild(overlay);

        function cleanup() {
            editHandlers.forEach(function (h) { h.el.removeEventListener(h.event, h.fn); });
            editHandlers = [];
            if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
        }

        function addEditHandler(el, event, fn) {
            if (!el) return;
            el.addEventListener(event, fn);
            editHandlers.push({ el: el, event: event, fn: fn });
        }

        addEditHandler(overlay.querySelector('#schedule-edit-close'), 'click', cleanup);
        addEditHandler(overlay.querySelector('#edit-cancel'), 'click', cleanup);

        addEditHandler(overlay.querySelector('#edit-save'), 'click', function () {
            var newDate = document.getElementById('edit-date').value;
            var newStart = document.getElementById('edit-start').value;
            var newEnd = document.getElementById('edit-end').value;
            var newActivity = document.getElementById('edit-activity').value.trim();

            if (!newActivity) {
                showToast('请输入活动内容');
                return;
            }

            var freshData = readSchedule(contactId) || getDefaultData();
            if (!freshData.items) freshData.items = [];

            if (isNew) {
                freshData.items.push({
                    id: 'si_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
                    date: newDate,
                    startTime: newStart,
                    endTime: newEnd,
                    activity: newActivity
                });
            } else {
                var idx = freshData.items.findIndex(function (it) { return it.id === itemId; });
                if (idx >= 0) {
                    freshData.items[idx].date = newDate;
                    freshData.items[idx].startTime = newStart;
                    freshData.items[idx].endTime = newEnd;
                    freshData.items[idx].activity = newActivity;
                }
            }

            saveSchedule(contactId, freshData);
            cleanup();
            renderOverlay(contactId);
            showToast(isNew ? '已添加' : '已保存');
        });

        // 点蒙版关闭
        addEditHandler(overlay, 'click', function (e) {
            if (e.target === overlay) cleanup();
        });
    }

    // === 打开覆盖层 ===
    function openOverlay() {
        var contact = window.currentOpenContact;
        if (!contact) {
            showToast('请先打开一个联系人');
            return;
        }
        renderOverlay(contact.id);
    }

    // === 绑定入口按钮 ===
    function bindEntryButton() {
        document.addEventListener('click', function (e) {
            if (e.target.closest('#schedule-entry-btn')) {
                openOverlay();
            }
        });
    }

    // === 公开接口 ===
    window.ScheduleManager = {
        getScheduleText: function (contactId) {
            return buildPromptText(contactId);
        },
        openOverlay: openOverlay,
        readSchedule: readSchedule
    };

    // 初始化
    bindEntryButton();
    console.log('[Schedule] 近7天日程模块已加载');

})();
