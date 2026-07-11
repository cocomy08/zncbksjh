/**
 * iOS Crash Fix & Message Renderer
 * 修复 iOS 滚动崩溃问题，并提供基础的消息渲染逻辑
 */
(function () {
    console.log('📱 iOS Renderer Fix Loaded');

    // 如果主程序没有定义渲染器，我们定义一个默认的
    if (!window.renderMessageRowContent) {
        console.warn('⚠️ Main renderer not found, using fallback/safe renderer.');

        window.renderMessageRowContent = function (element, message, contact) {
            if (!element) return;

            // 防止重复渲染（虽然 VirtualList 会清空 innerHTML，但加一层保险）
            // element.innerHTML = ''; 

            const isUser = message.isUser || (message.sender && message.sender === 'user');
            const content = message.content || message.text || '[无内容]';
            const type = message.type || 'text';

            // 基础样式 - 保持与现有 CSS 兼容的类名
            const rowClass = isUser ? 'message-row user-message-row' : 'message-row ai-message-row';
            const bubbleClass = isUser ? 'chat-bubble user-bubble' : 'chat-bubble ai-bubble';

            let innerContent = '';

            // 简单处理不同类型
            if (type === 'image' || (content && content.startsWith('data:image'))) {
                innerContent = `<img src="${content}" style="max-width: 200px; border-radius: 8px;" loading="lazy" />`;
            } else {
                // 文本内容 (简单转义防止 XSS)
                const safeContent = String(content)
                    .replace(/&/g, "&amp;")
                    .replace(/</g, "&lt;")
                    .replace(/>/g, "&gt;")
                    .replace(/\n/g, "<br>");
                innerContent = `<div class="message-text">${safeContent}</div>`;
            }

            // 构建 DOM
            const html = `
                <div class="${rowClass}" style="padding: 10px; display: flex; justify-content: ${isUser ? 'flex-end' : 'flex-start'};">
                    <div class="${bubbleClass}" style="
                        max-width: 80%; 
                        padding: 10px 14px; 
                        border-radius: 12px; 
                        background-color: ${isUser ? '#95ec69' : '#fff'}; 
                        box-shadow: 0 1px 2px rgba(0,0,0,0.1);
                        word-wrap: break-word;
                    ">
                        ${innerContent}
                    </div>
                </div>
            `;

            element.innerHTML = html;

            // 重要：确保元素有高度，否则虚拟列表会崩溃
            if (element.offsetHeight === 0) {
                element.style.minHeight = '40px';
            }
        };
    } else {
        console.log('✅ Native renderMessageRowContent found.');
    }
})();
