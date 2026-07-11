/**
 * Image Generation Module
 * AI 生图功能 - 支持 OpenAI 兼容的图片生成 API
 * 通过 Hook universalApiRequest 注入生图能力指令
 * 通过 MutationObserver 检测 AI 回复中的 生图：指令并调用生图 API
 */

(function () {
  'use strict';

  // ========================
  // 1. 状态与配置
  // ========================
  const STORE_KEY = 'imageGenSettings';
  const DB_STORE = 'settingsStore';

  let state = {
    enabled: false,
    url: '',
    key: '',
    model: '',
    size: '1024x1024',
    defaultPrompt: 'high quality, photorealistic, detailed',
    useMainApi: false, // 是否复用聊天API配置
    isSettingsOpen: false,
    modelList: [],
    isGenerating: false
  };

  let observer = null;

  // ========================
  // 1.5 图片缓存 (IndexedDB)
  // ========================
  const IMAGE_CACHE_STORE = 'imageGenCache';

  function hashPrompt(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash |= 0;
    }
    return 'img_' + Math.abs(hash).toString(36);
  }

  async function getCachedImage(description) {
    try {
      if (!window.dbHelper) return null;
      const key = hashPrompt(effectiveCacheDesc(description));
      const data = await window.dbHelper.loadData(IMAGE_CACHE_STORE, key);
      if (data && data.value && data.value.url) {
        console.log('[ImageGen] Cache hit for:', description.slice(0, 40));
        return data.value.url;
      }
    } catch (e) {
      console.warn('[ImageGen] Cache read failed:', e);
    }
    return null;
  }

  async function setCachedImage(description, url) {
    try {
      if (!window.dbHelper) return;
      const key = hashPrompt(effectiveCacheDesc(description));
      await window.dbHelper.saveData(IMAGE_CACHE_STORE, key, { url, description, timestamp: Date.now() });
      console.log('[ImageGen] Cached image for:', description.slice(0, 40));
    } catch (e) {
      console.warn('[ImageGen] Cache write failed:', e);
    }
  }

  async function removeCachedImage(description) {
    try {
      if (!window.dbHelper) return;
      const key = hashPrompt(effectiveCacheDesc(description));
      await window.dbHelper.deleteData(IMAGE_CACHE_STORE, key);
    } catch (e) {
      console.warn('[ImageGen] Cache delete failed:', e);
    }
  }

  // 生成含参考图信息的缓存描述（相同 prompt + 不同参考图 → 不同缓存条目）
  function effectiveCacheDesc(description) {
    if (window.currentOpenContact && window.currentOpenContact.imageRef) {
      return description + '|ref:' + hashPrompt(window.currentOpenContact.imageRef.slice(0, 200));
    }
    return description;
  }

  // ========================
  // 2. 数据持久化
  // ========================
  async function loadSettings() {
    try {
      if (!window.dbHelper) {
        console.warn('[ImageGen] dbHelper not available yet');
        return;
      }
      const data = await window.dbHelper.loadData(DB_STORE, STORE_KEY);
      if (data && data.value) {
        Object.assign(state, data.value);
        console.log('[ImageGen] Settings loaded:', { enabled: state.enabled, model: state.model });
      }
    } catch (e) {
      console.error('[ImageGen] Failed to load settings:', e);
    }
  }

  async function saveSettings() {
    try {
      if (!window.dbHelper) return;
      const toSave = {
        enabled: state.enabled,
        url: state.url,
        key: state.key,
        model: state.model,
        size: state.size,
        defaultPrompt: state.defaultPrompt,
        useMainApi: state.useMainApi
      };
      await window.dbHelper.saveData(DB_STORE, STORE_KEY, toSave);
      console.log('[ImageGen] Settings saved');
    } catch (e) {
      console.error('[ImageGen] Failed to save settings:', e);
    }
  }

  // ========================
  // 3. 获取当前角色的生图提示词
  // ========================
  function getCharacterImagePrompt() {
    const contact = window.currentOpenContact;
    if (!contact) return '';
    return contact.imagePrompt || '';
  }

  // ========================
  // 4. 获取有效的 API 配置
  // ========================
  async function getEffectiveApiConfig() {
    if (state.useMainApi) {
      // 复用聊天 API 配置 (仅 URL 和 Key)
      try {
        const mainSettings = await window.dbHelper.loadData(DB_STORE, 'apiSettings');
        if (mainSettings && mainSettings.value) {
          return {
            url: mainSettings.value.url || state.url,
            key: mainSettings.value.key || state.key,
            model: state.model // 模型仍用生图专用的
          };
        }
      } catch (e) {
        console.warn('[ImageGen] Failed to load main API settings:', e);
      }
    }
    return {
      url: state.url,
      key: state.key,
      model: state.model
    };
  }

  // ========================
  // 5. Hook universalApiRequest - 注入生图能力指令
  // ========================
  function hookApiRequest() {
    const originalFn = window.universalApiRequest;
    if (!originalFn) {
      console.warn('[ImageGen] universalApiRequest not found, retrying...');
      setTimeout(hookApiRequest, 1000);
      return;
    }

    // 避免重复 hook
    if (originalFn._imageGenHooked) return;

    window.universalApiRequest = async function (config, messages, options) {
      if (state.enabled && messages && messages.length > 0 && messages[0].role === 'system') {
        const charPrompt = getCharacterImagePrompt();
        const injection = buildSystemPromptInjection(charPrompt);
        // 深拷贝 messages 避免污染原始数据
        messages = JSON.parse(JSON.stringify(messages));
        messages[0].content += injection;
      }
      return originalFn.call(this, config, messages, options);
    };

    window.universalApiRequest._imageGenHooked = true;
    // 保留原始引用供其他模块使用
    window.universalApiRequest._original = originalFn;
    console.log('[ImageGen] API request hooked successfully');
  }

  function buildSystemPromptInjection(characterPrompt) {
    let injection = '\n\n### 生图能力\n';
    injection += '你具备发送真实图片的能力。当对话场景适合发送图片时（如用户要求看照片、自拍、风景、展示某物、分享日常），';
    injection += '你可以在回复中使用以下指令（必须单独一行）：\n';
    injection += '生图：[用英文详细描述画面内容，包括场景、人物外貌、服装、光线、构图、风格等]\n';
    injection += '注意事项：\n';
    injection += '- 描述必须全部使用英文\n';
    injection += '- 必须单独一行，不可与其他文本或指令混写\n';
    injection += '- 每条回复最多使用一次\n';
    injection += '- 描述要详细具体，至少包含主体、环境、光照三个要素\n';
    if (characterPrompt) {
      injection += '- 你的外貌特征（生图时务必融入描述中）：' + characterPrompt + '\n';
    }
    return injection;
  }

  // ========================
  // 6. MutationObserver - 检测 AI 消息中的生图指令
  // ========================
  function startObserver() {
    const container = document.getElementById('chat-messages-container');
    if (!container) {
      console.warn('[ImageGen] Chat container not found, retrying...');
      setTimeout(startObserver, 1000);
      return;
    }

    if (observer) observer.disconnect();

    observer = new MutationObserver((mutations) => {
      if (!state.enabled) return;

      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node.nodeType !== 1) continue;

          // 查找消息行
          const rows = node.classList && node.classList.contains('message-row')
            ? [node]
            : (node.querySelectorAll ? Array.from(node.querySelectorAll('.message-row')) : []);

          for (const row of rows) {
            processMessageRow(row);
          }
        }
      }
    });

    observer.observe(container, { childList: true, subtree: true });
    console.log('[ImageGen] Observer started');
  }

  function processMessageRow(row) {
    // 只处理 AI 消息
    const wrapper = row.querySelector('.message-content-wrapper.ai') ||
      row.querySelector('.message-content-wrapper:not(.user)');
    if (!wrapper) return;

    // 查找文本气泡
    const bubbles = wrapper.querySelectorAll('.chat-bubble');
    for (const bubble of bubbles) {
      // 跳过已处理的
      if (bubble.dataset.imageGenProcessed) continue;

      const text = bubble.textContent || '';
      const match = text.match(/^生图：(.+)$/m) || text.match(/生图：(.+)/);
      if (!match) continue;

      bubble.dataset.imageGenProcessed = 'true';
      const description = match[1].trim();

      // 如果整个气泡只是生图指令，替换整个气泡
      const fullText = text.trim();
      if (fullText === '生图：' + description || fullText === match[0].trim()) {
        handleImageGeneration(description, bubble, wrapper, 'replace');
      } else {
        // 气泡包含其他文字，移除生图指令行，在下方插入图片卡
        removeLineFromBubble(bubble, match[0]);
        handleImageGeneration(description, bubble, wrapper, 'append');
      }
    }
  }

  function removeLineFromBubble(bubble, lineText) {
    const html = bubble.innerHTML;
    // 尝试移除包含该文字的行
    const escaped = lineText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp('(<br\\s*/?>)?\\s*' + escaped + '\\s*(<br\\s*/?>)?', 'i');
    bubble.innerHTML = html.replace(regex, '').replace(/^(<br\s*\/?>)+|(<br\s*\/?>)+$/g, '');
  }

  // ========================
  // 7. 图片生成与渲染
  // ========================
  async function handleImageGeneration(description, bubble, wrapper, mode) {
    // 先检查缓存
    const cachedUrl = await getCachedImage(description);

    if (cachedUrl) {
      const card = createImageCard('loading');
      insertCard(card, bubble, mode);
      renderImageResult(card, cachedUrl, description);
      return;
    }

    const card = createImageCard('loading');
    insertCard(card, bubble, mode);

    try {
      const imageUrl = await callImageGenApi(description);
      await setCachedImage(description, imageUrl);
      renderImageResult(card, imageUrl, description);
    } catch (err) {
      console.error('[ImageGen] Generation failed:', err);
      renderImageError(card, err.message, description);
    }
  }

  function insertCard(card, bubble, mode) {
    if (mode === 'replace') {
      bubble.style.display = 'none';
      bubble.parentNode.insertBefore(card, bubble.nextSibling);
    } else {
      const nextEl = bubble.nextSibling;
      if (nextEl) {
        bubble.parentNode.insertBefore(card, nextEl);
      } else {
        bubble.parentNode.appendChild(card);
      }
    }
  }

  function createImageCard(status) {
    const card = document.createElement('div');
    card.className = 'image-gen-card';
    card.dataset.status = status;

    if (status === 'loading') {
      card.classList.add('loading');
      card.innerHTML = `
        <div class="image-gen-loading">
          <div class="image-gen-loading-spinner"></div>
          <span class="image-gen-loading-text">生成图片中...</span>
        </div>
      `;
    }

    return card;
  }

  function renderImageResult(card, imageUrl, description) {
    card.dataset.status = 'success';
    card.dataset.description = description || '';
    card.classList.remove('loading');
    card.innerHTML = `
      <div class="image-gen-result">
        <img src="${imageUrl}" alt="AI Generated" loading="lazy" />
      </div>
    `;
    card.classList.add('image-gen-loaded');

    const img = card.querySelector('img');
    img.addEventListener('click', () => showImageFullscreen(imageUrl, description));
    img.addEventListener('load', () => {
      img.classList.add('loaded');
      card.classList.add('image-gen-visible');
    });
    img.addEventListener('error', () => {
      // 旧缓存里若是已过期的远程 URL，加载会失败。清掉坏缓存，
      // 这样用户重试或 AI 再次生图时会走新逻辑（下载转 base64 持久化）。
      if (typeof imageUrl === 'string' && !imageUrl.startsWith('data:')) {
        removeCachedImage(description);
        renderImageError(card, '图片链接已过期，请点重试重新生成', description);
      } else {
        renderImageError(card, '图片加载失败', '');
      }
    });
  }

  function renderImageError(card, message, originalPrompt) {
    card.dataset.status = 'error';
    card.classList.remove('loading');
    card.innerHTML = `
      <div class="image-gen-error">
        <div class="image-gen-error-icon">⚠️</div>
        <div class="image-gen-error-text">${message || '生图失败'}</div>
        ${originalPrompt ? `<button class="image-gen-retry-btn" onclick="window.ImageGen.retry(this, '${encodeURIComponent(originalPrompt)}')">重试</button>` : ''}
      </div>
    `;
  }

  function showImageFullscreen(url, description) {
    let overlay = document.getElementById('image-gen-fullscreen');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'image-gen-fullscreen';
      overlay.className = 'image-gen-viewer-overlay';
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
          overlay.classList.remove('active');
          setTimeout(() => { overlay.style.display = 'none'; }, 300);
        }
      });
      document.body.appendChild(overlay);
    }

    overlay.innerHTML = `
      <div class="image-gen-viewer-toolbar">
        <button class="image-gen-viewer-btn" id="image-gen-viewer-regenerate" title="重新生成">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="23 4 23 10 17 10"></polyline>
            <polyline points="1 20 1 14 7 14"></polyline>
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10"></path>
            <path d="M20.49 15a9 9 0 0 1-14.85 3.36L1 14"></path>
          </svg>
        </button>
        <button class="image-gen-viewer-btn" id="image-gen-viewer-save" title="保存图片">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
            <polyline points="7 10 12 15 17 10"></polyline>
            <line x1="12" y1="15" x2="12" y2="3"></line>
          </svg>
        </button>
      </div>
      <img src="${url}" alt="Full size" />
    `;
    overlay.style.display = 'flex';
    requestAnimationFrame(() => overlay.classList.add('active'));

    // 重新生成
    const regenBtn = overlay.querySelector('#image-gen-viewer-regenerate');
    regenBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (!description) return;
      overlay.classList.remove('active');
      setTimeout(() => { overlay.style.display = 'none'; }, 300);
      await regenerateFromViewer(description);
    });

    // 保存图片
    const saveBtn = overlay.querySelector('#image-gen-viewer-save');
    saveBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      saveImageToFile(url);
    });
  }

  async function regenerateFromViewer(description) {
    const cards = document.querySelectorAll('.image-gen-card[data-status="success"]');
    let targetCard = null;
    for (const card of cards) {
      if (card.dataset.description === description) {
        targetCard = card;
        break;
      }
    }
    if (!targetCard) return;

    await removeCachedImage(description);

    targetCard.dataset.status = 'loading';
    targetCard.classList.add('loading');
    targetCard.classList.remove('image-gen-loaded', 'image-gen-visible');
    targetCard.innerHTML = `
      <div class="image-gen-loading">
        <div class="image-gen-loading-spinner"></div>
        <span class="image-gen-loading-text">重新生成中...</span>
      </div>
    `;

    try {
      const imageUrl = await callImageGenApi(description);
      await setCachedImage(description, imageUrl);
      renderImageResult(targetCard, imageUrl, description);
    } catch (err) {
      renderImageError(targetCard, err.message, description);
    }
  }

  function saveImageToFile(url) {
    const filename = 'ai-image-' + Date.now() + '.png';

    function triggerDownload(blobUrl) {
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
    }

    if (url.startsWith('data:')) {
      // data URL 转 Blob 再下载（直接用 data URL 在部分浏览器不触发下载）
      try {
        const blob = dataUrlToBlob(url);
        triggerDownload(URL.createObjectURL(blob));
      } catch (e) {
        console.warn('[ImageGen] Data URL download failed:', e);
        window.open(url, '_blank');
      }
    } else {
      fetch(url)
        .then(r => r.blob())
        .then(blob => triggerDownload(URL.createObjectURL(blob)))
        .catch(() => window.open(url, '_blank'));
    }
  }

  // ========================
  // 8. API 调用
  // ========================
  const PERSON_KEYWORDS = /\b(person|people|man|woman|girl|boy|guy|lady|selfie|portrait|face|smile|smiling|looking|standing|sitting|lying|walking|wearing|dress|outfit|clothes|hair|eyes|holding|posing|herself|himself|myself|character|figure|model|couple|lover|friend|he |she |his |her |i |me |my )\b/i;

  function sceneNeedsPerson(description) {
    return PERSON_KEYWORDS.test(description);
  }

  async function callImageGenApi(sceneDescription) {
    const config = await getEffectiveApiConfig();

    if (!config.url || !config.key) {
      throw new Error('请先配置生图 API');
    }
    if (!config.model) {
      throw new Error('请先选择生图模型');
    }

    // 组装最终 prompt
    const charPrompt = getCharacterImagePrompt();
    const parts = [];
    if (state.defaultPrompt) parts.push(state.defaultPrompt);
    if (charPrompt && sceneNeedsPerson(sceneDescription)) {
      parts.push(charPrompt);
    }
    parts.push(sceneDescription);
    const finalPrompt = parts.join(', ');

    console.log('[ImageGen] Final prompt:', finalPrompt);
    console.log('[ImageGen] Model:', config.model, 'Size:', state.size);

    // 检查是否有参考图
    const imageRef = window.currentOpenContact && window.currentOpenContact.imageRef;

    // 构建 URL：有参考图时走 edits 端点，无参考图走 generations 端点
    let apiUrl = config.url.replace(/\/+$/, '');
    if (imageRef) {
      // 有参考图 → /v1/images/edits（图生图 / 参考图生图）
      apiUrl = apiUrl.replace(/\/v1\/.*$/, '').replace(/\/v1$/, '');
      apiUrl += '/v1/images/edits';
    } else {
      // 无参考图 → /v1/images/generations（纯文生图）
      if (!apiUrl.includes('/v1/images/generations')) {
        apiUrl = apiUrl.replace(/\/v1\/.*$/, '').replace(/\/v1$/, '');
        apiUrl += '/v1/images/generations';
      }
    }

    let response;

    if (imageRef) {
      // edits 端点要求 multipart/form-data 格式
      const formData = new FormData();
      formData.append('model', config.model);
      formData.append('prompt', finalPrompt);
      formData.append('size', state.size);
      formData.append('n', '1');

      // 将 base64 参考图转为 Blob 并作为 image[] 上传
      const imageBlob = dataUrlToBlob(imageRef);
      formData.append('image[]', imageBlob, 'reference.png');

      console.log('[ImageGen] Using edits endpoint with reference image');

      response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.key}`
          // 不设置 Content-Type，浏览器会自动添加正确的 multipart boundary
        },
        body: formData
      });
    } else {
      // generations 端点使用 JSON 格式
      const payload = {
        model: config.model,
        prompt: finalPrompt,
        n: 1,
        size: state.size
      };

      response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.key}`
        },
        body: JSON.stringify(payload)
      });
    }


    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      let detail = '';
      try {
        const errJson = JSON.parse(errorText);
        detail = errJson.error?.message || errJson.message || errorText.slice(0, 200);
      } catch {
        detail = errorText.slice(0, 200);
      }
      throw new Error(`API 错误 (${response.status}): ${detail}`);
    }

    const data = await response.json();

    // 支持两种响应格式
    if (data.data && data.data[0]) {
      if (data.data[0].url) {
        // 关键修复：生图 API 返回的远程 URL 通常有时效（DALL-E 约 1 小时，其它服务数天），
        // 过期后缓存里的 URL 失效 → <img> 报错"图片加载失败"。
        // 因此下载后转成 base64 data URL 持久化，图片数据存本地，永不过期。
        const remoteUrl = data.data[0].url;
        try {
          const dataUrl = await urlToDataUrl(remoteUrl);
          if (dataUrl) return dataUrl;
        } catch (e) {
          console.warn('[ImageGen] 远程图转 base64 失败，回退使用原 URL（可能很快过期）:', e);
        }
        return remoteUrl;
      }
      if (data.data[0].b64_json) {
        return 'data:image/png;base64,' + data.data[0].b64_json;
      }
    }

    throw new Error('API 响应格式不正确');
  }

  // 把远程图片 URL 下载并转为 base64 data URL（持久化用，避免远程链接过期）
  async function urlToDataUrl(url) {
    const resp = await fetch(url);
    if (!resp.ok) throw new Error('下载图片失败: HTTP ' + resp.status);
    const blob = await resp.blob();
    return await new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(fr.result);
      fr.onerror = reject;
      fr.readAsDataURL(blob);
    });
  }

  // 将 base64 data URL 转为 Blob（FormData 上传 & 下载用）
  function dataUrlToBlob(dataUrl) {
    const parts = dataUrl.split(',');
    const mime = parts[0].match(/:(.*?);/)[1];
    const bstr = atob(parts[1]);
    const n = bstr.length;
    const u8arr = new Uint8Array(n);
    for (let i = 0; i < n; i++) {
      u8arr[i] = bstr.charCodeAt(i);
    }
    return new Blob([u8arr], { type: mime });
  }

  // ========================
  // 9. 拉取可用模型
  // ========================
  async function fetchModels(url, key) {
    const apiUrl = (url || state.url).replace(/\/+$/, '');
    const apiKey = key || state.key;

    if (!apiUrl || !apiKey) {
      throw new Error('请先填写 API URL 和 Key');
    }

    // 移除路径尾部，拼接 /v1/models
    let modelsUrl = apiUrl.replace(/\/v1\/.*$/, '').replace(/\/v1$/, '');
    modelsUrl += '/v1/models';

    const response = await fetch(modelsUrl, {
      headers: {
        'Authorization': `Bearer ${apiKey}`
      }
    });

    if (!response.ok) {
      throw new Error(`拉取模型失败 (${response.status})`);
    }

    const data = await response.json();
    let models = [];

    if (data.data && Array.isArray(data.data)) {
      models = data.data.map(m => m.id || m.name).filter(Boolean);
    } else if (Array.isArray(data)) {
      models = data.map(m => m.id || m.name || m).filter(Boolean);
    }

    // 排序：图片相关模型优先
    const imageKeywords = ['dall-e', 'image', 'img', 'paint', 'draw', 'stable', 'flux', 'midjourney', 'sd', 'sdxl'];
    models.sort((a, b) => {
      const aIsImage = imageKeywords.some(k => a.toLowerCase().includes(k));
      const bIsImage = imageKeywords.some(k => b.toLowerCase().includes(k));
      if (aIsImage && !bIsImage) return -1;
      if (!aIsImage && bIsImage) return 1;
      return a.localeCompare(b);
    });

    state.modelList = models;
    return models;
  }

  // ========================
  // 10. 设置页面 DOM 引用 (HTML 已在 index.html 中静态定义)
  // ========================
  // Element IDs in index.html:
  // - imagegen-toggle: 启用开关
  // - imagegen-copy-chat-api-btn: 复制聊天API按钮
  // - imagegen-api-url: URL 输入框
  // - imagegen-api-key: Key 输入框
  // - imagegen-model-select: 模型下拉
  // - imagegen-model-display: 模型显示文本
  // - imagegen-fetch-models-btn: 拉取模型按钮
  // - imagegen-size-select: 尺寸下拉
  // - imagegen-size-display: 尺寸显示文本
  // - imagegen-default-prompt: 全局提示词
  // - imagegen-save-btn: 保存按钮
  // - imagegen-status-text: Labs页入口状态文本

  function renderSettingsPageIcons() {
    const page = document.getElementById('page-imagegen');
    if (!page) return;
    if (window.renderLucideIcons) {
      window.renderLucideIcons(page);
    } else if (typeof lucide !== 'undefined' && lucide.createIcons) {
      lucide.createIcons({ nodes: page.querySelectorAll('[data-lucide]:not([data-lucide-rendered])') });
    }
  }

  // ========================
  // 11. 设置页交互逻辑
  // ========================
  function populateSettingsUI() {
    const urlInput = document.getElementById('imagegen-api-url');
    const keyInput = document.getElementById('imagegen-api-key');
    const modelSelect = document.getElementById('imagegen-model-select');
    const modelDisplay = document.getElementById('imagegen-model-display');
    const sizeSelect = document.getElementById('imagegen-size-select');
    const sizeDisplay = document.getElementById('imagegen-size-display');
    const promptInput = document.getElementById('imagegen-default-prompt');

    if (urlInput) urlInput.value = state.url || '';
    if (keyInput) keyInput.value = state.key || '';
    if (sizeSelect) sizeSelect.value = state.size || '1024x1024';
    if (sizeDisplay) sizeDisplay.textContent = sizeSelect ? sizeSelect.options[sizeSelect.selectedIndex].text : '1024x1024';
    if (promptInput) promptInput.value = state.defaultPrompt || '';

    // 填充模型列表
    if (modelSelect) {
      modelSelect.innerHTML = '<option value="">-- 请拉取模型列表 --</option>';
      for (const m of state.modelList) {
        const opt = document.createElement('option');
        opt.value = m;
        opt.textContent = m;
        if (m === state.model) opt.selected = true;
        modelSelect.appendChild(opt);
      }
      // 如果当前模型不在列表中但有值，也添加
      if (state.model && !state.modelList.includes(state.model)) {
        const opt = document.createElement('option');
        opt.value = state.model;
        opt.textContent = state.model;
        opt.selected = true;
        modelSelect.appendChild(opt);
      }
      // 更新显示文本
      if (modelDisplay && modelSelect.selectedIndex > 0) {
        modelDisplay.textContent = modelSelect.options[modelSelect.selectedIndex].text;
      }
    }

    // 更新开关状态
    updateToggleUI();
    updateStatusText();
  }

  function updateToggleUI() {
    const toggle = document.getElementById('imagegen-toggle');
    if (!toggle) return;
    if (state.enabled) {
      toggle.classList.add('active');
    } else {
      toggle.classList.remove('active');
    }
  }

  function updateStatusText() {
    const statusEl = document.getElementById('imagegen-status-text');
    if (!statusEl) return;
    if (state.enabled && state.model) {
      statusEl.textContent = state.model.length > 12 ? state.model.slice(0, 12) + '...' : state.model;
      statusEl.style.color = '#8b5cf6';
    } else if (state.enabled) {
      statusEl.textContent = '已启用';
      statusEl.style.color = '#22c55e';
    } else {
      statusEl.textContent = '未配置';
      statusEl.style.color = '';
    }
  }

  // ========================
  // 12. 对外暴露的交互方法 (UI 回调)
  // ========================
  function toggleEnabled() {
    state.enabled = !state.enabled;
    updateToggleUI();
    updateStatusText();
    saveSettings();
  }

  async function copyMainApi() {
    try {
      const mainSettings = await window.dbHelper.loadData(DB_STORE, 'apiSettings');
      if (mainSettings && mainSettings.value) {
        const urlInput = document.getElementById('imagegen-api-url');
        const keyInput = document.getElementById('imagegen-api-key');
        if (urlInput) urlInput.value = mainSettings.value.url || '';
        if (keyInput) keyInput.value = mainSettings.value.key || '';

        // 显示成功提示
        const btn = document.getElementById('imagegen-copy-chat-api-btn');
        if (btn) {
          const orig = btn.textContent;
          btn.textContent = '✓ 已复制';
          btn.classList.add('bg-green-100', 'text-green-600');
          btn.classList.remove('bg-purple-50', 'text-purple-600');
          setTimeout(() => {
            btn.textContent = orig;
            btn.classList.remove('bg-green-100', 'text-green-600');
            btn.classList.add('bg-purple-50', 'text-purple-600');
          }, 2000);
        }
      }
    } catch (e) {
      console.error('[ImageGen] Copy main API failed:', e);
    }
  }

  async function fetchModelsFromUI() {
    const urlInput = document.getElementById('imagegen-api-url');
    const keyInput = document.getElementById('imagegen-api-key');
    const btn = document.getElementById('imagegen-fetch-models-btn');

    const url = urlInput ? urlInput.value.trim() : state.url;
    const key = keyInput ? keyInput.value.trim() : state.key;

    if (btn) btn.classList.add('animate-spin');

    try {
      const models = await fetchModels(url, key);
      state.modelList = models;
      const modelSelect = document.getElementById('imagegen-model-select');
      const modelDisplay = document.getElementById('imagegen-model-display');
      if (modelSelect) {
        modelSelect.innerHTML = '<option value="">请选择模型</option>';
        for (const m of models) {
          const opt = document.createElement('option');
          opt.value = m;
          opt.textContent = m;
          modelSelect.appendChild(opt);
        }
      }
      if (modelDisplay && models.length > 0) {
        modelDisplay.textContent = models.length + ' 个模型可用';
      }
    } catch (e) {
      alert('拉取模型失败: ' + e.message);
    } finally {
      if (btn) btn.classList.remove('animate-spin');
    }
  }

  async function saveFromUI() {
    const urlInput = document.getElementById('imagegen-api-url');
    const keyInput = document.getElementById('imagegen-api-key');
    const modelSelect = document.getElementById('imagegen-model-select');
    const sizeSelect = document.getElementById('imagegen-size-select');
    const promptInput = document.getElementById('imagegen-default-prompt');

    state.url = urlInput ? urlInput.value.trim() : state.url;
    state.key = keyInput ? keyInput.value.trim() : state.key;
    state.model = modelSelect ? modelSelect.value : state.model;
    state.size = sizeSelect ? sizeSelect.value : state.size;
    state.defaultPrompt = promptInput ? promptInput.value.trim() : state.defaultPrompt;

    await saveSettings();
    updateStatusText();

    // 显示成功
    const btn = document.getElementById('imagegen-save-btn');
    if (btn) {
      const orig = btn.textContent;
      btn.textContent = '✓ 已保存';
      btn.classList.add('bg-green-600');
      setTimeout(() => {
        btn.textContent = orig;
        btn.classList.remove('bg-green-600');
      }, 2000);
    }
  }

  async function retryGeneration(btnEl, encodedPrompt) {
    const prompt = decodeURIComponent(encodedPrompt);
    const card = btnEl.closest('.image-gen-card');
    if (!card) return;

    await removeCachedImage(prompt);

    card.dataset.status = 'loading';
    card.classList.add('loading');
    card.innerHTML = `
      <div class="image-gen-loading">
        <div class="image-gen-loading-spinner"></div>
        <span class="image-gen-loading-text">重新生成中...</span>
      </div>
    `;

    try {
      const imageUrl = await callImageGenApi(prompt);
      await setCachedImage(prompt, imageUrl);
      renderImageResult(card, imageUrl, prompt);
    } catch (err) {
      renderImageError(card, err.message, prompt);
    }
  }

  // ========================
  // 13.5 参考图弹窗逻辑
  // ========================
  let tempImageRef = ''; // 暂存未保存的参考图

  function initImageRefUI() {
    const uploadBtn = document.getElementById('upload-image-ref-btn');
    const modal = document.getElementById('image-ref-modal');
    const modalClose = document.getElementById('image-ref-modal-close');
    const fileInput = document.getElementById('image-ref-file-input');
    const dropZone = document.getElementById('image-ref-drop-zone');
    const removeBtn = document.getElementById('image-ref-remove-btn');
    const saveBtn = document.getElementById('image-ref-save-btn');
    const modalPreview = document.getElementById('image-ref-modal-preview');
    const placeholder = document.getElementById('image-ref-drop-placeholder');

    if (!uploadBtn) return;

    function openModal() {
      if (window.currentOpenContact) {
        tempImageRef = window.currentOpenContact.imageRef || '';
      }
      updateModalPreview();
      modal.style.display = 'flex';
      setTimeout(() => {
        modal.style.opacity = '1';
        const card = document.getElementById('image-ref-modal-card');
        card.style.transform = 'scale(1)';
        card.style.opacity = '1';
      }, 10);
    }

    function closeModal() {
      modal.style.opacity = '0';
      const card = document.getElementById('image-ref-modal-card');
      card.style.transform = 'scale(0.92)';
      card.style.opacity = '0';
      setTimeout(() => {
        modal.style.display = 'none';
      }, 250);
    }

    function updateModalPreview() {
      if (tempImageRef) {
        modalPreview.src = tempImageRef;
        modalPreview.style.display = 'block';
        placeholder.style.display = 'none';
        removeBtn.style.display = 'block';
      } else {
        modalPreview.style.display = 'none';
        placeholder.style.display = 'flex';
        removeBtn.style.display = 'none';
      }
    }

    function updateThumbPreview() {
      const currentRef = window.currentOpenContact?.imageRef;
      const span = uploadBtn.querySelector('span');
      if (span) {
        if (currentRef) {
          span.innerText = '查看参考图';
        } else {
          span.innerText = '上传参考图';
        }
      }
    }

    function handleFile(file) {
      if (!file || !file.type.startsWith('image/')) return;
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          // 压缩图片 (最长边不超过1024)
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          const maxDim = 1024;
          if (width > maxDim || height > maxDim) {
            if (width > height) {
              height = Math.round(height * (maxDim / width));
              width = maxDim;
            } else {
              width = Math.round(width * (maxDim / height));
              height = maxDim;
            }
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);
          tempImageRef = canvas.toDataURL('image/jpeg', 0.85);
          updateModalPreview();
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    }

    uploadBtn.addEventListener('click', openModal);
    modalClose.addEventListener('click', closeModal);

    dropZone.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', (e) => {
      handleFile(e.target.files[0]);
      fileInput.value = ''; // Reset
    });

    dropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropZone.style.borderColor = '#7c3aed';
      dropZone.style.background = '#f3f0ff';
    });
    dropZone.addEventListener('dragleave', () => {
      dropZone.style.borderColor = '#d1c4f5';
      dropZone.style.background = '#faf8ff';
    });
    dropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropZone.style.borderColor = '#d1c4f5';
      dropZone.style.background = '#faf8ff';
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        handleFile(e.dataTransfer.files[0]);
      }
    });

    removeBtn.addEventListener('click', () => {
      tempImageRef = '';
      updateModalPreview();
    });

    saveBtn.addEventListener('click', () => {
      if (window.currentOpenContact) {
        window.currentOpenContact.imageRef = tempImageRef;
      }
      updateThumbPreview();
      closeModal();
    });

    // 将外部需要的更新函数挂载到模块上
    window.ImageGen._updateThumbPreview = updateThumbPreview;
  }

  // ========================
  // 13. Hook 角色编辑保存/加载
  // ========================
  function hookContactSaveLoad() {
    // Hook saveContact
    const origSave = window.saveContact;
    if (origSave && !origSave._imageGenHooked) {
      window.saveContact = async function () {
        // 保存生图提示词和参考图到 contact 对象
        const promptInput = document.getElementById('chat-ai-image-prompt-input');
        if (window.currentOpenContact) {
          if (promptInput) {
            window.currentOpenContact.imagePrompt = promptInput.value.trim();
          }
          // imageRef 已经在 saveBtn 点击时赋给 currentOpenContact，无需在此额外获取
        }
        return await origSave.apply(this, arguments);
      };
      window.saveContact._imageGenHooked = true;
    }

    // Hook loadContactSettings
    const origLoad = window.loadContactSettings;
    if (origLoad && !origLoad._imageGenHooked) {
      window.loadContactSettings = function (contact) {
        origLoad.call(this, contact);
        // 加载生图提示词和参考图
        const promptInput = document.getElementById('chat-ai-image-prompt-input');
        if (contact) {
          if (promptInput) promptInput.value = contact.imagePrompt || '';
          if (window.ImageGen._updateThumbPreview) {
            window.ImageGen._updateThumbPreview();
          }
        }
      };
      window.loadContactSettings._imageGenHooked = true;
    }

    // 也监听保存按钮点击 (备用)
    const saveBtn = document.getElementById('save-chat-settings-new-btn');
    if (saveBtn && !saveBtn._imageGenHooked) {
      saveBtn.addEventListener('click', () => {
        const promptInput = document.getElementById('chat-ai-image-prompt-input');
        if (promptInput && window.currentOpenContact) {
          window.currentOpenContact.imagePrompt = promptInput.value.trim();
        }
      });
      saveBtn._imageGenHooked = true;
    }
  }

  // ========================
  // 14. 打开/关闭设置页
  // ========================
  function openSettings() {
    populateSettingsUI();
    if (typeof window.openSettingsPage === 'function') {
      window.openSettingsPage('page-imagegen');
    }
  }

  function closeSettings() {
    if (typeof window.closeSettingsPage === 'function') {
      window.closeSettingsPage('page-imagegen');
    }
  }

  // ========================
  // 15. 初始化
  // ========================
  async function init() {
    console.log('[ImageGen] Initializing...');

    await loadSettings();
    hookApiRequest();
    startObserver();

    // 立即更新 Labs 页面状态显示
    updateStatusText();

    // 延迟 hook contact 操作 (等 DOM 就绪)
    setTimeout(() => {
      hookContactSaveLoad();
      initImageRefUI();
      populateSettingsUI();
      updateStatusText();
    }, 2000);

    console.log('[ImageGen] Module initialized, enabled:', state.enabled);
  }

  function onReady() {
    if (window.dbHelper) {
      init();
    } else {
      // 等待 dbHelper 就绪
      let attempts = 0;
      const waitForDb = setInterval(() => {
        attempts++;
        if (window.dbHelper) {
          clearInterval(waitForDb);
          init();
        } else if (attempts > 30) {
          clearInterval(waitForDb);
          console.error('[ImageGen] dbHelper never became available');
        }
      }, 500);
    }
  }

  // ========================
  // 16. 暴露全局 API
  // ========================
  window.ImageGen = {
    open: openSettings,
    close: closeSettings,
    isEnabled: () => state.enabled,
    generateImage: callImageGenApi,
    getCharacterPrompt: getCharacterImagePrompt,
    setCharacterPrompt: (contactId, prompt) => {
      if (window.currentOpenContact && window.currentOpenContact.id === contactId) {
        window.currentOpenContact.imagePrompt = prompt;
      }
    },
    // HTML onclick 调用的方法名
    toggleEnabled: toggleEnabled,
    copyChatApiConfig: copyMainApi,
    fetchModels: fetchModelsFromUI,
    onModelChange: (value) => { state.model = value; },
    onSizeChange: (value) => { state.size = value; },
    saveSettings: saveFromUI,
    retry: retryGeneration,
    // 内部使用
    _fetchModelsRaw: fetchModels
  };

  // 启动
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', onReady);
  } else {
    onReady();
  }

  console.log('[ImageGen] Module loaded');
})();
