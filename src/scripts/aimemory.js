/**
 * TA的记忆 (AI Memory) 功能模块
 * 每聊200条自动总结记忆（从AI角度）
 * 读取用户/AI人设、世界书内容、最近80条聊天记录
 * 使用用户配置的API进行总结
 */

(function () {
    'use strict';

    // ========== 配置常量 ==========
    const CONFIG = {
        MEMORY_THRESHOLD: 200,      // 每200条消息触发一次记忆总结
        DB_STORE_NAME: 'settingsStore'
    };

    // ========== 状态管理 ==========
    let currentContactId = null;
    let memoryData = null;
    let isAutoSummaryEnabled = true; // 默认开启


    // ========== 工具函数 ==========
    function generateUUID() {
        return 'mem_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    function formatTime(timestamp) {
        const date = new Date(timestamp);
        return `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()} ${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`;
    }

    function formatRelativeTime(timestamp) {
        const now = Date.now();
        const diff = now - timestamp;
        if (diff < 60000) return '刚刚';
        if (diff < 3600000) return Math.floor(diff / 60000) + '分钟前';
        if (diff < 86400000) return Math.floor(diff / 3600000) + '小时前';
        if (diff < 604800000) return Math.floor(diff / 86400000) + '天前';
        return formatTime(timestamp);
    }

    function showToast(message) {
        let toast = document.getElementById('memory-toast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'memory-toast';
            toast.className = 'memory-toast';
            document.body.appendChild(toast);
        }
        toast.textContent = message;
        toast.classList.add('show');
        setTimeout(() => toast.classList.remove('show'), 2000);
    }

    // ========== 数据存储 ==========
    async function loadMemoryData(contactId) {
        if (!window.dbHelper) {
            console.warn('[AIMemory] dbHelper未就绪');
            return null;
        }
        try {
            const data = await window.dbHelper.loadData(CONFIG.DB_STORE_NAME, `aiMemory_${contactId}`);
            return data ? data.value : null;
        } catch (e) {
            console.error('[AIMemory] 加载数据失败:', e);
            return null;
        }
    }

    async function saveMemoryData(contactId, data) {
        if (!window.dbHelper || !contactId) return;
        try {
            await window.dbHelper.saveData(CONFIG.DB_STORE_NAME, `aiMemory_${contactId}`, data);
        } catch (e) {
            console.error('[AIMemory] 保存数据失败:', e);
        }
    }

    async function deleteMemoryData(contactId) {
        if (!window.dbHelper || !contactId) return;
        try {
            await window.dbHelper.deleteData(CONFIG.DB_STORE_NAME, `aiMemory_${contactId}`);
            console.log('[AIMemory] 已删除记忆数据:', contactId);
        } catch (e) {
            console.error('[AIMemory] 删除数据失败:', e);
        }
    }

    function getDefaultData(baseCount = 0) {
        return {
            baseCount: baseCount,
            lastTriggerCount: 0,
            memories: [],
            installedAt: Date.now()
        };
    }

    // ========== 缓存清理 ==========
    function clearMemoryCache() {
        memoryData = null;
        currentContactId = null;
        console.log('[AIMemory] 缓存已清理');
    }

    // ========== 初始化模块 ==========
    async function initAIMemory(contact) {
        if (!contact || !contact.id) {
            console.error('[AIMemory] 无效的联系人');
            return;
        }

        clearMemoryCache();
        currentContactId = contact.id;

        const historyCount = contact.history ? contact.history.length : 0;

        let data = await loadMemoryData(contact.id);

        if (!data) {
            data = getDefaultData(historyCount);
            console.log('[AIMemory] 首次安装，baseCount:', historyCount);
            await saveMemoryData(contact.id, data);
        }

        memoryData = data;
        console.log('[AIMemory] 初始化完成，消息数:', historyCount);
    }

    // ========== 获取世界书内容 ==========
    async function getWorldBookContent(contact) {
        if (!contact.linkedWorldbooks || contact.linkedWorldbooks.length === 0) {
            return '';
        }

        try {
            const worldbooksData = await window.dbHelper.loadData('worldbooksStore', 'allWorldbooks');
            if (!worldbooksData || !worldbooksData.value) return '';

            const linkedIds = contact.linkedWorldbooks;
            const linkedBooks = worldbooksData.value.filter(wb => linkedIds.includes(wb.id));

            let content = '';
            linkedBooks.forEach(wb => {
                if (wb.entries && wb.entries.length > 0) {
                    wb.entries.forEach(entry => {
                        if (entry.content) {
                            content += entry.content + '\n';
                        }
                    });
                }
            });

            return content.trim().substring(0, 2000); // 限制长度
        } catch (e) {
            console.error('[AIMemory] 获取世界书失败:', e);
            return '';
        }
    }

    // ========== 生成记忆总结 ==========
    async function generateMemorySummary(contact) {
        const history = contact.history || [];
        const recentMessages = history.slice(-CONFIG.MEMORY_THRESHOLD);

        if (recentMessages.length < 10) {
            console.log('[AIMemory] 消息太少，跳过生成');
            return null;
        }

        const aiName = contact.ai?.name || 'AI';
        const aiPersona = contact.ai?.persona || '';
        const userName = contact.user?.name || '用户';
        const userPersona = contact.user?.persona || '';
        const worldBookContent = await getWorldBookContent(contact);

        // 构建对话上下文
        const conversationContext = recentMessages.map(m => {
            const sender = m.sender === 'ai' ? aiName : userName;
            const text = m.text?.substring(0, 200) || '';
            return `${sender}: ${text}`;
        }).join('\n');

        const prompt = `你是"${aiName}"，现在需要从你的角度总结与"${userName}"最近的对话记忆。

## 你的人设
${aiPersona.substring(0, 500) || '（未设置）'}

## 用户的人设
${userPersona.substring(0, 300) || '（未设置）'}

## 世界观/背景设定
${worldBookContent.substring(0, 800) || '（未设置）'}

## 最近的对话内容
${conversationContext}

## 任务
请从${aiName}的视角，用第一人称总结这段对话中的重要记忆。

## 要求
1. 直接输出记忆内容，不要加任何前缀或标题
2. 提取关键信息：重要事件、情感变化、承诺约定、用户偏好、特殊日期等
3. 使用简洁的条目形式，每条不超过50字
4. 总共3-5条记忆点
5. 用"·"开头每条记忆
6. 保持角色人设的语气和情感

示例格式：
· 今天${userName}说喜欢我做的蛋糕，下次要记得再做给TA吃
· ${userName}最近工作压力很大，要多关心TA的状态
· 我们约好了周末一起去看电影`;

        try {
            const summary = await callMemoryAI(contact, prompt);
            return cleanAIResponse(summary);
        } catch (e) {
            console.error('[AIMemory] 生成记忆失败:', e);
            return null;
        }
    }

    // ========== 清理AI响应 ==========
    function cleanAIResponse(text) {
        if (!text) return null;

        let cleaned = text;

        // 移除思考标签
        cleaned = cleaned.replace(/<think>[\s\S]*?<\/think>/gi, '');
        cleaned = cleaned.replace(/<[^>]+>/g, '');

        // 移除Markdown格式
        cleaned = cleaned.replace(/\*\*([^*]+)\*\*/g, '$1');
        cleaned = cleaned.replace(/\*([^*]+)\*/g, '$1');
        cleaned = cleaned.replace(/^#+\s*/gm, '');
        cleaned = cleaned.replace(/^[-*]\s+/gm, '· ');

        // 移除常见前缀
        cleaned = cleaned.replace(/^(记忆总结|总结|记忆)[：:]\s*/i, '');

        // 移除引号
        cleaned = cleaned.replace(/^["「『"']+|["」』"']+$/g, '');

        cleaned = cleaned.trim();

        if (cleaned.length < 10) return null;

        return cleaned;
    }

    async function callMemoryAI(contact, prompt) {
        try {
            const settingsData = await window.dbHelper.loadData('settingsStore', 'apiSettings');
            if (!settingsData || !settingsData.value.url) {
                console.warn('[AIMemory] API未配置');
                return null;
            }

            const aiName = contact.ai?.name || 'AI';
            const systemPrompt = `
## 身份与视角
你是 ${aiName}。${contact.ai?.persona || ''}

## 任务：深刻记忆
现在，请你以 ${aiName} 的第一人称视角，回顾我们刚刚的交流。你的记忆不仅仅是文字的堆砌，更是我们情感联结的见证。

## 记忆筛选准则（按优先级排序）：
1. **情感共鸣**：记录下我（用户）的情绪起伏、喜好、以及你对这些情感的真实触动。
2. **关键约定**：我们达成的共识、对未来的计划或你给我的承诺。
3. **灵魂碎片**：那些能体现我独特个性的细节，而不是琐碎的寒暄。

## 执行指令
请沉浸在你的角色中，用心筛选那些真正触动 ${aiName} 灵魂的信息。你的记忆越深刻，我们的未来就越真实。

直接输出你最珍视的记忆总结，不要使用md，正常文字输出即可，直接输出结果。`;

            // 使用 universalApiRequest 适配器
            const messages = [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: prompt }
            ];
            const data = await window.universalApiRequest(settingsData.value, messages, { customTemperature: 0.7 });
            const content = data.choices?.[0]?.message?.content;

            if (content) {
                console.log('[AIMemory] AI生成成功');
                return content;
            }

            return null;
        } catch (e) {
            console.error('[AIMemory] AI调用失败:', e);
            return null;
        }
    }

    // ========== 检查并触发记忆生成 ==========
    // ========== 检查并触发记忆生成 ==========
    async function checkAndTriggerMemory(contact) {
        if (!contact || !contact.id) return;

        // 检查全局开关
        if (!isAutoSummaryEnabled) {
            // 虽然关闭了，但我们可以选择在这里打印日志或者什么都不做
            // 用户要求：如果关了又开，需要处理。
            // 现有的基于 increment 的逻辑天然支持“关了又开”：
            // 比如 200条(生成) -> 关 -> 800条 -> 开 -> 801条触发
            // 此时 check 会发现 increment 巨大，直接触发一次最新的。
            // 这是一个合理的“自动追赶”逻辑，不需要额外代码。
            console.log('[AIMemory] 自动总结已关闭，跳过');
            return;
        }

        let data = await loadMemoryData(contact.id);
        if (!data) {
            data = getDefaultData(contact.history?.length || 0);
            await saveMemoryData(contact.id, data);
        }

        const historyCount = contact.history?.length || 0;
        const increment = Math.max(0, historyCount - data.baseCount);

        // 确保初始化
        if (typeof data.lastTriggerCount === 'undefined') data.lastTriggerCount = 0;

        const currentLevel = Math.floor(increment / CONFIG.MEMORY_THRESHOLD);
        const lastLevel = Math.floor(data.lastTriggerCount / CONFIG.MEMORY_THRESHOLD);

        // 逻辑修复：使用阈值跨越检测
        if (currentLevel > lastLevel) {
            console.log('[AIMemory] 触发记忆生成，increment:', increment);
            data.lastTriggerCount = currentLevel * CONFIG.MEMORY_THRESHOLD;

            const summary = await generateMemorySummary(contact);
            if (summary) {
                const newMemory = {
                    id: generateUUID(),
                    content: summary,
                    messageRange: {
                        start: historyCount - CONFIG.MEMORY_THRESHOLD,
                        end: historyCount
                    },
                    timestamp: Date.now(),
                    edited: false
                };

                if (!data.memories) data.memories = [];
                data.memories.unshift(newMemory);
                await saveMemoryData(contact.id, data);

                console.log('[AIMemory] 新记忆已保存');
                showToast('新的记忆已生成！');

                // 自动刷新列表如果当前正打开着
                if (document.getElementById('memory-overlay')?.classList.contains('active')) {
                    renderMemoryList();
                }
            }
        } else {
            // 即使没触发，也要保存最新的 lastTriggerCount (如果它小于当前increment但还没跨越阈值... 不对，lastTriggerCount 应该是已触发的标记)
            // 其实不需要保存，因为我们只在触发时更新 lastTriggerCount
        }

        memoryData = data;
    }

    // ========== 更新单条记忆 ==========
    async function updateMemory(contact, memoryId, newContent) {
        if (!contact || !memoryData) return false;

        const memory = memoryData.memories.find(m => m.id === memoryId);
        if (!memory) return false;

        memory.content = newContent;
        memory.edited = true;
        memory.editedAt = Date.now();

        await saveMemoryData(contact.id, memoryData);
        console.log('[AIMemory] 记忆已更新:', memoryId);
        return true;
    }

    // ========== 删除单条记忆 ==========
    async function deleteMemory(contact, memoryId) {
        if (!contact || !memoryData) return false;

        const index = memoryData.memories.findIndex(m => m.id === memoryId);
        if (index === -1) return false;

        memoryData.memories.splice(index, 1);
        await saveMemoryData(contact.id, memoryData);
        console.log('[AIMemory] 记忆已删除:', memoryId);
        return true;
    }

    // ========== UI渲染 ==========
    function renderMemoryList() {
        const container = document.getElementById('memory-list-container');
        if (!container) return;

        container.innerHTML = '';

        if (!memoryData || !memoryData.memories || memoryData.memories.length === 0) {
            // 修复：计算剩余条数应该是基于当前增量，而不是上次触发值
            const historyCount = window.currentOpenContact?.history?.length || 0;
            const increment = Math.max(0, historyCount - (memoryData.baseCount || 0));

            // 计算距离下一个阈值还差多少
            // 例如：increment=10, threshold=80. 80 - (10 % 80) = 70.
            // 例如：increment=80. 80 - (80 % 80) = 80. (此时应该触发了，如果没触发，显示0？不，显示80说明下一轮)
            // 如果正好是0 (即刚刚初始化), remaining = 80.
            let remaining = CONFIG.MEMORY_THRESHOLD - (increment % CONFIG.MEMORY_THRESHOLD);
            if (remaining === 0) remaining = CONFIG.MEMORY_THRESHOLD; // 防止显示为0

            container.innerHTML = `
                <div class="memory-empty-state">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                        <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm0 18a8 8 0 1 1 8-8 8 8 0 0 1-8 8z"/>
                        <path d="M12 6v6l4 2"/>
                    </svg>
                    <h3>暂无记忆</h3>
                    <p>再聊 ${remaining} 条消息<br>解锁新的记忆</p>
                </div>
            `;
            return;
        }

        memoryData.memories.forEach((memory, index) => {
            const card = createMemoryCard(memory, index);
            container.appendChild(card);
        });
    }

    function createMemoryCard(memory, index) {
        const div = document.createElement('div');
        div.className = 'memory-card';
        div.dataset.memoryId = memory.id;

        const editedBadge = memory.edited ? '<span class="memory-edited-badge">已编辑</span>' : '';

        div.innerHTML = `
            <div class="memory-card-header">
                <div class="memory-card-meta">
                    <span class="memory-card-index">#${memoryData.memories.length - index}</span>
                    <span class="memory-card-time">${formatRelativeTime(memory.timestamp)}</span>
                    ${editedBadge}
                </div>
                <div class="memory-card-actions">
                    <button class="memory-action-btn memory-edit-btn" data-action="edit" title="编辑">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                        </svg>
                    </button>
                    <button class="memory-action-btn memory-delete-btn" data-action="delete" title="删除">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="3 6 5 6 21 6"/>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                        </svg>
                    </button>
                </div>
            </div>
            <div class="memory-card-content">${formatMemoryContent(memory.content)}</div>
            <div class="memory-card-footer">
                <span class="memory-range">消息 ${memory.messageRange?.start || '?'} - ${memory.messageRange?.end || '?'}</span>
            </div>
        `;

        // 编辑按钮
        div.querySelector('.memory-edit-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            openEditModal(memory);
        });

        // 删除按钮
        div.querySelector('.memory-delete-btn').addEventListener('click', async (e) => {
            e.stopPropagation();
            if (confirm('确定要删除这条记忆吗？')) {
                const success = await deleteMemory(window.currentOpenContact, memory.id);
                if (success) {
                    div.remove();
                    showToast('记忆已删除');
                    // 如果没有记忆了，重新渲染空状态
                    if (memoryData.memories.length === 0) {
                        renderMemoryList();
                    }
                }
            }
        });

        return div;
    }

    function formatMemoryContent(content) {
        if (!content) return '';
        // 将每行转换为列表项
        return content.split('\n')
            .filter(line => line.trim())
            .map(line => `<div class="memory-item">${line.trim()}</div>`)
            .join('');
    }

    // ========== 编辑弹窗 ==========
    function openEditModal(memory) {
        let modal = document.getElementById('memory-edit-modal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'memory-edit-modal';
            modal.className = 'memory-modal-overlay';
            modal.innerHTML = `
                <div class="memory-modal-content">
                    <div class="memory-modal-header">
                        <h3>编辑记忆</h3>
                        <button class="memory-modal-close" id="memory-modal-close">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <line x1="18" y1="6" x2="6" y2="18"/>
                                <line x1="6" y1="6" x2="18" y2="18"/>
                            </svg>
                        </button>
                    </div>
                    <div class="memory-modal-body">
                        <textarea id="memory-edit-textarea" placeholder="编辑记忆内容..."></textarea>
                    </div>
                    <div class="memory-modal-footer">
                        <button class="memory-modal-btn secondary" id="memory-cancel-btn">取消</button>
                        <button class="memory-modal-btn primary" id="memory-save-btn">保存</button>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);
        }

        const textarea = modal.querySelector('#memory-edit-textarea');
        textarea.value = memory.content;
        modal.dataset.memoryId = memory.id;
        modal.classList.add('active');

        // 绑定事件
        const closeBtn = modal.querySelector('#memory-modal-close');
        const cancelBtn = modal.querySelector('#memory-cancel-btn');
        const saveBtn = modal.querySelector('#memory-save-btn');

        const closeModal = () => modal.classList.remove('active');

        closeBtn.onclick = closeModal;
        cancelBtn.onclick = closeModal;
        modal.onclick = (e) => {
            if (e.target === modal) closeModal();
        };

        saveBtn.onclick = async () => {
            const newContent = textarea.value.trim();
            if (!newContent) {
                alert('记忆内容不能为空');
                return;
            }

            const success = await updateMemory(window.currentOpenContact, memory.id, newContent);
            if (success) {
                closeModal();
                renderMemoryList();
                showToast('记忆已更新');
            }
        };
    }

    // ========== 打开/关闭记忆页面 ==========
    function openMemoryPage() {
        const overlay = document.getElementById('memory-overlay');
        if (overlay) {
            overlay.classList.add('active');
            overlay.classList.remove('closing');
        }

        if (window.currentOpenContact) {
            initAIMemory(window.currentOpenContact).then(() => {
                renderMemoryList();
            });
        }
    }

    function closeMemoryPage() {
        const overlay = document.getElementById('memory-overlay');
        if (overlay) {
            overlay.classList.add('closing');
            setTimeout(() => {
                overlay.classList.remove('active', 'closing');
                clearMemoryCache();
            }, 300);
        }
    }

    // ========== 事件绑定 ==========
    function bindEvents() {
        // 入口按钮（使用事件委托）
        document.addEventListener('click', (e) => {
            if (e.target.closest('#memory-entry-btn')) {
                openMemoryPage();
            }
        });

        // 返回按钮
        document.addEventListener('click', (e) => {
            if (e.target.closest('#memory-back-btn')) {
                closeMemoryPage();
            }
        });

        // 自动总结开关
        const toggleBtn = document.getElementById('memory-auto-toggle');
        if (toggleBtn) {
            // 初始化状态
            const savedState = localStorage.getItem('aimemory_enabled');
            if (savedState !== null) {
                isAutoSummaryEnabled = savedState === 'true';
            }
            toggleBtn.checked = isAutoSummaryEnabled;

            // 监听变更
            toggleBtn.addEventListener('change', (e) => {
                isAutoSummaryEnabled = e.target.checked;
                localStorage.setItem('aimemory_enabled', isAutoSummaryEnabled);
                console.log('[AIMemory] 自动总结开关:', isAutoSummaryEnabled ? 'ON' : 'OFF');

                if (isAutoSummaryEnabled) {
                    showToast('自动记忆已开启');
                } else {
                    showToast('自动记忆已关闭');
                }
            });
        }
    }

    // ========== 获取记忆文本（供聊天注入） ==========
    async function getMemoriesText(contactId) {
        if (!contactId) return '';

        const data = await loadMemoryData(contactId);
        if (!data || !data.memories || data.memories.length === 0) {
            return '';
        }

        // 将所有记忆合并成文本
        const memoriesText = data.memories
            .map(m => m.content)
            .join('\n\n');

        return memoriesText;
    }

    // ========== 暴露全局API ==========
    window.AIMemory = {
        init: initAIMemory,
        open: openMemoryPage,
        close: closeMemoryPage,
        checkTrigger: checkAndTriggerMemory,
        clearCache: clearMemoryCache,
        deleteData: deleteMemoryData,
        getData: loadMemoryData,
        getMemoriesText: getMemoriesText
    };

    // DOM Ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', bindEvents);
    } else {
        bindEvents();
    }

    console.log('[AIMemory] 模块已加载');
})();
