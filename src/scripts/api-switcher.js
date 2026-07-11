/**
 * API Switcher Control Center
 * 双击状态栏呼出的快速 API/模型切换控制中心
 * 仿 iOS 控制中心风格
 */

(function () {
    'use strict';

    // ========================
    // 1. 状态变量
    // ========================
    let apiSwitcherState = {
        isOpen: false,
        currentApiId: null,
        currentModel: null,
        apiLibrary: [],
        modelList: [],
        isConnecting: false,
        tapCount: 0,
        tapTimer: null
    };

    // 触摸检测配置
    const TAP_THRESHOLD_Y = 50; // 仅在屏幕顶部50px内响应 (其实由CSS控制了区域，这里辅助判断)
    const TAP_DELAY = 300; // 双击判断时间窗


    // ========================
    // 2. DOM 创建
    // ========================
    function createApiSwitcherDOM() {
        // 如果已存在则跳过
        if (document.getElementById('api-switcher-overlay')) return;

        const overlay = document.createElement('div');
        overlay.id = 'api-switcher-overlay';
        overlay.className = 'api-switcher-overlay';

        overlay.innerHTML = `
      <div class="api-switcher-panel" id="api-switcher-panel">
        <div class="api-switcher-handle"></div>
        
        <div class="api-switcher-header">
          <div class="api-switcher-title">API Center</div>
          <div class="api-switcher-status" id="api-switcher-status">
            <div class="api-switcher-status-dot disconnected" id="api-switcher-status-dot"></div>
            <span id="api-switcher-status-text">未连接</span>
          </div>
        </div>

        <div>
          <div class="api-switcher-section-label">API 配置</div>
          <div class="api-switcher-grid" id="api-switcher-grid">
            <!-- API 按钮将在这里动态生成 -->
          </div>
        </div>

        <div>
          <div class="api-switcher-section-label">选择模型</div>
          <div class="api-switcher-model-container">
            <div class="api-switcher-loader" id="api-switcher-loader" style="display: none;"></div>
            <div class="api-switcher-model-list" id="api-switcher-model-list">
              <div class="api-switcher-empty">请先选择一个 API 配置</div>
            </div>
          </div>
        </div>

        <button class="api-switcher-done-btn" id="api-switcher-done-btn">完成</button>
      </div>
    `;

        document.body.appendChild(overlay);

        // 绑定事件
        bindApiSwitcherEvents(overlay);
    }

    // ========================
    // 3. 事件绑定
    // ========================
    function bindApiSwitcherEvents(overlay) {
        const panel = document.getElementById('api-switcher-panel');
        const doneBtn = document.getElementById('api-switcher-done-btn');
        const apiGrid = document.getElementById('api-switcher-grid');
        const modelList = document.getElementById('api-switcher-model-list');

        // 点击遮罩关闭
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                closeApiSwitcher();
            }
        });

        // 阻止面板点击冒泡
        panel.addEventListener('click', (e) => {
            e.stopPropagation();
        });

        // 完成按钮
        doneBtn.addEventListener('click', closeApiSwitcher);

        // API 选择事件委托
        apiGrid.addEventListener('click', (e) => {
            const btn = e.target.closest('.api-switcher-btn');
            if (btn) {
                const apiId = parseInt(btn.dataset.apiId, 10);
                selectApi(apiId);
            }
        });

        // 模型选择事件委托
        modelList.addEventListener('click', (e) => {
            const item = e.target.closest('.api-switcher-model-item');
            if (item) {
                const modelId = item.dataset.modelId;
                selectModel(modelId);
            }
        });
    }

    // ========================
    // 4. 打开/关闭控制中心
    // ========================
    function openApiSwitcher() {
        const overlay = document.getElementById('api-switcher-overlay');
        if (!overlay) {
            createApiSwitcherDOM();
        }

        // 加载 API 库数据
        loadApiLibrary().then(() => {
            renderApiGrid();
            // 检查是否有当前激活的配置
            restoreCurrentState();
        });

        document.getElementById('api-switcher-overlay').classList.add('active');
        apiSwitcherState.isOpen = true;
        console.log('[API Switcher] 已打开');
    }

    function closeApiSwitcher() {
        const overlay = document.getElementById('api-switcher-overlay');
        if (overlay) {
            overlay.classList.remove('active');
        }
        apiSwitcherState.isOpen = false;
        console.log('[API Switcher] 已关闭');
    }

    function toggleApiSwitcher() {
        if (apiSwitcherState.isOpen) {
            closeApiSwitcher();
        } else {
            openApiSwitcher();
        }
    }

    // ========================
    // 5. 数据加载
    // ========================
    async function loadApiLibrary() {
        try {
            if (!window.dbHelper) {
                console.warn('[API Switcher] dbHelper 不可用');
                apiSwitcherState.apiLibrary = [];
                return;
            }

            const libraryData = await window.dbHelper.loadData('settingsStore', 'apiLibrary');
            apiSwitcherState.apiLibrary = (libraryData && Array.isArray(libraryData.value))
                ? libraryData.value
                : [];

            // 也加载当前设置中的 API (作为默认选项)
            const apiSettingsData = await window.dbHelper.loadData('settingsStore', 'apiSettings');
            if (apiSettingsData && apiSettingsData.value) {
                const currentSettings = apiSettingsData.value;
                // 记录当前使用的配置
                apiSwitcherState.currentApiSettings = currentSettings;
            }

            console.log('[API Switcher] 加载了', apiSwitcherState.apiLibrary.length, '个 API 配置');
        } catch (error) {
            console.error('[API Switcher] 加载 API 库失败:', error);
            apiSwitcherState.apiLibrary = [];
        }
    }

    async function restoreCurrentState() {
        // 尝试恢复当前选中的 API 和模型
        if (apiSwitcherState.currentApiSettings) {
            const currentUrl = apiSwitcherState.currentApiSettings.url;
            const currentModel = apiSwitcherState.currentApiSettings.model;

            // 在库中查找匹配的配置 (同时匹配 URL 和 Key，防止不同配置使用相同 URL 导致识别错误)
            const matchedApi = apiSwitcherState.apiLibrary.find(api =>
                api.url === currentUrl && (api.key === apiSwitcherState.currentApiSettings.key)
            );

            if (matchedApi) {
                apiSwitcherState.currentApiId = matchedApi.id;
                apiSwitcherState.currentModel = currentModel;

                // 更新 UI
                updateApiGridSelection();

                // 尝试连接并加载模型列表
                await connectAndLoadModels(matchedApi);
            }
        }
    }

    // ========================
    // 6. 渲染 API 网格
    // ========================
    function renderApiGrid() {
        const grid = document.getElementById('api-switcher-grid');
        if (!grid) return;

        if (apiSwitcherState.apiLibrary.length === 0) {
            grid.innerHTML = `
        <div class="api-switcher-empty" style="grid-column: 1 / -1;">
          暂无 API 配置<br>
          <span style="font-size: 12px; opacity: 0.7;">请在设置中添加 API 配置</span>
        </div>
      `;
            return;
        }

        // 生成 API 按钮 (最多显示 6 个)
        const displayApis = apiSwitcherState.apiLibrary.slice(0, 6);

        grid.innerHTML = displayApis.map(api => {
            const isActive = api.id === apiSwitcherState.currentApiId;
            const icon = getApiIcon(api.name);

            return `
        <div class="api-switcher-btn ${isActive ? 'active' : ''}" data-api-id="${api.id}">
          <div class="api-switcher-btn-icon">${icon}</div>
          <div class="api-switcher-btn-label">${api.name}</div>
        </div>
      `;
        }).join('');
    }

    function getApiIcon(name) {
        const nameLower = (name || '').toLowerCase();
        if (nameLower.includes('openai') || nameLower.includes('gpt')) return 'GPT';
        if (nameLower.includes('claude') || nameLower.includes('anthropic')) return 'ANTHTOPIC';
        if (nameLower.includes('gemini') || nameLower.includes('google')) return 'GOOGLE';
        if (nameLower.includes('local') || nameLower.includes('ollama')) return 'OLLAMA';
        if (nameLower.includes('deepseek')) return 'DEEPSEEK';
        if (nameLower.includes('qwen') || nameLower.includes('通义')) return 'TONGYI';
        return 'API';
    }

    function updateApiGridSelection() {
        const grid = document.getElementById('api-switcher-grid');
        if (!grid) return;

        grid.querySelectorAll('.api-switcher-btn').forEach(btn => {
            const apiId = parseInt(btn.dataset.apiId, 10);
            btn.classList.toggle('active', apiId === apiSwitcherState.currentApiId);
        });
    }

    // ========================
    // 7. 选择 API
    // ========================
    async function selectApi(apiId) {
        if (apiSwitcherState.isConnecting) return;

        const api = apiSwitcherState.apiLibrary.find(a => a.id === apiId);
        if (!api) return;

        apiSwitcherState.currentApiId = apiId;
        updateApiGridSelection();

        // 连接并加载模型列表
        await connectAndLoadModels(api);
    }

    // ========================
    // 8. 连接并加载模型
    // ========================
    async function connectAndLoadModels(api) {
        const loader = document.getElementById('api-switcher-loader');
        const modelList = document.getElementById('api-switcher-model-list');
        const statusDot = document.getElementById('api-switcher-status-dot');
        const statusText = document.getElementById('api-switcher-status-text');

        apiSwitcherState.isConnecting = true;

        // 显示加载状态
        if (loader) loader.style.display = 'block';
        if (modelList) modelList.innerHTML = '';
        if (statusDot) {
            statusDot.className = 'api-switcher-status-dot connecting';
        }
        if (statusText) statusText.textContent = '连接中...';

        try {
            // 构建 API endpoint
            let baseUrl = api.url.trim();
            if (!baseUrl.startsWith('http')) baseUrl = 'https://' + baseUrl;
            if (baseUrl.endsWith('/')) baseUrl = baseUrl.slice(0, -1);

            let endpointUrl = baseUrl;
            let headers = {};

            if (baseUrl.includes('googleapis.com')) {
                // Google API 逻辑
                if (!baseUrl.includes('/v1') && !baseUrl.includes('/models')) {
                    endpointUrl = `${baseUrl}/v1beta/models`;
                } else if (!baseUrl.endsWith('/models')) {
                    endpointUrl = `${baseUrl}/models`;
                }
                headers = { 'x-goog-api-key': api.key };
            } else {
                // OpenAI / 通用逻辑
                endpointUrl += '/models';
                headers = { 'Authorization': `Bearer ${api.key}` };
            }

            const response = await fetch(endpointUrl, {
                headers: headers
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const data = await response.json();
            const models = data.data || [];

            apiSwitcherState.modelList = models;

            // 更新状态为已连接
            if (statusDot) {
                statusDot.className = 'api-switcher-status-dot connected';
            }
            if (statusText) statusText.textContent = '已连接';

            // 渲染模型列表
            renderModelList(models, api.model);

        } catch (error) {
            console.error('[API Switcher] 连接失败:', error);

            if (statusDot) {
                statusDot.className = 'api-switcher-status-dot disconnected';
            }
            if (statusText) statusText.textContent = '连接失败';

            if (modelList) {
                modelList.innerHTML = `
          <div class="api-switcher-empty" style="color: #ff3b30;">
            连接失败<br>
            <span style="font-size: 12px; opacity: 0.7;">${error.message}</span>
          </div>
        `;
            }
        } finally {
            if (loader) loader.style.display = 'none';
            apiSwitcherState.isConnecting = false;
        }
    }

    // ========================
    // 9. 渲染模型列表
    // ========================
    function renderModelList(models, currentModel) {
        const listContainer = document.getElementById('api-switcher-model-list');
        if (!listContainer) return;

        if (!models || models.length === 0) {
            listContainer.innerHTML = `
        <div class="api-switcher-empty">
          没有找到可用模型
        </div>
      `;
            return;
        }

        listContainer.innerHTML = models.map(model => {
            const modelId = model.id || model.name || model;
            const isSelected = modelId === currentModel || modelId === apiSwitcherState.currentModel;

            return `
        <div class="api-switcher-model-item ${isSelected ? 'selected' : ''}" data-model-id="${modelId}">
          <span class="api-switcher-model-name">${modelId}</span>
          <div class="api-switcher-model-check"></div>
        </div>
      `;
        }).join('');

        // 如果找到当前选中的模型，更新状态
        if (currentModel) {
            apiSwitcherState.currentModel = currentModel;
        }
    }

    // ========================
    // 10. 选择模型
    // ========================
    async function selectModel(modelId) {
        apiSwitcherState.currentModel = modelId;

        // 更新 UI
        const listContainer = document.getElementById('api-switcher-model-list');
        if (listContainer) {
            listContainer.querySelectorAll('.api-switcher-model-item').forEach(item => {
                item.classList.toggle('selected', item.dataset.modelId === modelId);
            });
        }

        // 应用配置到设置界面
        await applyConfiguration();
    }

    // ========================
    // 11. 应用配置
    // ========================
    async function applyConfiguration() {
        const api = apiSwitcherState.apiLibrary.find(a => a.id === apiSwitcherState.currentApiId);
        if (!api) return;

        const selectedModel = apiSwitcherState.currentModel;

        try {
            // 更新设置页面的输入框
            const apiUrlInput = document.getElementById('api-url');
            const apiKeyInput = document.getElementById('api-key');
            const modelSelect = document.getElementById('api-model');
            const tempSlider = document.getElementById('temperature-slider');
            const tempValue = document.getElementById('temperature-value');

            if (apiUrlInput) apiUrlInput.value = api.url;
            if (apiKeyInput) apiKeyInput.value = api.key;

            if (modelSelect) {
                // 确保模型选项存在
                // 增强安全性：处理 selectedModel 为 null, undefined 或包含特殊字符的情况
                if (selectedModel) {
                    // 简单转义或使用 CSS.escape (如果浏览器支持，但这里用更稳妥的 try-catch 或属性查找)
                    let optionExists = false;
                    try {
                        // 尝试直接通过 value 查找 (比 querySelector 安全)
                        optionExists = Array.from(modelSelect.options).some(opt => opt.value === selectedModel);
                    } catch (e) { console.warn("Model check failed", e); }

                    if (!optionExists) {
                        const newOption = document.createElement('option');
                        newOption.value = selectedModel;
                        newOption.textContent = selectedModel;
                        modelSelect.appendChild(newOption);
                    }
                    modelSelect.value = selectedModel;
                }
                modelSelect.disabled = false;

                // 更新显示层 (如果存在)
                const modelDisplayName = document.getElementById('model-display-name');
                const modelDisplayDesc = document.getElementById('model-display-desc');
                if (modelDisplayName) modelDisplayName.textContent = selectedModel;
                if (modelDisplayDesc) modelDisplayDesc.textContent = 'Active Model';
            }

            if (tempSlider && api.temperature !== undefined) {
                tempSlider.value = api.temperature;
                if (tempValue) tempValue.textContent = api.temperature.toFixed(1);
                // 触发滑块进度更新
                const event = new Event('input', { bubbles: true });
                tempSlider.dispatchEvent(event);
            }

            // 保存到数据库
            // 修复：防止空 Key 覆盖现有 Key
            let keyToSave = api.key;
            if (!keyToSave) {
                // 如果 Library 中的 Key 是空的，尝试保留 Setting 中原有的 Key (前提是 URL 匹配)
                const currentSettings = await window.dbHelper.loadData('settingsStore', 'apiSettings');
                if (currentSettings && currentSettings.value && currentSettings.value.url === api.url) {
                    keyToSave = currentSettings.value.key;
                    console.log('[API Switcher] 继承原有 Key 以防止覆盖为空');
                }
            }

            // 安全防线：如果仍为空，且不是故意清空，则发出警告（可选）

            const newSettings = {
                url: api.url,
                key: keyToSave, // 使用安全 Key
                model: selectedModel,
                temperature: api.temperature || 1.0
            };

            await window.dbHelper.saveData('settingsStore', 'apiSettings', newSettings);

            // 更新 API 库中该配置的最后使用时间
            api.lastUsed = new Date().toISOString();
            await window.dbHelper.saveData('settingsStore', 'apiLibrary', apiSwitcherState.apiLibrary);

            console.log('[API Switcher] 配置已应用:', api.name, selectedModel);

        } catch (error) {
            console.error('[API Switcher] 应用配置失败:', error);
        }
    }

    // ========================
    // 12. 双击状态栏检测
    // ========================
    function setupStatusBarDoubleTap() {
        // 创建一个透明的触摸区域覆盖在状态栏上面
        // 修改：直接挂载到 body 上，并设为 fixed 定位，确保最顶层

        // 检查是否已存在触摸区域
        if (document.getElementById('status-bar-touch-area')) return;

        const touchArea = document.createElement('div');
        touchArea.id = 'status-bar-touch-area';
        touchArea.className = 'status-bar-touch-area'; // CSS 会被修改为 fixed

        document.body.appendChild(touchArea);

        // 绑定双击/双触事件
        touchArea.addEventListener('touchend', handleTap);
        touchArea.addEventListener('click', handleTap);

        console.log('[API Switcher] 状态栏双击检测已启用 (Body Fixed Mode)');
    }

    function handleTap(e) {
        // 防止事件穿透和默认行为
        e.preventDefault();
        e.stopPropagation();

        // 视觉反馈：在点击位置显示一个小波纹或指示器 (暂略，因为想要无痕)
        // 简单震动反馈 (如果支持)
        if (navigator.vibrate) {
            navigator.vibrate(10);
        }

        // 双击检测逻辑优化
        apiSwitcherState.tapCount++;

        if (apiSwitcherState.tapTimer) {
            clearTimeout(apiSwitcherState.tapTimer);
        }

        apiSwitcherState.tapTimer = setTimeout(() => {
            // 如果是双击 (或者更多击)
            if (apiSwitcherState.tapCount >= 2) {
                console.log('[API Switcher] 顶部双击触发');
                toggleApiSwitcher();
            } else {
                // 单击也可以触发，或者设为单击仅提示
                // 考虑到“隐形”如果单击触发太容易误触，保持双击
                // 为了更好的体验，可以给用户一个 subtle 的提示
                console.log('[API Switcher] 顶部单击 (未触发，请双击)');
            }
            apiSwitcherState.tapCount = 0;
        }, TAP_DELAY);
    }

    // ========================
    // 13. 初始化
    // ========================
    function init() {
        // 等待 DOM 加载完成
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', onReady);
        } else {
            onReady();
        }
    }

    function onReady() {
        // 延迟初始化，确保其他脚本已加载
        setTimeout(() => {
            createApiSwitcherDOM();
            setupStatusBarDoubleTap();
        }, 500);
    }

    // 暴露全局方法
    window.ApiSwitcher = {
        open: openApiSwitcher,
        close: closeApiSwitcher,
        toggle: toggleApiSwitcher
    };

    // 启动
    init();

})();
