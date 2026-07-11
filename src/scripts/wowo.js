/**
 * ============================================
 * 小窝 (Wowo) - 情侣空间 JavaScript
 * ============================================
 */

(function () {
    'use strict';

    // ============ 数据存储 Key ============
    const WOWO_STORAGE_KEY = 'wowoData'; // IndexedDB store name
    const WOWO_MSG_COUNT_KEY = 'wowo_msg_count'; // 消息计数器，用于AI小声贴触发

    // 缓存当前联系人的小窩数据（避免频繁读取数据库）
    let cachedWowoData = null;
    let cachedContactId = null;

    /**
     * 强制清除缓存（切换联系人或打开小窝时调用）
     */
    function invalidateCache() {
        cachedWowoData = null;
        cachedContactId = null;
        console.log('[Wowo] 缓存已清除');
    }

    // ============ 默认数据结构 ============
    const DEFAULT_WOWO_DATA = {
        anniversaryDate: null,  // 纪念日日期
        cycleStartDate: null,   // 生理期开始日期
        cycleLength: 28,        // 周期长度（天）
        periodLength: 5,        // 经期长度（天）
        journals: [],           // 日记列表
        whispers: [],           // 小声贴列表
        cycleRecords: []        // 生理期记录
    };

    // ============ 100个每日问题池 ============
    const DAILY_QUESTIONS = [
        "如果这周末我们可以去世界上任何一个地方，你想去哪里？",
        "今天有什么让你开心的小事吗？",
        "如果可以拥有一种超能力，你会选什么？",
        "描述一下你理想中的完美约会。",
        "最近有什么歌让你单曲循环？",
        "如果我们一起做饭，你想做什么菜？",
        "今天最想对我说的一句话是什么？",
        "描述一下你现在的心情，用一种颜色。",
        "如果明天是世界末日，今晚你想做什么？",
        "你觉得我身上最可爱的地方是什么？",
        "如果可以回到过去的某一天，你想回到哪天？",
        "你最近在追什么剧或者电影？",
        "如果我们养一只宠物，你想养什么？",
        "你小时候最喜欢的动画片是什么？",
        "描述一下你梦想中的家是什么样子的。",
        "如果可以和任何人共进晚餐，你会选谁？",
        "你最怕什么？",
        "你觉得我们在一起最美好的回忆是什么？",
        "如果明天醒来发现自己变成了我，你会做什么？",
        "你觉得什么是幸福？",
        "最近有什么让你烦恼的事吗？",
        "如果可以学会一项新技能，你想学什么？",
        "你最喜欢的季节是什么？为什么？",
        "描述一下你理想中的周末。",
        "你觉得我们之间最默契的瞬间是什么？",
        "如果可以去任何一个虚构的世界，你想去哪里？",
        "你童年最美好的记忆是什么？",
        "如果只能吃一种食物度过余生，你选什么？",
        "你觉得什么是真正的爱情？",
        "如果可以改变过去的一个决定，你会改变什么？",
        "你最欣赏我哪一点？",
        "如果我们一起开一家店，你想开什么店？",
        "你今天看到的最美的东西是什么？",
        "如果可以瞬间移动到任何地方，你现在想去哪？",
        "你觉得十年后的我们会是什么样子？",
        "你最喜欢的一本书是什么？",
        "如果可以成为任何动物一天，你想成为什么？",
        "你觉得什么样的surprise会让你最开心？",
        "描述一下你第一次见到我的感觉。",
        "你最近学到的一件新事情是什么？",
        "如果可以解决世界上的一个问题，你会选什么？",
        "你觉得我们应该一起尝试什么新事物？",
        "你最喜欢的冰淇淋口味是什么？",
        "如果写一封信给十年后的自己，你会写什么？",
        "你觉得什么是生活中最重要的东西？",
        "如果可以和我一起学习一样东西，你想学什么？",
        "你最喜欢的节日是什么？为什么？",
        "描述一下你心目中完美的早餐。",
        "你觉得我做的最浪漫的事是什么？",
        "如果可以回到任何一个历史时期，你想回到什么时候？",
        "你最近有什么新的小目标吗？",
        "如果可以和我一起旅行三个月，你想去哪些地方？",
        "你觉得什么时候的我最好看？",
        "如果可以拥有任何车，你想要什么车？",
        "你最喜欢的花是什么？",
        "如果可以住在任何城市，你会选择哪里？",
        "你觉得我们的歌是哪首歌？",
        "描述一下你理想中的退休生活。",
        "如果可以改变自己的一个习惯，你会改变什么？",
        "你觉得什么样的晚安最温暖？",
        "如果只能保留手机里的一张照片，你会保留哪张？",
        "你最喜欢什么天气？",
        "如果可以给过去的自己一个建议，你会说什么？",
        "你觉得我们在一起之后最大的变化是什么？",
        "如果可以和我交换身体一天，你会做什么？",
        "你最喜欢的饮料是什么？",
        "描述一下你心目中完美的拥抱。",
        "如果可以拥有任何一幅画，你会选择哪幅？",
        "你觉得什么是浪漫？",
        "如果我们一起种一棵树，你想种什么树？",
        "你最喜欢我穿什么颜色的衣服？",
        "如果可以邀请任何人来参加我们的婚礼，你会邀请谁？",
        "你觉得什么时候最想我？",
        "如果可以许三个愿望，你会许什么？",
        "你最喜欢的零食是什么？",
        "描述一下你喜欢的接吻方式。",
        "如果可以永远停留在某个年龄，你选择几岁？",
        "你觉得什么是最好的道歉方式？",
        "如果我们有了孩子，你想给他/她取什么名字？",
        "你最喜欢我做的哪道菜？",
        "如果可以获得任何学位，你会选择什么专业？",
        "你觉得什么是安全感？",
        "如果可以重新设计我们的第一次约会，你会怎么安排？",
        "你最喜欢的运动是什么？",
        "描述一下你心目中完美的一天。",
        "如果可以成为任何职业一天，你想成为什么？",
        "你觉得我们之间最好笑的回忆是什么？",
        "如果可以拥有一个秘密基地，你想把它放在哪里？",
        "你最喜欢什么香味？",
        "如果可以在任何地方建造梦想之家，你会选择哪里？",
        "你觉得什么是真正的陪伴？",
        "如果我们一起参加一个比赛，你想参加什么比赛？",
        "你最喜欢的社交媒体是什么？",
        "描述一下你喜欢的牵手方式。",
        "如果可以让时间暂停一小时，你想做什么？",
        "你觉得什么是最好的礼物？",
        "如果我们一起创业，你想做什么生意？",
        "你最喜欢我说的哪句话？",
        "如果可以和我一起完成一个挑战，你想完成什么？",
        "描述一下你心目中最温馨的场景。"
    ];

    // ============ 工具函数 ============

    /**
     * 获取指定联系人的小窩数据（异步，从 IndexedDB 读取）
     * @param {string} contactId - 联系人ID
     * @returns {Promise<Object>} 小窩数据
     */
    async function getWowoData(contactId) {
        if (!contactId) return { ...DEFAULT_WOWO_DATA };

        // 使用缓存
        if (cachedContactId === contactId && cachedWowoData) {
            return cachedWowoData;
        }

        try {
            const key = `wowo_${contactId}`;
            const result = await window.dbHelper.loadData(WOWO_STORAGE_KEY, key);
            if (result && result.value) {
                cachedWowoData = { ...DEFAULT_WOWO_DATA, ...result.value };
            } else {
                // 尝试从 localStorage 迁移旧数据
                const oldKey = `wowo_data_${contactId}`;
                const oldData = localStorage.getItem(oldKey);
                if (oldData) {
                    cachedWowoData = { ...DEFAULT_WOWO_DATA, ...JSON.parse(oldData) };
                    // 迁移到新存储
                    await saveWowoData(contactId, cachedWowoData);
                    localStorage.removeItem(oldKey); // 清理旧数据
                    console.log('[Wowo] 已从 localStorage 迁移数据到 IndexedDB');
                } else {
                    cachedWowoData = { ...DEFAULT_WOWO_DATA };
                }
            }
            cachedContactId = contactId;
            return cachedWowoData;
        } catch (e) {
            console.error('[Wowo] 读取数据失败:', e);
            return { ...DEFAULT_WOWO_DATA };
        }
    }

    /**
     * 保存小窩数据（异步，存入 IndexedDB）
     * @param {string} contactId - 联系人ID
     * @param {Object} data - 要保存的数据
     */
    async function saveWowoData(contactId, data) {
        if (!contactId) return;

        try {
            const key = `wowo_${contactId}`;
            await window.dbHelper.saveData(WOWO_STORAGE_KEY, key, data);
            // 更新缓存
            cachedWowoData = data;
            cachedContactId = contactId;
        } catch (e) {
            console.error('[Wowo] 保存数据失败:', e);
        }
    }

    /**
     * 同步获取缓存的小窩数据（用于非异步场景）
     */
    function getWowoDataSync(contactId) {
        if (cachedContactId === contactId && cachedWowoData) {
            return cachedWowoData;
        }
        return { ...DEFAULT_WOWO_DATA };
    }

    /**
     * 计算两个日期之间的天数差
     */
    function daysBetween(startDate, endDate) {
        const oneDay = 24 * 60 * 60 * 1000;
        return Math.floor((endDate - startDate) / oneDay);
    }

    /**
     * 格式化日期
     */
    function formatDate(dateStr) {
        const date = new Date(dateStr);
        return `${date.getMonth() + 1}月${date.getDate()}日`;
    }

    /**
     * 获取今日的问题（基于日期确定，确保每天同一个问题）
     */
    function getTodayQuestion() {
        const today = new Date();
        const year = today.getFullYear();
        const dayOfYear = Math.floor((today - new Date(year, 0, 0)) / (24 * 60 * 60 * 1000));
        return DAILY_QUESTIONS[dayOfYear % DAILY_QUESTIONS.length];
    }

    /**
     * 获取今日日期字符串 (YYYY-MM-DD)
     */
    function getTodayDateStr() {
        return new Date().toISOString().split('T')[0];
    }

    /**
     * 获取纪念日提醒信息（供AI参考）
     * @param {Object} data - 小窝数据
     * @returns {string} AI提示文本，如果没有特殊日子则返回''
     */
    function getAnniversaryReminder(data) {
        if (!data.anniversaryDate) return '';

        const startDate = new Date(data.anniversaryDate);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        startDate.setHours(0, 0, 0, 0);

        const days = daysBetween(startDate, today) + 1;

        // 特殊日子：100天、200天、365天、500天、730天等
        const milestones = [
            { days: 100, label: '第100天' },
            { days: 200, label: '第200天' },
            { days: 365, label: '一周年' },
            { days: 500, label: '第500天' },
            { days: 730, label: '两周年' },
            { days: 1000, label: '第1000天' },
            { days: 1095, label: '三周年' }
        ];

        // 检查是否今天是特殊日子
        const todayMilestone = milestones.find(m => m.days === days);
        if (todayMilestone) {
            return `[系统提示：今天是你们在一起的${todayMilestone.label}！这是一个值得庆祝的特殊日子。]`;
        }

        // 检查即将到来的特殊日子（一周内）
        for (const milestone of milestones) {
            const daysUntil = milestone.days - days;
            if (daysUntil > 0 && daysUntil <= 7) {
                if (daysUntil === 7) {
                    return `[系统提示：一周后(${milestone.days}天)就是你们在一起的${milestone.label}了！]`;
                } else if (daysUntil === 3) {
                    return `[系统提示：还有3天就是你们在一起的${milestone.label}了！]`;
                } else if (daysUntil === 1) {
                    return `[系统提示：明天就是你们在一起的${milestone.label}了！]`;
                }
            }
        }

        return '';
    }

    /**
     * 获取生理期提醒信息（供AI参考）
     * @param {Object} data - 小窝数据
     * @returns {string} AI提示文本
     */
    function getPeriodReminder(data) {
        if (!data.cycleStartDate) return '';

        const startDate = new Date(data.cycleStartDate);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        startDate.setHours(0, 0, 0, 0);

        const daysSinceStart = daysBetween(startDate, today);
        const cycleDay = (daysSinceStart % data.cycleLength) + 1;
        const periodLength = data.periodLength || 5;
        const cycleLength = data.cycleLength || 28;
        const daysUntilNextPeriod = cycleLength - cycleDay + 1;

        // 当前正在经期中
        if (cycleDay <= periodLength) {
            return `[系统提示：用户正处于生理期第${cycleDay}天，请给予温暖的关怀和理解。]`;
        }

        // 提前7天提醒
        if (daysUntilNextPeriod === 7) {
            return `[系统提示：用户的生理期预计在一周后到来，可以适当提醒她注意身体。]`;
        }

        // 提前3天提醒
        if (daysUntilNextPeriod === 3) {
            return `[系统提示：用户的生理期预计在3天后到来，可以关心她是否做好准备。]`;
        }

        // 提前1天提醒
        if (daysUntilNextPeriod === 1) {
            return `[系统提示：用户的生理期预计明天到来，可以提醒她注意休息和多喝热水。]`;
        }

        return '';
    }

    // ============ 页面切换 ============

    function goToWowoPage(pageId, tabElement) {
        document.querySelectorAll('.wowo-page').forEach(p => p.classList.remove('active'));
        const targetPage = document.getElementById(pageId);
        if (targetPage) {
            targetPage.classList.add('active');
        }

        document.querySelectorAll('.wowo-tab-item').forEach(t => t.classList.remove('active'));
        if (tabElement) {
            tabElement.classList.add('active');
        }

        const fab = document.getElementById('wowo-whisper-fab');
        if (fab) {
            fab.style.display = (pageId === 'wowo-page-whisper') ? 'flex' : 'none';
        }

        // 如果是日记页面，刷新历史记录
        if (pageId === 'wowo-page-journal') {
            renderJournalHistory();
        }
    }

    // ============ 弹窗控制 ============

    function openWowoSheet(sheetId) {
        const sheet = document.getElementById(sheetId);
        if (sheet) {
            sheet.classList.add('show');
        }
    }

    function closeWowoSheet(maskElement) {
        if (maskElement) {
            maskElement.classList.remove('show');
        }
    }

    // ============ 纪念日功能 ============

    async function updateAnniversaryDisplay() {
        const contactId = getCurrentContactId();
        if (!contactId) return;

        const data = await getWowoData(contactId);
        const daysElement = document.getElementById('wowo-days-count');

        if (!daysElement) return;

        if (data.anniversaryDate) {
            const startDate = new Date(data.anniversaryDate);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            startDate.setHours(0, 0, 0, 0);

            const days = daysBetween(startDate, today) + 1;
            daysElement.textContent = days > 0 ? days : 1;
        } else {
            daysElement.textContent = '?';
        }
    }

    async function saveAnniversary() {
        const contactId = getCurrentContactId();
        if (!contactId) return;

        const input = document.getElementById('wowo-anniversary-date-input');
        if (input && input.value) {
            const data = await getWowoData(contactId);
            data.anniversaryDate = input.value;
            await saveWowoData(contactId, data);
            await updateAnniversaryDisplay();
            closeWowoSheet(document.getElementById('wowo-anniversary-sheet'));
        }
    }

    // ============ 生理期功能 ============

    async function updateCycleDisplay() {
        const contactId = getCurrentContactId();
        if (!contactId) return;

        const data = await getWowoData(contactId);
        const dayElement = document.getElementById('wowo-cycle-day');
        const statusElement = document.getElementById('wowo-cycle-status');
        const predictionContainer = document.getElementById('wowo-cycle-prediction');

        if (!dayElement || !statusElement) return;

        if (data.cycleStartDate) {
            const startDate = new Date(data.cycleStartDate);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            startDate.setHours(0, 0, 0, 0);

            const daysSinceStart = daysBetween(startDate, today);
            const cycleDay = (daysSinceStart % data.cycleLength) + 1;
            const periodLength = data.periodLength || 5;
            const cycleLength = data.cycleLength || 28;

            dayElement.textContent = `D${cycleDay}`;

            // 判断当前状态
            if (cycleDay <= periodLength) {
                statusElement.textContent = '经期中 · 请呵护';
            } else if (cycleDay <= periodLength + 7) {
                statusElement.textContent = '卵泡期 · 状态好';
            } else if (cycleDay <= periodLength + 14) {
                statusElement.textContent = '排卵期 · 注意身体';
            } else {
                statusElement.textContent = '黄体期 · 可能情绪波动';
            }

            // 计算预测日期
            if (predictionContainer) {
                const daysUntilNextPeriod = cycleLength - cycleDay + 1;
                const nextPeriodDate = new Date(today);
                nextPeriodDate.setDate(nextPeriodDate.getDate() + daysUntilNextPeriod);

                // 排卵期预测（一般在下次月经前14天）
                const ovulationDay = cycleLength - 14;
                let daysUntilOvulation = ovulationDay - cycleDay;
                if (daysUntilOvulation < 0) daysUntilOvulation += cycleLength;
                const ovulationDate = new Date(today);
                ovulationDate.setDate(ovulationDate.getDate() + daysUntilOvulation);

                predictionContainer.innerHTML = `
                    <div class="wowo-cycle-prediction-title">周期预测</div>
                    <div class="wowo-cycle-prediction-row">
                        <span class="wowo-cycle-prediction-label">下次经期</span>
                        <span class="wowo-cycle-prediction-value">${formatDate(nextPeriodDate)} (${daysUntilNextPeriod}天后)</span>
                    </div>
                    <div class="wowo-cycle-prediction-row">
                        <span class="wowo-cycle-prediction-label">排卵期</span>
                        <span class="wowo-cycle-prediction-value">${formatDate(ovulationDate)}</span>
                    </div>
                    <div class="wowo-cycle-prediction-row">
                        <span class="wowo-cycle-prediction-label">周期长度</span>
                        <span class="wowo-cycle-prediction-value">${cycleLength}天</span>
                    </div>
                `;
                predictionContainer.style.display = 'block';
            }
        } else {
            dayElement.textContent = '--';
            statusElement.textContent = '点击右上角设置开始日期';
            if (predictionContainer) {
                predictionContainer.style.display = 'none';
            }
        }
    }

    async function setCycleStartDate(dateValue) {
        const contactId = getCurrentContactId();
        if (!contactId || !dateValue) return;

        const data = await getWowoData(contactId);
        data.cycleStartDate = dateValue;
        await saveWowoData(contactId, data);
        await updateCycleDisplay();
    }

    async function saveCycleFeeling() {
        const contactId = getCurrentContactId();
        if (!contactId) return;

        const data = await getWowoData(contactId);
        const activePills = document.querySelectorAll('#wowo-cycle-sheet .wowo-pill.active');
        const feelings = Array.from(activePills).map(p => p.textContent.trim());
        const noteInput = document.getElementById('wowo-cycle-note-input');
        const note = noteInput ? noteInput.value.trim() : '';

        // 允许只写备注，不选 Tag
        if (feelings.length > 0 || note) {
            data.cycleRecords = data.cycleRecords || [];
            data.cycleRecords.push({
                date: getTodayDateStr(),
                feelings: feelings,
                note: note // 保存备注
            });
            await saveWowoData(contactId, data);

            // --- Wowo Prompt Injection ---
            const feelingsStr = feelings.join(', ');
            const noteStr = note ? `，备注内容：“${note}”` : '';
            // 存入 localStorage，供 main.js 中的 callAI 读取
            // 格式：[系统提示: 用户刚刚记录了生理期感受: [腰酸, 痛感 Lv.Max]...]
            const injectionText = `[系统提示：用户刚刚在“小窝”组件中记录了今天的生理期感受。标签包括：[${feelingsStr}]${noteStr}。请根据这些信息，在接下来的回复中给予用户温暖的关心、安抚或建议。]`;
            localStorage.setItem('wowo_pending_prompt', injectionText);
            // -----------------------------

            // 显示成功反馈
            const btn = document.getElementById('wowo-save-feeling-btn');
            if (btn) {
                const originalText = btn.textContent;
                btn.textContent = '已保存';
                btn.disabled = true;
                setTimeout(() => {
                    btn.textContent = originalText;
                    btn.disabled = false;
                    closeWowoSheet(document.getElementById('wowo-cycle-sheet'));
                    // 清空输入
                    if (noteInput) noteInput.value = '';
                    activePills.forEach(p => p.classList.remove('active'));
                }, 800);
            }
        } else {
            // 没有选择任何感受
            alert('请选择感受或输入备注~');
        }
    }

    /* 新增：渲染经期历史 */
    async function renderCycleHistory() {
        const contactId = getCurrentContactId();
        if (!contactId) return;

        const data = await getWowoData(contactId);
        const container = document.getElementById('wowo-cycle-history-list');
        if (!container) return;

        const records = (data.cycleRecords || []).slice().reverse(); // 倒序

        if (records.length === 0) {
            container.innerHTML = `<div style="text-align:center;color:#999;padding:40px 0;">暂时没有记录哦~</div>`;
            return;
        }

        container.innerHTML = records.map(record => {
            // 兼容旧数据 date 格式（有些可能是 ISO，有些是 YYYY-MM-DD）
            let dateStr = record.date;
            try {
                const d = new Date(record.date);
                if (!isNaN(d.getTime())) {
                    dateStr = `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
                }
            } catch (e) { }

            const tagsHtml = (record.feelings || []).map(t =>
                `<span style="display:inline-block; font-size:12px; padding:2px 8px; margin-right:4px; margin-bottom:4px; background:#fff; border:1px solid #eee; border-radius:10px; color:#666;">${t}</span>`
            ).join('');

            const noteHtml = record.note ? `<div style="margin-top:6px; color:#444; font-size:13px; background:#f5f5f5; padding:8px; border-radius:8px;">${record.note}</div>` : '';

            return `
                <div style="background:#fff; border-radius:12px; padding:15px; margin-bottom:12px; box-shadow: 0 1px 3px rgba(0,0,0,0.03);">
                    <div style="font-size:12px; color:#999; margin-bottom:8px;">${dateStr}</div>
                    <div style="margin-bottom:${record.note ? '8' : '0'}px;">${tagsHtml || '<span style="color:#ccc;font-size:12px;">无标签</span>'}</div>
                    ${noteHtml}
                </div>
            `;
        }).join('');
    }

    // ============ 日记功能 ============

    async function initJournalPage() {
        const contactId = getCurrentContactId();
        if (!contactId) return;

        const questionElement = document.getElementById('wowo-daily-question');
        const submitBtn = document.getElementById('wowo-submit-journal-btn');
        const textArea = document.getElementById('wowo-journal-textarea');
        const journalCard = document.querySelector('.wowo-journal-card');

        if (questionElement) {
            questionElement.textContent = `Q: ${getTodayQuestion()}`;
        }

        // 检查今天是否已打卡
        const data = await getWowoData(contactId);
        const todayStr = getTodayDateStr();
        const todayJournal = data.journals.find(j => j.date && j.date.startsWith(todayStr));

        if (todayJournal) {
            // 已打卡，隐藏输入区域
            if (journalCard) {
                journalCard.innerHTML = `
                    <div class="wowo-journal-done-hint">
                        今天已经打卡啦！<br>
                        明天再来交换新的卡签吧~
                    </div>
                `;
            }
            if (submitBtn) {
                submitBtn.style.display = 'none';
            }
        } else {
            // 未打卡，显示输入区域
            if (submitBtn) {
                submitBtn.style.display = 'flex';
                submitBtn.disabled = false;
                submitBtn.classList.remove('loading');
                submitBtn.innerHTML = '交换卡签';
            }
        }

        // 渲染历史记录
        await renderJournalHistory();
    }

    async function renderJournalHistory() {
        const contactId = getCurrentContactId();
        if (!contactId) return;

        const data = await getWowoData(contactId);
        const container = document.getElementById('wowo-journal-history-scroll');
        if (!container) return;

        // 倒序显示，最新的在前
        const journals = (data.journals || []).slice().reverse();

        if (journals.length === 0) {
            container.innerHTML = `<div style="color: #999; font-size: 12px; padding: 10px;">还没有打卡记录~</div>`;
            return;
        }

        container.innerHTML = journals.map((journal, index) => {
            const date = new Date(journal.date);
            const dateStr = `${date.getMonth() + 1}/${date.getDate()}`;
            // 显示问题而非回答
            const questionPreview = journal.question ? journal.question.replace('Q: ', '').substring(0, 25) + (journal.question.length > 28 ? '...' : '') : '...';
            const tapeColors = ['rgba(224,187,228,0.6)', 'rgba(226,240,203,0.7)', 'rgba(255,183,178,0.7)'];
            const tapeColor = tapeColors[index % 3];

            return `
                <div class="wowo-journal-history-card" data-real-index="${data.journals.length - 1 - index}">
                    <div class="wowo-tape" style="background-color: ${tapeColor}"></div>
                    <div class="wowo-journal-history-date">${dateStr}</div>
                    <div class="wowo-journal-history-preview">${questionPreview}</div>
                </div>
            `;
        }).join('');
    }

    async function showJournalDetail(index) {
        const contactId = getCurrentContactId();
        if (!contactId) return;

        const data = await getWowoData(contactId);
        const journal = data.journals[index];
        if (!journal) return;

        const detailSheet = document.getElementById('wowo-journal-detail-sheet');
        const contentDiv = document.getElementById('wowo-journal-detail-content');

        if (detailSheet && contentDiv) {
            const date = new Date(journal.date);
            const dateStr = `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;

            let aiResponseHtml = '';
            if (journal.aiResponse) {
                aiResponseHtml = `
                    <div class="wowo-journal-detail-ai">
                        <div class="wowo-journal-detail-ai-label">TA的回复</div>
                        <div class="wowo-journal-detail-ai-content">${journal.aiResponse}</div>
                    </div>
                `;
            }

            contentDiv.innerHTML = `
                <div style="font-size: 12px; color: #999; margin-bottom: 10px;">${dateStr}</div>
                <div class="wowo-journal-detail">
                    <div class="wowo-journal-detail-question">${journal.question}</div>
                    <div class="wowo-journal-detail-answer">${journal.answer}</div>
                </div>
                ${aiResponseHtml}
            `;
            openWowoSheet('wowo-journal-detail-sheet');
        }
    }

    /**
     * 提交日记并调用 AI
     */
    async function submitJournal() {
        const contactId = getCurrentContactId();
        if (!contactId) return;

        const textArea = document.getElementById('wowo-journal-textarea');
        const selectedMood = document.querySelector('.wowo-mood-opt.selected');
        const submitBtn = document.getElementById('wowo-submit-journal-btn');

        if (!textArea || !textArea.value.trim()) {
            alert('请先写下你的想法~');
            return;
        }

        // 检查今天是否已打卡
        const data = await getWowoData(contactId);
        const todayStr = getTodayDateStr();
        if (data.journals.some(j => j.date && j.date.startsWith(todayStr))) {
            alert('今天已经打卡过啦！');
            return;
        }

        // 显示加载状态
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.classList.add('loading');
            submitBtn.innerHTML = '<div class="wowo-spinner"></div> 等待TA回复...';
        }

        const question = getTodayQuestion();
        const userAnswer = textArea.value.trim();
        const mood = selectedMood ? selectedMood.dataset.mood : 'neutral';

        try {
            // 调用 AI 获取回复
            const aiResponse = await getAIJournalResponse(question, userAnswer, mood);

            // 保存日记
            const journalEntry = {
                date: new Date().toISOString(),
                question: question,
                answer: userAnswer,
                mood: mood,
                aiResponse: aiResponse
            };

            data.journals.push(journalEntry);
            await saveWowoData(contactId, data);

            // 清空输入
            textArea.value = '';
            document.querySelectorAll('.wowo-mood-opt').forEach(m => m.classList.remove('selected'));

            // 重新初始化日记页面
            await initJournalPage();

        } catch (error) {
            console.error('[Wowo] 日记提交失败:', error);
            alert('提交失败，请重试~');
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.classList.remove('loading');
                submitBtn.innerHTML = '交换日记';
            }
        }
    }

    /**
     * 调用 AI 获取日记回复
     */
    async function getAIJournalResponse(question, userAnswer, mood) {
        const contact = window.currentOpenContact;
        if (!contact) throw new Error('没有打开的联系人');

        // 获取 API 配置
        const settingsData = await window.dbHelper.loadData('settingsStore', 'apiSettings');
        if (!settingsData || !settingsData.value || !settingsData.value.url) {
            throw new Error('API 未配置');
        }

        // 获取最近10条聊天记录
        const chatHistory = contact.history ? contact.history.slice(-10) : [];
        const recentChatHistory = chatHistory.map(msg => {
            if (msg.sender === 'ai') {
                return `${contact.ai?.name || 'AI'}: ${msg.text || msg.transcript || '[媒体消息]'}`;
            } else if (msg.sender === 'user') {
                return `${contact.user?.name || '用户'}: ${msg.text || msg.transcript || '[媒体消息]'}`;
            }
            return '';
        }).filter(Boolean).join('\n');

        // 获取世界书内容
        let worldBookContent = '';
        try {
            const worldbookData = await window.dbHelper.loadData('worldBooks', 'allWorldBooks');
            const allBooks = (worldbookData && Array.isArray(worldbookData.value)) ? worldbookData.value : [];

            if (contact.linkedWorldBookIds && contact.linkedWorldBookIds.length > 0) {
                const linkedBooks = allBooks.filter(b => contact.linkedWorldBookIds.includes(b.id));
                worldBookContent = linkedBooks.map(b => b.content).join('\n\n');
            }
        } catch (e) {
            console.error('[Wowo] 加载世界书失败:', e);
        }

        // 构建 System Prompt
        const systemPrompt = `你正在参与一个情侣之间的"交换日记"互动。

【你的角色设定】
姓名：${contact.ai?.name || 'AI'}
人设：${contact.ai?.persona || '一个温柔体贴的伴侣'}

【用户设定】
姓名：${contact.user?.name || '用户'}
人设：${contact.user?.persona || ''}

${worldBookContent ? '【世界观/背景】\n' + worldBookContent + '\n' : ''}

【最近的聊天记录】
${recentChatHistory || '暂无'}

---

【今日交换日记】
问题：${question}
用户的回答：${userAnswer}
用户当前心情：${mood === 'happy' ? '开心' : mood === 'calm' ? '平静' : mood === 'tired' ? '疲惫' : mood === 'angry' ? '烦躁' : '一般'}

---

请以你的人设身份，用温柔、真诚的语气回复用户的卡签。
回复要求：
1. 保持你的角色性格
2. **首先回答这个问题**：分享你自己对这个问题的真实想法和答案
3. 然后对用户的回答表达关心或共鸣
4. 长度控制在80-200字
5. 语气要自然、亲密，像真正的恋人在交换卡签
6. 格式建议：先写你的回答，再写对用户回答的回应

直接输出回复内容，不需要任何前缀或标记。`;

        // 使用 universalApiRequest 适配器
        const messages = [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: '请回复我的日记。' }
        ];
        const responseData = await window.universalApiRequest(settingsData.value, messages, { customTemperature: 0.9 });
        return responseData.choices[0].message.content.trim();
    }

    // ============ 小声贴功能 ============

    async function renderWhispers() {
        const contactId = getCurrentContactId();
        if (!contactId) return;

        const data = await getWowoData(contactId);
        const wall = document.getElementById('wowo-note-wall');

        if (!wall) return;

        wall.innerHTML = '';

        // 合并用户贴纸和AI贴纸
        const allWhispers = (data.whispers || []).slice().reverse();

        if (allWhispers.length === 0) {
            wall.innerHTML = `
                <div class="wowo-sticky-note">
                    <div class="wowo-tape"></div>
                    点击右下角 + 写下第一张小声贴吧~
                    <div class="wowo-sticky-note-author">系统</div>
                </div>
            `;
            return;
        }

        allWhispers.forEach((whisper, index) => {
            const note = document.createElement('div');
            note.className = 'wowo-sticky-note';
            note.style.transform = `rotate(${Math.random() * 4 - 2}deg)`;

            const authorClass = whisper.isAI ? 'wowo-sticky-note-author is-ai' : 'wowo-sticky-note-author';
            const authorName = whisper.author || (whisper.isAI ? (window.currentOpenContact?.ai?.name || 'TA') : '我');

            note.innerHTML = `
                <div class="wowo-tape"></div>
                ${whisper.text}
                <div class="${authorClass}">— ${authorName}</div>
            `;
            wall.appendChild(note);
        });
    }

    async function addWhisper() {
        const contactId = getCurrentContactId();
        if (!contactId) return;

        const input = document.getElementById('wowo-note-input');
        if (!input || !input.value.trim()) return;

        const data = await getWowoData(contactId);
        data.whispers = data.whispers || [];
        data.whispers.push({
            text: input.value.trim(),
            date: new Date().toISOString(),
            isAI: false,
            author: window.currentOpenContact?.user?.name || '我'
        });
        await saveWowoData(contactId, data);

        input.value = '';
        closeWowoSheet(document.getElementById('wowo-note-sheet'));
        await renderWhispers();
    }

    /**
     * AI 自动生成小声贴（每100条消息触发一次）
     */
    async function checkAndGenerateAIWhisper(contactId) {
        if (!contactId) return;

        // 读取消息计数器
        const countKey = `${WOWO_MSG_COUNT_KEY}_${contactId}`;
        let msgCount = parseInt(localStorage.getItem(countKey) || '0');
        msgCount++;
        localStorage.setItem(countKey, msgCount.toString());

        // 每100条消息触发
        if (msgCount % 100 !== 0) return;

        console.log('[Wowo] 达到100条消息，生成AI小声贴...');

        try {
            await generateAIWhisper(contactId);
        } catch (e) {
            console.error('[Wowo] 生成AI小声贴失败:', e);
        }
    }

    async function generateAIWhisper(contactId) {
        const contact = window.currentOpenContact;
        if (!contact || contact.id !== contactId) return;

        // 获取 API 配置
        const settingsData = await window.dbHelper.loadData('settingsStore', 'apiSettings');
        if (!settingsData || !settingsData.value || !settingsData.value.url) return;

        // 获取最近100条聊天记录
        const chatHistory = contact.history ? contact.history.slice(-100) : [];
        const recentChat = chatHistory.map(msg => {
            const sender = msg.sender === 'ai' ? contact.ai?.name : contact.user?.name;
            return `${sender}: ${msg.text || msg.transcript || '[媒体消息]'}`;
        }).filter(Boolean).join('\n');

        const systemPrompt = `你是${contact.ai?.name || 'AI'}，人设：${contact.ai?.persona || '一个温柔的伴侣'}

你们有一个专属的"小窝"空间，里面有一面便签墙，可以贴一些想对对方说的话、日常的小心情、偷偷的告白等。

【最近的聊天记录】
${recentChat}

---

请根据最近的聊天内容，写1-2条小声贴。这些是你想悄悄告诉TA、或者记录下来的小心情。

要求：
1. 每条小声贴15-40字
2. 内容要温馨、真实、有感情
3. 可以是：感谢、思念、日常分享、小告白、对聊天内容的回味等
4. 用你的人设语气

输出格式（每条一行，用|||分隔多条）：
小声贴内容1|||小声贴内容2`;

        // 使用 universalApiRequest 适配器
        const messages = [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: '请写小声贴。' }
        ];
        const responseData = await window.universalApiRequest(settingsData.value, messages, { customTemperature: 0.9 });
        if (!responseData.choices?.[0]?.message?.content) return;

        const content = responseData.choices[0].message.content.trim();

        // 解析多条小声贴
        const whispers = content.split('|||').map(w => w.trim()).filter(w => w);

        // 保存
        const data = await getWowoData(contactId);
        data.whispers = data.whispers || [];

        whispers.forEach(text => {
            data.whispers.push({
                text: text,
                date: new Date().toISOString(),
                isAI: true,
                author: contact.ai?.name || 'TA'
            });
        });

        await saveWowoData(contactId, data);
        console.log('[Wowo] AI小声贴已生成:', whispers.length, '条');
    }

    // ============ 辅助函数 ============

    function getCurrentContactId() {
        if (window.currentOpenContact && window.currentOpenContact.id) {
            return window.currentOpenContact.id;
        }
        return null;
    }

    // ============ 主界面控制 ============

    async function openWowoScreen() {
        const screen = document.getElementById('wowo-screen');
        if (screen) {
            screen.classList.add('active');

            // 【关键】每次打开小窝时强制清除缓存，确保加载当前角色的数据
            invalidateCache();

            const contactId = getCurrentContactId();
            console.log('[Wowo] 打开小窝，当前角色ID:', contactId);

            if (!contactId) {
                console.warn('[Wowo] 未找到当前角色，可能导致数据显示异常');
            }

            // 异步加载数据（此时会从数据库重新读取当前角色的数据）
            await updateAnniversaryDisplay();
            await updateCycleDisplay();
            await initJournalPage();
            await renderWhispers();

            goToWowoPage('wowo-page-love', document.querySelector('.wowo-tab-item'));
        }
    }

    function closeWowoScreen() {
        const screen = document.getElementById('wowo-screen');
        if (screen) {
            screen.classList.remove('active');
        }
        // 关闭时清除缓存，确保下次打开时加载正确角色的数据
        invalidateCache();
    }

    // ============ 初始化事件绑定 ============

    function initWowoEvents() {
        // 返回按钮
        const backBtn = document.getElementById('wowo-back-btn');
        if (backBtn) {
            backBtn.addEventListener('click', closeWowoScreen);
        }

        // Tab 切换
        document.querySelectorAll('.wowo-tab-item').forEach(tab => {
            tab.addEventListener('click', function () {
                const pageId = this.dataset.page;
                if (pageId) {
                    goToWowoPage(pageId, this);
                }
            });
        });

        // 纪念日编辑
        const anniversaryHint = document.getElementById('wowo-anniversary-hint');
        if (anniversaryHint) {
            anniversaryHint.addEventListener('click', () => openWowoSheet('wowo-anniversary-sheet'));
        }

        // 纪念日保存按钮
        const saveAnniversaryBtn = document.getElementById('wowo-save-anniversary-btn');
        if (saveAnniversaryBtn) {
            saveAnniversaryBtn.addEventListener('click', saveAnniversary);
        }

        // 生理期日期选择器
        const cycleDateInput = document.getElementById('wowo-cycle-date-input');
        if (cycleDateInput) {
            cycleDateInput.addEventListener('change', function () {
                setCycleStartDate(this.value);
            });
        }

        // 经期历史按钮
        const historyBtn = document.getElementById('wowo-cycle-history-entry');
        if (historyBtn) {
            historyBtn.addEventListener('click', async () => {
                await renderCycleHistory();
                openWowoSheet('wowo-cycle-history-sheet');
            });
        }

        // 记录感受按钮
        const recordFeelingBtn = document.getElementById('wowo-record-feeling-btn');
        if (recordFeelingBtn) {
            recordFeelingBtn.addEventListener('click', () => openWowoSheet('wowo-cycle-sheet'));
        }

        // 感受保存按钮
        const saveFeelingBtn = document.getElementById('wowo-save-feeling-btn');
        if (saveFeelingBtn) {
            saveFeelingBtn.addEventListener('click', saveCycleFeeling);
        }

        // 日记卡片历史点击 (使用事件委托)
        const journalHistoryContainer = document.getElementById('wowo-journal-history-scroll');
        if (journalHistoryContainer) {
            journalHistoryContainer.addEventListener('click', (e) => {
                const card = e.target.closest('.wowo-journal-history-card');
                if (card) {
                    const index = card.dataset.realIndex;
                    if (index !== undefined) {
                        showJournalDetail(parseInt(index));
                    }
                }
            });
        }


        // 心情选择
        document.querySelectorAll('.wowo-mood-opt').forEach(opt => {
            opt.addEventListener('click', function () {
                document.querySelectorAll('.wowo-mood-opt').forEach(m => m.classList.remove('selected'));
                this.classList.add('selected');
            });
        });

        // 交换日记按钮
        const submitJournalBtn = document.getElementById('wowo-submit-journal-btn');
        if (submitJournalBtn) {
            submitJournalBtn.addEventListener('click', submitJournal);
        }

        // 小声贴FAB
        const whisperFab = document.getElementById('wowo-whisper-fab');
        if (whisperFab) {
            whisperFab.addEventListener('click', () => openWowoSheet('wowo-note-sheet'));
        }

        // 添加小声贴按钮
        const addWhisperBtn = document.getElementById('wowo-add-whisper-btn');
        if (addWhisperBtn) {
            addWhisperBtn.addEventListener('click', addWhisper);
        }

        // Pill 标签切换
        document.querySelectorAll('.wowo-pill').forEach(pill => {
            pill.addEventListener('click', function () {
                this.classList.toggle('active');
            });
        });

        // 弹窗遮罩点击关闭
        document.querySelectorAll('.wowo-mask').forEach(mask => {
            mask.addEventListener('click', function (e) {
                if (e.target === this) {
                    closeWowoSheet(this);
                }
            });
        });
    }

    // ============ 暴露全局接口 ============
    window.openWowoScreen = openWowoScreen;
    window.closeWowoScreen = closeWowoScreen;

    // 模块接口（供外部调用）
    window.WowoModule = {
        checkAndGenerateAIWhisper: checkAndGenerateAIWhisper,
        showJournalDetail: showJournalDetail,
        getAnniversaryReminder: getAnniversaryReminder,
        getPeriodReminder: getPeriodReminder,
        getWowoData: getWowoData,
        getCurrentContactId: getCurrentContactId
    };

    // ============ DOM Ready 初始化 ============
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initWowoEvents);
    } else {
        initWowoEvents();
    }

})();
