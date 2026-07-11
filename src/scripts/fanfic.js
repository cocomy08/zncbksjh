/**
 * ============================================
 * 同人创作 (Fanfic) — 专业小说创作模块
 * 按联系人隔离 / 风格 chips / 阅读编辑双模式 / 续写方向 / 重新生成
 * ============================================
 */
(function () {
    'use strict';

    // 防止脚本被重复加载导致的事件监听器多次绑定
    if (window.__FANFIC_LOADED__) {
        console.warn('[Fanfic] 检测到重复加载，已跳过初始化');
        return;
    }
    window.__FANFIC_LOADED__ = true;

    const STORAGE_PREFIX = 'fanfic_novels_';

    /* ---------- 状态 ---------- */
    let activeTab = 'generate';
    let currentActiveId = null;
    let novels = [];
    // 阅读视图的"来路"：'generate' | 'bookshelf'。返回按钮按此回退。
    let enteredFromTab = 'generate';

    let includeWorldBook = false;
    let contextLength = 5;

    // 创作选项
    let selectedStyle = '';      // chip 选中的风格（也作为 detail 的提示）
    let selectedLength = 'mid';  // 'short' | 'mid' | 'long'

    // 续写选项
    let selectedDirection = 'advance';
    let lastContinueState = null; // {snapshot, hint, direction} 用于「重新生成」

    // 草稿
    let draftStyle = '';
    let draftDetail = '';
    let draftContinue = '';

    // 视图状态
    let readerMode = 'read';    // 'read' | 'edit'
    let isGenerating = false;
    let isContinuing = false;

    /* ---------- 常量：选项 ---------- */
    const STYLE_PRESETS = [
        { id: 'gufeng', label: '古风仙侠', hint: '古风仙侠题材，半文半白，意境悠远' },
        { id: 'school', label: '校园青春', hint: '校园青春题材，明亮真挚，细腻克制' },
        { id: 'urban',  label: '都市言情', hint: '现代都市题材，节奏自然，情感真实' },
        { id: 'fantasy',label: '奇幻冒险', hint: '奇幻冒险题材，世界观瑰丽，节奏起伏' },
        { id: 'cyber',  label: '赛博朋克', hint: '赛博朋克题材，霓虹冷峻，科技与人性交织' },
        { id: 'thrill', label: '悬疑惊悚', hint: '悬疑惊悚题材，节奏紧绷，氛围压抑' },
        { id: 'angst',  label: '虐心揪心', hint: '虐心向，情感张力强烈，留白与克制并存' },
        { id: 'fluff',  label: '甜宠日常', hint: '甜宠日常向，氛围治愈，互动自然有趣' },
    ];

    const LENGTH_PRESETS = [
        { id: 'short', label: '短篇', words: '600-900',  prompt: '600-900 字' },
        { id: 'mid',   label: '标准', words: '1000-1300', prompt: '1000-1300 字' },
        { id: 'long',  label: '长篇', words: '1300-1600', prompt: '1300-1600 字' },
    ];

    const DIRECTION_PRESETS = [
        { id: 'advance', label: '推进剧情', hint: '推动核心情节自然发展' },
        { id: 'deepen',  label: '加深氛围', hint: '放慢节奏，强化场景与情绪氛围' },
        { id: 'twist',   label: '制造转折', hint: '引入合理但出人意料的转折或冲突' },
        { id: 'climax',  label: '推向高潮', hint: '把当前张力推向情感或剧情高潮' },
        { id: 'ending',  label: '走向结尾', hint: '收束本段并铺向自然的结尾' },
        { id: 'freeform',label: '自由发挥', hint: '不限定方向，按上文最合适的方式续写' },
    ];

    /* ---------- 工具 ---------- */
    function getCurrentContactId() {
        return window.currentOpenContact?.id || null;
    }
    function getStorageKey() {
        const id = getCurrentContactId();
        return id ? STORAGE_PREFIX + id : null;
    }
    function loadNovels() {
        const key = getStorageKey();
        if (!key) { novels = []; return; }
        try { novels = JSON.parse(localStorage.getItem(key) || '[]'); }
        catch (e) { novels = []; }
    }
    function saveNovels() {
        const key = getStorageKey();
        if (!key) return;
        localStorage.setItem(key, JSON.stringify(novels));
    }
    function getNovelById(id) { return novels.find(n => n.id === id) || null; }

    function escapeHtml(s) {
        if (s == null) return '';
        return String(s).replace(/[&<>"']/g, c => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
        })[c]);
    }

    function countChars(text) {
        if (!text) return 0;
        return text.replace(/\s/g, '').length;
    }

    function readingMinutes(text) {
        // 中文阅读 ~ 400 字/分钟
        return Math.max(1, Math.round(countChars(text) / 400));
    }

    function paragraphsHtml(text) {
        return (text || '')
            .split(/\n{2,}/g)
            .map(p => p.trim())
            .filter(Boolean)
            .map(p => `<p>${escapeHtml(p).replace(/\n/g, '<br>')}</p>`)
            .join('');
    }

    /* ---------- 人设 & 世界书 ---------- */
    function getPersonaInfo() {
        const c = window.currentOpenContact;
        if (!c) return { ai: { name: 'AI', persona: '' }, user: { name: '用户', persona: '' } };
        return {
            ai: { name: c.ai?.name || 'AI', persona: c.ai?.persona || '' },
            user: { name: c.user?.name || '用户', persona: c.user?.persona || '' }
        };
    }
    async function getWorldBookContent() {
        try {
            const c = window.currentOpenContact;
            if (!c) return '';
            const d = await window.dbHelper.loadData('worldBooks', 'allWorldBooks');
            const all = (d && Array.isArray(d.value)) ? d.value : [];
            if (c.linkedWorldBookIds?.length > 0)
                return all.filter(b => c.linkedWorldBookIds.includes(b.id)).map(b => b.content).join('\n\n');
            return '';
        } catch (e) { return ''; }
    }

    /* ---------- Toast ---------- */
    function showToast(text) {
        let t = document.getElementById('ff-toast');
        if (!t) { t = document.createElement('div'); t.id = 'ff-toast'; t.className = 'ff-toast'; document.body.appendChild(t); }
        t.textContent = text;
        t.classList.add('show');
        clearTimeout(t._timer);
        t._timer = setTimeout(() => t.classList.remove('show'), 2200);
    }

    /* ---------- Action Sheet ---------- */
    function showActionSheet(buttons, onCancel) {
        let mask = document.getElementById('ff-action-sheet-mask');
        if (mask) mask.remove();
        mask = document.createElement('div');
        mask.id = 'ff-action-sheet-mask';
        mask.className = 'ff-action-sheet-mask show';
        const close = () => { mask.classList.remove('show'); setTimeout(() => mask.remove(), 300); };
        const groupHtml = buttons.map(b =>
            `<button class="ff-action-sheet-btn ${b.destructive ? 'destructive' : ''}">${b.label}</button>`
        ).join('');
        mask.innerHTML = `<div class="ff-action-sheet">
            <div class="ff-action-sheet-group">${groupHtml}</div>
            <div class="ff-action-sheet-cancel"><button class="ff-action-sheet-btn">取消</button></div>
        </div>`;
        document.body.appendChild(mask);
        const btns = mask.querySelectorAll('.ff-action-sheet-group .ff-action-sheet-btn');
        btns.forEach((btn, i) => btn.addEventListener('click', () => { close(); buttons[i].action(); }));
        mask.querySelector('.ff-action-sheet-cancel .ff-action-sheet-btn').addEventListener('click', () => { close(); onCancel?.(); });
        mask.addEventListener('click', e => { if (e.target === mask) { close(); onCancel?.(); } });
    }
    /* ============================== AI 调用 ============================== */
    function buildPersonaBlock(p) {
        return `【角色 A · ${p.ai.name}】\n${p.ai.persona || '（未提供具体设定，请基于角色名合理塑造性格与背景）'}\n\n【角色 B · ${p.user.name}】\n${p.user.persona || '（未提供具体设定，请基于角色名合理塑造性格与背景）'}`;
    }

    const QUALITY_RULES = `
【写作总则 · 必须严格遵守】
1. **POV 一致**：选定第三人称限知或全知视角后，全篇保持一致，不得擅自切换。
2. **show, don't tell**：用具体的动作、神态、感官、对白展现情绪与关系，禁用"她很难过""他爱她"这类直白概括。
3. **五感介入**：场景中至少调动两种感官（视觉之外的听觉、嗅觉、触觉、温度、光线变化等），让画面立体。
4. **对白与动作交错**：避免大段连续独白；让对白嵌入动作、神态与心理细节中，节奏自然。
5. **角色忠于设定**：人物的语气、用词、决策必须与其人设吻合；不得让角色 OOC 发表"AI 助手腔"的客套话。
6. **避免 AI 文风地雷**：禁止"那一刻，时间仿佛静止了""空气中弥漫着……的味道""他/她不知道，这一切才刚刚开始"等高度套路化句式；禁止重复的形容词堆叠（如"绝美的、惊艳的、令人窒息的"连用）；禁止滥用感叹号。
7. **节奏控制**：开篇即入场景，避免冗长铺垫；中段推进矛盾或情绪；结尾留白或有钩子，不要总结升华。
8. **直接输出正文**：不要标题、不要"以下是为您创作的小说"等元话语；不要 Markdown 标题/列表；不要末尾署名。段与段之间用空行分隔。
`;

    async function callAIGenerate(opts) {
        const { mode, style, detail, lengthId, continuationHint, directionHint, novelContent } = opts;
        const sd = await window.dbHelper.loadData('settingsStore', 'apiSettings');
        if (!sd?.value?.url) throw new Error('API 未配置');
        const p = getPersonaInfo();
        let wb = '';
        if (includeWorldBook) wb = await getWorldBookContent();

        const lengthPreset = LENGTH_PRESETS.find(l => l.id === lengthId) || LENGTH_PRESETS[1];

        let sys;
        if (mode === 'continue') {
            const paragraphs = (novelContent || '').split(/\n{2,}/g);
            // 保留 contextLength 倍的段落（一轮约 3 段）
            const recent = paragraphs.slice(-(contextLength * 3)).join('\n\n');

            sys = `你是一位顶尖的中文小说作者，文笔克制而有质感。现在请基于已有正文，自然续写一段。

${buildPersonaBlock(p)}
${wb ? '\n【世界观设定】\n' + wb + '\n' : ''}
【已有正文 · 最近片段】
${recent || '（首段，请直接展开）'}

【续写方向】${directionHint || '按上文最合适的方式自然推进'}
${continuationHint ? '【作者额外提示】' + continuationHint + '\n' : ''}
【本段长度】约 600-900 字
${QUALITY_RULES}
【续写专项要求】
- 必须**紧密衔接**已有正文最后一段，不要重复上文已经描写过的画面或对白。
- 风格、人称、语气、用词与上文保持一致，仿佛同一位作者一气呵成。
- 不要在开头复述前情；直接从动作 / 对白 / 场景细节切入。
- 不要给本段加小标题。`;
        } else {
            const stylePrompt = style && style.trim() ? style.trim() : '不限定外部风格';
            const detailPrompt = detail && detail.trim() ? detail.trim() : '由你基于角色关系自由展开一段有戏剧张力的情节';

            sys = `你是一位顶尖的中文小说作者，文笔克制而有质感。请创作一段独立可读的同人小说片段。

${buildPersonaBlock(p)}
${wb ? '\n【世界观设定】\n' + wb + '\n' : ''}
【题材 / 风格】${stylePrompt}
【主题 / 情节走向】${detailPrompt}
【篇幅】${lengthPreset.prompt}
${QUALITY_RULES}
【创作专项要求】
- 开篇直入场景：用一个具体的画面、动作或对白把读者拉进去，禁止"在某个……的日子里""故事要从……说起"这类老套开头。
- 中段必须有冲突、抉择或情感波动，不能从头到尾只有平淡的日常描写。
- 结尾留有余韵或钩子，避免空泛的升华句。`;
        }

        const messages = [
            { role: 'system', content: sys },
            { role: 'user', content: mode === 'continue' ? '请直接续写本段。' : '请直接开始正文。' },
        ];

        const res = await window.universalApiRequest(sd.value, messages, {
            customTemperature: 0.92,
            maxTokens: 16384,
        });
        return res.choices[0].message.content.trim();
    }

    /* ============================== Tab 切换 ============================== */
    function switchTab(tab) {
        activeTab = tab;
        document.querySelectorAll('#fanfic-screen .ff-tab-item').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
        document.querySelectorAll('#fanfic-screen .ff-tab-content').forEach(c => c.classList.toggle('active', c.id === 'ff-tab-' + tab));

        // 沉浸：阅读/编辑具体小说时隐藏底部 tab
        const tabBar = document.querySelector('.ff-tab-bar');
        if (tabBar) tabBar.style.display = (tab === 'generate' && currentActiveId) ? 'none' : 'flex';

        // 顶部右侧操作槽（编辑/阅读切换 等）
        renderNavActions();

        // dock 显隐：仅在 generate + 有当前作品时显示
        if (!(tab === 'generate' && currentActiveId)) hideReaderDock();

        const headerTitle = document.getElementById('ff-header-title');
        if (headerTitle) {
            if (tab === 'generate') {
                const novel = currentActiveId ? getNovelById(currentActiveId) : null;
                if (novel) headerTitle.textContent = novel.customTitle || '未命名作品';
                else headerTitle.textContent = '创作';
            } else headerTitle.textContent = '书架';
        }

        if (tab === 'generate') renderGenerateTab();
        else renderBookshelfTab();
    }

    function renderNavActions() {
        const slot = document.getElementById('ff-nav-actions');
        if (!slot) return;
        slot.innerHTML = '';
        const novel = currentActiveId ? getNovelById(currentActiveId) : null;
        if (activeTab === 'generate' && novel?.content) {
            // 阅读 / 编辑切换按钮
            const btn = document.createElement('button');
            btn.className = 'ff-nav-icon-btn';
            btn.id = 'ff-toggle-mode-btn';
            btn.title = readerMode === 'read' ? '编辑' : '阅读';
            btn.innerHTML = readerMode === 'read'
                ? `<svg viewBox="0 0 24 24" stroke="currentColor"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 113 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>`
                : `<svg viewBox="0 0 24 24" stroke="currentColor"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/></svg>`;
            btn.addEventListener('click', toggleReaderMode);
            slot.appendChild(btn);
        }
    }

    function toggleReaderMode() {
        readerMode = readerMode === 'read' ? 'edit' : 'read';
        renderGenerateTab();
        renderNavActions();
    }
    /* ============================== 渲染：创作页 ============================== */
    function renderGenerateTab() {
        const c = document.getElementById('ff-generate-content');
        if (!c) return;
        const novel = currentActiveId ? getNovelById(currentActiveId) : null;

        if (novel?.content) {
            renderReaderOrEditor(c, novel);
        } else {
            renderComposeForm(c);
        }
        bindGenerateEvents();
    }

    /* ---------- 创作表单（state A） ---------- */
    function renderComposeForm(c) {
        const styleChips = STYLE_PRESETS.map(s => `
            <button class="ff-chip ${selectedStyle === s.id ? 'selected' : ''}" data-chip-style="${s.id}">${s.label}</button>
        `).join('');

        const lengthChips = LENGTH_PRESETS.map(l => `
            <button class="ff-chip ${selectedLength === l.id ? 'selected' : ''}" data-chip-length="${l.id}">${l.label} · ${l.words}字</button>
        `).join('');

        c.innerHTML = `
            <div class="ff-row-toggle">
                <div class="ff-row-left">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/></svg>
                    <span>引用世界书设定</span>
                </div>
                <input type="checkbox" class="ff-ios-switch" id="ff-worldbook-switch" ${includeWorldBook ? 'checked' : ''} />
            </div>

            <div class="ff-card">
                <div class="ff-card-title">
                    <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
                    题材风格
                </div>
                <div class="ff-chip-row">${styleChips}</div>
                <div class="ff-card-sub">自定义</div>
                <textarea id="ff-style-input" class="ff-textarea" placeholder="例：民国背景，慢热渐进，文风克制有留白...">${escapeHtml(draftStyle)}</textarea>
            </div>

            <div class="ff-card">
                <div class="ff-card-title">
                    <svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6"/><path d="M16 13H8"/><path d="M16 17H8"/><path d="M10 9H8"/></svg>
                    主题情节
                </div>
                <textarea id="ff-detail-input" class="ff-textarea ff-textarea-large" placeholder="描写一个具体的场景或冲突，例：暴雨夜两人被困电梯，多年的误会在沉默中浮出水面。">${escapeHtml(draftDetail)}</textarea>
            </div>

            <div class="ff-card">
                <div class="ff-card-title">
                    <svg viewBox="0 0 24 24"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
                    篇幅
                </div>
                <div class="ff-chip-row">${lengthChips}</div>
            </div>

            <button id="ff-generate-btn" class="ff-primary-btn" ${isGenerating ? 'disabled' : ''}>
                <span class="ff-spinner ${isGenerating ? 'visible' : ''}" id="ff-generate-spinner"></span>
                <span id="ff-generate-label">${isGenerating ? '正在创作...' : '开始创作'}</span>
            </button>

            ${renderHistoryList()}
        `;
    }

    /* ---------- 阅读 / 编辑模式（state B） ---------- */
    function renderReaderOrEditor(c, novel) {
        const chars = countChars(novel.content);
        const minutes = readingMinutes(novel.content);
        const title = novel.customTitle ? `<h1 class="ff-reader-title">${escapeHtml(novel.customTitle)}</h1>` : '';
        const meta = `
            <div class="ff-reader-meta">
                <span>${escapeHtml(novel.style || '未分类')}</span>
                <span class="ff-reader-meta-dot"></span>
                <span>${chars} 字</span>
                <span class="ff-reader-meta-dot"></span>
                <span>约 ${minutes} 分钟</span>
            </div>`;

        const body = readerMode === 'edit'
            ? `<textarea id="ff-editor-textarea" class="ff-editor-textarea" data-scrollable="true">${escapeHtml(novel.content)}</textarea>`
            : `<div class="ff-reader">
                ${meta}
                ${title}
                <div class="ff-reader-body">${paragraphsHtml(novel.content)}</div>
              </div>`;

        // 阅读区独立、纯净
        c.innerHTML = body;

        if (readerMode === 'edit') {
            const ta = document.getElementById('ff-editor-textarea');
            if (ta) {
                autoResize(ta);
                ta.addEventListener('input', function () { autoResize(this); syncAndSave(this.value); });
            }
        }

        // 操作放在浮动 dock（DOM 在 #fanfic-screen 下，独立于滚动体）
        renderReaderDock(novel);
    }

    function renderReaderDock(novel) {
        let dock = document.getElementById('ff-reader-dock');
        if (!dock) {
            dock = document.createElement('div');
            dock.id = 'ff-reader-dock';
            dock.className = 'ff-reader-dock';
            document.getElementById('fanfic-screen').appendChild(dock);
        }
        const canRegenContinue = !!lastContinueState && lastContinueState.novelId === novel.id;
        const canRegenCreate = !!novel.genParams;
        const canRegenerate = canRegenContinue || canRegenCreate;
        // tip：有续写时优先显示"重做续写"；否则是"重做创作"
        const regenTip = canRegenContinue ? '重做续写' : '重新创作';
        dock.innerHTML = `
            <button class="ff-dock-btn" id="ff-dock-history" data-tip="历史" aria-label="历史">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>
            </button>
            <button class="ff-dock-btn ff-dock-fav ${novel.isFavorited ? 'is-active' : ''}" id="ff-dock-fav" data-tip="${novel.isFavorited ? '已收藏' : '收藏'}" aria-label="收藏">
                <svg viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
            </button>
            <button class="ff-dock-btn ff-dock-primary" id="ff-dock-continue" data-tip="续写" aria-label="续写">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"/></svg>
            </button>
            ${canRegenerate ? `
            <button class="ff-dock-btn" id="ff-dock-regen" data-tip="${regenTip}" aria-label="${regenTip}">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 11-3-6.7L21 8"/><polyline points="21 3 21 8 16 8"/></svg>
            </button>` : ''}
        `;
        dock.style.display = 'flex';

        // 绑定 dock 事件
        dock.querySelector('#ff-dock-history').addEventListener('click', openHistoryDrawer);
        dock.querySelector('#ff-dock-fav').addEventListener('click', handleFavorite);
        dock.querySelector('#ff-dock-continue').addEventListener('click', openContinueSheet);
        dock.querySelector('#ff-dock-regen')?.addEventListener('click', handleRegenerate);
    }

    function hideReaderDock() {
        const dock = document.getElementById('ff-reader-dock');
        if (dock) dock.style.display = 'none';
    }


    function renderHistoryList() {
        if (!novels.length) return '';
        const items = novels.slice().reverse().map(n => {
            const tagText = (STYLE_PRESETS.find(s => s.label && (n.style?.includes?.(s.label)))?.label) || (n.style?.split(/[，,。.\s]/)[0] || '未分类');
            const preview = (n.content || n.detail || '').replace(/\s+/g, ' ').substring(0, 80);
            const chars = countChars(n.content);
            return `<div class="ff-history-item" data-id="${n.id}">
                <div class="ff-history-item-body">
                    <span class="ff-history-item-tag">${escapeHtml(tagText)}</span>
                    <div class="ff-history-item-preview">${escapeHtml(preview) || '（暂无内容）'}</div>
                    <div class="ff-history-item-meta">${chars} 字</div>
                </div>
                <button class="ff-history-delete-btn" data-delete-id="${n.id}" aria-label="删除">
                    <svg viewBox="0 0 24 24" stroke="currentColor"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
                </button>
            </div>`;
        }).join('');
        return `<div class="ff-history-section">
            <div class="ff-section-head">
                <span class="ff-section-title">创作历史</span>
                <span class="ff-section-count">${novels.length}</span>
            </div>
            ${items}
        </div>`;
    }

    /* ============================== 渲染：书架 ============================== */
    function renderBookshelfTab() {
        const c = document.getElementById('ff-bookshelf-content');
        if (!c) return;
        const fav = novels.filter(n => n.isFavorited);
        if (!fav.length) {
            c.innerHTML = `
                <div class="ff-empty-state">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/></svg>
                    <p><strong>书架空空如也</strong>把喜欢的作品从历史中收藏，<br>它们会安静地排在这里。</p>
                </div>`;
            return;
        }
        const items = fav.map(n => {
            const title = n.customTitle || (n.content || '').replace(/\s+/g, '').substring(0, 12) || '无题';
            const cover = n.cover
                ? `<img src="${escapeHtml(n.cover)}" alt="" />`
                : `<div class="ff-book-cover-text">${escapeHtml(title)}</div><div class="ff-book-spine"></div>`;
            return `<div class="ff-book-item" data-book-id="${n.id}">
                <div class="ff-book-cover">${cover}</div>
                <div class="ff-book-title">${escapeHtml(title)}</div>
            </div>`;
        }).join('');
        c.innerHTML = `<div class="ff-bookshelf-grid">${items}</div>`;
        bindBookshelfEvents();
    }
    /* ============================== 续写 Sheet ============================== */
    function ensureContinueSheet() {
        let sh = document.getElementById('ff-continue-sheet');
        if (sh) return sh;
        sh = document.createElement('div');
        sh.id = 'ff-continue-sheet';
        sh.className = 'ff-sheet-mask';
        sh.innerHTML = `
            <div class="ff-sheet">
                <div class="ff-sheet-handle"></div>
                <div class="ff-sheet-header">
                    <span class="ff-sheet-title">续写</span>
                    <button class="ff-sheet-close" id="ff-sheet-close" aria-label="关闭">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                </div>
                <div class="ff-sheet-body" data-scrollable="true">
                    <div class="ff-sheet-section-label">方向</div>
                    <div class="ff-chip-row" id="ff-direction-chips"></div>
                    <div class="ff-sheet-section-label">补充提示（可选）</div>
                    <input id="ff-continue-input" class="ff-continue-input" placeholder="例：突入战斗、误会解开、回忆杀..." />
                    <div class="ff-sheet-meta">
                        <label>参考上下文 <select id="ff-context-select" class="ff-context-select"></select></label>
                    </div>
                </div>
                <div class="ff-sheet-footer">
                    <button id="ff-sheet-continue-btn" class="ff-primary-btn ff-primary-btn-compact">
                        <span class="ff-spinner" id="ff-sheet-spinner"></span>
                        <span id="ff-sheet-continue-label">续写本段</span>
                    </button>
                </div>
            </div>
        `;
        document.body.appendChild(sh);

        sh.addEventListener('click', e => { if (e.target === sh) closeContinueSheet(); });
        sh.querySelector('#ff-sheet-close').addEventListener('click', closeContinueSheet);
        sh.querySelector('#ff-sheet-continue-btn').addEventListener('click', handleContinue);

        sh.querySelector('#ff-direction-chips').addEventListener('click', e => {
            const chip = e.target.closest('[data-chip-direction]');
            if (!chip) return;
            selectedDirection = chip.dataset.chipDirection;
            sh.querySelectorAll('[data-chip-direction]').forEach(b =>
                b.classList.toggle('selected', b.dataset.chipDirection === selectedDirection));
        });
        sh.querySelector('#ff-continue-input').addEventListener('input', function () { draftContinue = this.value; });
        sh.querySelector('#ff-context-select').addEventListener('change', function () { contextLength = parseInt(this.value) || 5; });
        return sh;
    }

    function openContinueSheet() {
        const sh = ensureContinueSheet();
        // 渲染 chips
        sh.querySelector('#ff-direction-chips').innerHTML = DIRECTION_PRESETS.map(d =>
            `<button class="ff-chip ${selectedDirection === d.id ? 'selected' : ''}" data-chip-direction="${d.id}">${d.label}</button>`
        ).join('');
        // 上下文 select
        sh.querySelector('#ff-context-select').innerHTML = [1, 2, 3, 5, 8, 10, 15, 20]
            .map(n => `<option value="${n}" ${contextLength === n ? 'selected' : ''}>${n} 轮</option>`).join('');
        // 复原输入
        sh.querySelector('#ff-continue-input').value = draftContinue;

        sh.classList.add('show');
        setTimeout(() => sh.querySelector('#ff-continue-input').focus(), 250);
    }

    function closeContinueSheet() {
        const sh = document.getElementById('ff-continue-sheet');
        if (sh) sh.classList.remove('show');
    }

    /* ============================== 历史 Drawer ============================== */
    function ensureHistoryDrawer() {
        let dr = document.getElementById('ff-history-drawer');
        if (dr) return dr;
        dr = document.createElement('div');
        dr.id = 'ff-history-drawer';
        dr.className = 'ff-drawer-mask';
        dr.innerHTML = `
            <div class="ff-drawer">
                <div class="ff-drawer-header">
                    <span class="ff-drawer-title">作品历史</span>
                    <button class="ff-drawer-close" id="ff-drawer-close" aria-label="关闭">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                </div>
                <div class="ff-drawer-body" id="ff-drawer-body" data-scrollable="true"></div>
            </div>
        `;
        document.body.appendChild(dr);
        dr.addEventListener('click', e => { if (e.target === dr) closeHistoryDrawer(); });
        dr.querySelector('#ff-drawer-close').addEventListener('click', closeHistoryDrawer);
        return dr;
    }

    function openHistoryDrawer() {
        const dr = ensureHistoryDrawer();
        const body = dr.querySelector('#ff-drawer-body');
        if (!novels.length) {
            body.innerHTML = `<div class="ff-empty-state"><strong>还没有作品</strong>开始第一次创作吧。</div>`;
        } else {
            body.innerHTML = novels.slice().reverse().map(n => {
                const tagText = n.style?.split(/[，,。.\s]/)[0] || '未分类';
                const preview = (n.content || n.detail || '').replace(/\s+/g, ' ').substring(0, 80);
                const chars = countChars(n.content);
                const isCurrent = n.id === currentActiveId;
                return `<div class="ff-history-item ${isCurrent ? 'is-current' : ''}" data-id="${n.id}">
                    <div class="ff-history-item-body">
                        <span class="ff-history-item-tag">${escapeHtml(tagText)}</span>
                        <div class="ff-history-item-preview">${escapeHtml(preview) || '（暂无内容）'}</div>
                        <div class="ff-history-item-meta">${chars} 字${isCurrent ? ' · 当前阅读' : ''}</div>
                    </div>
                    <button class="ff-history-delete-btn" data-delete-id="${n.id}" aria-label="删除">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
                    </button>
                </div>`;
            }).join('');
        }
        body.onclick = e => {
            const del = e.target.closest('.ff-history-delete-btn');
            if (del) { e.stopPropagation(); handleDelete(del.dataset.deleteId); openHistoryDrawer(); return; }
            const it = e.target.closest('.ff-history-item');
            if (it) { currentActiveId = it.dataset.id; enteredFromTab = activeTab === 'bookshelf' ? 'bookshelf' : 'generate'; closeHistoryDrawer(); switchTab('generate'); }
        };
        dr.classList.add('show');
    }

    function closeHistoryDrawer() {
        const dr = document.getElementById('ff-history-drawer');
        if (dr) dr.classList.remove('show');
    }

    /* ============================== 事件绑定（创作表单） ============================== */
    function bindGenerateEvents() {
        // 世界书 - 用属性标记防重复
        const ws = document.getElementById('ff-worldbook-switch');
        if (ws && !ws.dataset.ffBound) {
            ws.dataset.ffBound = '1';
            ws.addEventListener('change', function () { includeWorldBook = this.checked; });
        }
        // 风格 chip
        document.querySelectorAll('[data-chip-style]').forEach(b => {
            if (b.dataset.ffBound) return;
            b.dataset.ffBound = '1';
            b.addEventListener('click', () => {
                selectedStyle = (selectedStyle === b.dataset.chipStyle) ? '' : b.dataset.chipStyle;
                document.querySelectorAll('[data-chip-style]').forEach(x =>
                    x.classList.toggle('selected', x.dataset.chipStyle === selectedStyle));
            });
        });
        // 长度 chip
        document.querySelectorAll('[data-chip-length]').forEach(b => {
            if (b.dataset.ffBound) return;
            b.dataset.ffBound = '1';
            b.addEventListener('click', () => {
                selectedLength = b.dataset.chipLength;
                document.querySelectorAll('[data-chip-length]').forEach(x =>
                    x.classList.toggle('selected', x.dataset.chipLength === selectedLength));
            });
        });
        // 草稿
        const styleInput = document.getElementById('ff-style-input');
        if (styleInput && !styleInput.dataset.ffBound) {
            styleInput.dataset.ffBound = '1';
            styleInput.addEventListener('input', function () { draftStyle = this.value; });
        }
        const detailInput = document.getElementById('ff-detail-input');
        if (detailInput && !detailInput.dataset.ffBound) {
            detailInput.dataset.ffBound = '1';
            detailInput.addEventListener('input', function () { draftDetail = this.value; });
        }
        const genBtn = document.getElementById('ff-generate-btn');
        if (genBtn && !genBtn.dataset.ffBound) {
            genBtn.dataset.ffBound = '1';
            genBtn.addEventListener('click', handleGenerate);
        }

        // 历史区点击：用属性标记防重复绑定
        const gc = document.getElementById('ff-generate-content');
        if (gc && !gc.dataset.ffBound) {
            gc.dataset.ffBound = '1';
            gc.addEventListener('click', e => {
                const del = e.target.closest('.ff-history-delete-btn');
                if (del) { e.stopPropagation(); handleDelete(del.dataset.deleteId); return; }
                const it = e.target.closest('.ff-history-item');
                if (it) { currentActiveId = it.dataset.id; enteredFromTab = 'generate'; switchTab('generate'); }
            });
        }
    }

    function bindBookshelfEvents() {
        const bc = document.getElementById('ff-bookshelf-content');
        if (!bc || bc.dataset.ffBound === '1') return;
        bc.dataset.ffBound = '1';
        bc.addEventListener('click', e => {
            const item = e.target.closest('.ff-book-item');
            if (!item) return;
            const id = item.dataset.bookId;
            showActionSheet([
                { label: '阅读 / 编辑', action: () => { currentActiveId = id; enteredFromTab = 'bookshelf'; switchTab('generate'); } },
                { label: '更换封面', action: () => triggerCoverUpload(id) },
                { label: '修改书名', action: () => promptRename(id) },
            ]);
        });
    }

    /* ============================== 业务操作 ============================== */
    async function handleGenerate() {
        const btn = document.getElementById('ff-generate-btn');
        const sp = document.getElementById('ff-generate-spinner');
        const label = document.getElementById('ff-generate-label');

        // 合成 style/detail 文本：chip + 用户补充
        const styleChip = STYLE_PRESETS.find(s => s.id === selectedStyle);
        const stylePieces = [styleChip?.hint, draftStyle.trim()].filter(Boolean);
        const styleText = stylePieces.join('；') || '不限';
        const detailText = draftDetail.trim();

        if (btn) btn.disabled = true;
        isGenerating = true;
        sp?.classList.add('visible');
        if (label) label.textContent = '正在创作...';

        try {
            const content = await callAIGenerate({
                mode: 'create',
                style: styleText,
                detail: detailText,
                lengthId: selectedLength,
            });
            const novel = {
                id: Date.now().toString(),
                style: styleChip?.label || (draftStyle.trim().split(/[，,。.\s]/)[0] || '未分类'),
                detail: detailText,
                content,
                isFavorited: false,
                cover: null,
                customTitle: null,
                createdAt: Date.now(),
                // 保存创作参数，供"重新生成"使用
                genParams: {
                    style: styleText,
                    detail: detailText,
                    lengthId: selectedLength,
                    includeWorldBook: includeWorldBook,
                },
            };
            novels.push(novel);
            saveNovels();
            currentActiveId = novel.id;
            enteredFromTab = 'generate';
            // 清空草稿
            draftStyle = ''; draftDetail = '';
            isGenerating = false;
            switchTab('generate');
        } catch (err) {
            showToast('生成失败: ' + (err.message || ''));
            isGenerating = false;
            if (document.getElementById('ff-generate-btn')) {
                document.getElementById('ff-generate-btn').disabled = false;
                document.getElementById('ff-generate-spinner')?.classList.remove('visible');
                const lbl = document.getElementById('ff-generate-label');
                if (lbl) lbl.textContent = '开始创作';
            }
        }
    }

    function handleFavorite() {
        const novel = getNovelById(currentActiveId);
        if (!novel) return;
        novel.isFavorited = !novel.isFavorited;
        saveNovels();
        showToast(novel.isFavorited ? '已加入书架' : '已取消收藏');
        // 局部刷新 dock 上的收藏按钮
        renderReaderDock(novel);
    }

    async function handleContinue() {
        const novel = getNovelById(currentActiveId);
        if (!novel) { closeContinueSheet(); return; }

        const sheet = document.getElementById('ff-continue-sheet');
        const btn = sheet?.querySelector('#ff-sheet-continue-btn');
        const sp = sheet?.querySelector('#ff-sheet-spinner');
        const lbl = sheet?.querySelector('#ff-sheet-continue-label');

        if (btn) btn.disabled = true;
        isContinuing = true;
        sp?.classList.add('visible');
        if (lbl) lbl.textContent = '续写中...';

        const dirObj = DIRECTION_PRESETS.find(d => d.id === selectedDirection) || DIRECTION_PRESETS[0];
        const directionHint = dirObj.hint;
        const userHint = draftContinue.trim();

        // 快照（用于「重新生成」）
        const snapshot = novel.content;

        try {
            const text = await callAIGenerate({
                mode: 'continue',
                directionHint,
                continuationHint: userHint,
                novelContent: novel.content,
            });
            novel.content = (novel.content ? novel.content + '\n\n' : '') + text;
            saveNovels();
            lastContinueState = {
                novelId: novel.id,
                snapshot,
                directionId: selectedDirection,
                directionHint,
                userHint,
            };
            draftContinue = '';
            closeContinueSheet();
            renderGenerateTab();
            showToast('续写完成');
            // 自动滚到底部
            setTimeout(scrollReaderToBottom, 80);
        } catch (err) {
            showToast('续写失败: ' + (err.message || ''));
        } finally {
            isContinuing = false;
            if (btn) btn.disabled = false;
            sp?.classList.remove('visible');
            if (lbl) lbl.textContent = '续写本段';
        }
    }

    async function handleRegenerate() {
        const novel = getNovelById(currentActiveId);
        if (!novel) return;

        // 情况一：有续写快照 → 回退最后续写并重做
        const hasContinueSnapshot = lastContinueState && lastContinueState.novelId === novel.id;
        if (hasContinueSnapshot) {
            return regenerateContinue(novel);
        }
        // 情况二：没有续写过，但记录了创作参数 → 重新创作整篇
        if (novel.genParams) {
            return regenerateCreate(novel);
        }
        showToast('当前作品没有可重做的来源参数');
    }

    async function regenerateContinue(novel) {
        // 回退到 snapshot
        novel.content = lastContinueState.snapshot;
        saveNovels();
        showToast('回退后重新生成中...');
        const directionHint = lastContinueState.directionHint;
        const userHint = lastContinueState.userHint;
        const snapshot = novel.content;
        isContinuing = true;
        renderReaderDock(novel);
        try {
            const text = await callAIGenerate({
                mode: 'continue',
                directionHint,
                continuationHint: userHint,
                novelContent: novel.content,
            });
            novel.content = (novel.content ? novel.content + '\n\n' : '') + text;
            saveNovels();
            lastContinueState = { ...lastContinueState, snapshot };
            renderGenerateTab();
            setTimeout(scrollReaderToBottom, 80);
            showToast('已重新生成');
        } catch (err) {
            showToast('重新生成失败: ' + (err.message || ''));
        } finally {
            isContinuing = false;
        }
    }

    async function regenerateCreate(novel) {
        const ok = confirm('将用相同的题材、主题、篇幅重新创作整篇？\n（当前正文会被替换，无法撤销）');
        if (!ok) return;
        const params = novel.genParams;
        // 临时复用 includeWorldBook 的当时设定
        const savedWB = includeWorldBook;
        if (typeof params.includeWorldBook === 'boolean') includeWorldBook = params.includeWorldBook;

        isGenerating = true;
        // 在阅读视图无创作按钮可禁用，仅靠 toast + dock 重渲染（继续显示原内容直到完成）
        showToast('重新创作中...');
        try {
            const content = await callAIGenerate({
                mode: 'create',
                style: params.style,
                detail: params.detail,
                lengthId: params.lengthId,
            });
            novel.content = content;
            // 重做创作意味着这是一个全新的开篇 → 清掉旧的续写快照
            lastContinueState = null;
            saveNovels();
            renderGenerateTab();
            setTimeout(scrollReaderToBottom, 80);
            showToast('已重新创作');
        } catch (err) {
            showToast('重新创作失败: ' + (err.message || ''));
        } finally {
            includeWorldBook = savedWB;
            isGenerating = false;
        }
    }

    function handleDelete(id) {
        novels = novels.filter(n => n.id !== id);
        saveNovels();
        if (currentActiveId === id) {
            currentActiveId = null;
            lastContinueState = null;
            hideReaderDock();
        }
        renderGenerateTab();
        showToast('已删除');
    }

    let _saveDebounce = null;
    function syncAndSave(value) {
        const novel = getNovelById(currentActiveId);
        if (novel) novel.content = value;
        clearTimeout(_saveDebounce);
        _saveDebounce = setTimeout(() => saveNovels(), 800);
    }

    function autoResize(el) { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px'; }

    function scrollReaderToBottom() {
        const sb = document.querySelector('#fanfic-screen .ff-scroll-body');
        if (sb) sb.scrollTop = sb.scrollHeight;
    }

    /* ============================== 封面 / 重命名 ============================== */
    function triggerCoverUpload(novelId) {
        let input = document.getElementById('ff-cover-upload-input');
        if (!input) {
            input = document.createElement('input');
            input.type = 'file'; input.accept = 'image/*';
            input.id = 'ff-cover-upload-input';
            input.className = 'ff-hidden-file-input';
            document.body.appendChild(input);
        }
        input.onchange = function () {
            const file = this.files[0]; if (!file) return;
            const reader = new FileReader();
            reader.onload = function (e) {
                const img = new Image();
                img.onload = function () {
                    const canvas = document.createElement('canvas');
                    const maxW = 360, maxH = 480;
                    let w = img.width, h = img.height;
                    if (w > maxW || h > maxH) { const r = Math.min(maxW / w, maxH / h); w *= r; h *= r; }
                    canvas.width = w; canvas.height = h;
                    canvas.getContext('2d').drawImage(img, 0, 0, w, h);
                    const novel = getNovelById(novelId);
                    if (novel) {
                        novel.cover = canvas.toDataURL('image/jpeg', 0.78);
                        saveNovels();
                        renderBookshelfTab();
                        showToast('封面已更新');
                    }
                };
                img.src = e.target.result;
            };
            reader.readAsDataURL(file);
            this.value = '';
        };
        input.click();
    }

    function promptRename(novelId) {
        const novel = getNovelById(novelId);
        if (!novel) return;
        const current = novel.customTitle || (novel.content || '').replace(/\s+/g, '').substring(0, 14) || '';
        const name = prompt('请输入新书名：', current);
        if (name !== null && name.trim()) {
            novel.customTitle = name.trim();
            saveNovels();
            renderBookshelfTab();
            showToast('书名已更新');
        }
    }

    /* ============================== Onboarding 教程 ============================== */
    const TOUR_KEY = 'fanfic_tour_seen_v4';
    function maybeShowTour() {
        if (localStorage.getItem(TOUR_KEY) === '1') return;
        const steps = [
            {
                title: '欢迎来到同人创作',
                body: '基于当前聊天角色的人设和世界书，为你创作专属的同人小说片段。每个角色的作品独立保存。',
            },
            {
                title: '选风格、定主题',
                body: '在创作页选一个题材 chip（古风、校园、悬疑…）和篇幅 chip，再描述你想要的情节，点「开始创作」即可。',
            },
            {
                title: '阅读视图',
                body: '生成完成后进入阅读视图，正文以衬线字体呈现，点右上角的铅笔图标可切换到编辑模式手动修改。',
            },
            {
                title: '阅读 Dock',
                body: '阅读时下方浮动小栏：历史 / 收藏（点亮变实心星）/ 续写（主按钮）/ 重做。续写会弹出方向面板，可选「推进剧情/加深氛围/制造转折…」。',
            },
            {
                title: '一键重做',
                body: 'Dock 最右的循环箭头即"重做"。续写过则重做最后那一段；没续写过则用相同题材/主题/篇幅整篇重新创作（会替换正文）。',
            },
            {
                title: '书架收藏',
                body: '点 dock 收藏后，作品会出现在底部「书架」tab，可换封面、改书名、阅读。',
            },
            {
                title: '想再写一篇？',
                body: '阅读视图的返回按钮 = 回到来源 tab。想从头创作新作品，回到「创作」tab，把表单清空再生成即可。',
            },
        ];
        let idx = 0;
        const mask = document.createElement('div');
        mask.className = 'ff-tour-mask';
        mask.innerHTML = `
            <div class="ff-tour-card">
                <div class="ff-tour-progress" id="ff-tour-progress"></div>
                <div class="ff-tour-title" id="ff-tour-title"></div>
                <div class="ff-tour-body" id="ff-tour-body"></div>
                <div class="ff-tour-footer">
                    <button class="ff-tour-skip" id="ff-tour-skip">跳过</button>
                    <button class="ff-tour-next" id="ff-tour-next">下一步</button>
                </div>
            </div>`;
        document.body.appendChild(mask);
        const titleEl = mask.querySelector('#ff-tour-title');
        const bodyEl = mask.querySelector('#ff-tour-body');
        const progEl = mask.querySelector('#ff-tour-progress');
        const nextBtn = mask.querySelector('#ff-tour-next');
        function render() {
            const s = steps[idx];
            titleEl.textContent = s.title;
            bodyEl.textContent = s.body;
            progEl.innerHTML = steps.map((_, i) =>
                `<span class="ff-tour-dot ${i === idx ? 'active' : ''}"></span>`
            ).join('');
            nextBtn.textContent = idx === steps.length - 1 ? '开始创作' : '下一步';
        }
        function close() {
            localStorage.setItem(TOUR_KEY, '1');
            mask.classList.remove('show');
            setTimeout(() => mask.remove(), 240);
        }
        mask.querySelector('#ff-tour-skip').addEventListener('click', close);
        nextBtn.addEventListener('click', () => {
            if (idx < steps.length - 1) { idx++; render(); } else close();
        });
        mask.addEventListener('click', e => { if (e.target === mask) close(); });
        render();
        requestAnimationFrame(() => mask.classList.add('show'));
    }

    /* ============================== 打开 / 关闭 ============================== */
    function openFanficScreen() {
        const screen = document.getElementById('fanfic-screen');
        if (!screen) return;
        if (!getCurrentContactId()) { showToast('请先打开一个聊天'); return; }
        loadNovels();
        screen.classList.add('active');
        currentActiveId = null;
        lastContinueState = null;
        readerMode = 'read';
        hideReaderDock();
        switchTab('generate');
        // 首次进入显示教程
        setTimeout(maybeShowTour, 320);
    }
    function closeFanficScreen() {
        const screen = document.getElementById('fanfic-screen');
        if (screen) screen.classList.remove('active');
        saveNovels();
        closeContinueSheet();
        closeHistoryDrawer();
        hideReaderDock();
        const tourMask = document.querySelector('.ff-tour-mask');
        if (tourMask) tourMask.remove();
    }

    /* ============================== 备份支持 ============================== */
    function getAllFanficKeys() {
        const keys = [];
        for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            if (k && k.startsWith(STORAGE_PREFIX)) keys.push(k);
        }
        return keys;
    }
    function exportAllFanficData() {
        const data = {};
        getAllFanficKeys().forEach(k => { try { data[k] = JSON.parse(localStorage.getItem(k)); } catch (e) {} });
        return data;
    }
    function importAllFanficData(data) {
        if (!data || typeof data !== 'object') return;
        Object.keys(data).forEach(k => {
            if (k.startsWith(STORAGE_PREFIX)) localStorage.setItem(k, JSON.stringify(data[k]));
        });
    }

    /* ============================== 初始化 ============================== */
    function initFanficEvents() {
        document.getElementById('ff-back-btn')?.addEventListener('click', () => {
            if (currentActiveId) {
                // 阅读视图按返回 → 回到来路 tab，而不是直接退出
                saveNovels();
                const back = enteredFromTab || 'generate';
                currentActiveId = null;
                lastContinueState = null;
                readerMode = 'read';
                hideReaderDock();
                switchTab(back);
            } else {
                closeFanficScreen();
            }
        });
        document.querySelectorAll('#fanfic-screen .ff-tab-item').forEach(tab => {
            tab.addEventListener('click', function () {
                if (currentActiveId) {
                    // 在阅读视图点 tab → 离开阅读
                    currentActiveId = null;
                    lastContinueState = null;
                    hideReaderDock();
                }
                switchTab(this.dataset.tab);
            });
        });
    }

    /* 暴露 */
    window.openFanficScreen = openFanficScreen;
    window.closeFanficScreen = closeFanficScreen;
    window.FanficModule = { exportAllFanficData, importAllFanficData, getAllFanficKeys };

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initFanficEvents);
    else initFanficEvents();
})();



