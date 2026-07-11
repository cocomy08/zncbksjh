
/**
 * 文本域快捷操作（复制/清空）功能的逻辑实现
 * 对应样式文件: src/styles/textarea-actions.css
 */
(function () {
    'use strict';

    // 使用捕获阶段监听，确保优先处理，且不依赖于页面加载顺序
    document.addEventListener('click', function (e) {
        // 查找最近的 .mini-action-btn 元素
        const btn = e.target.closest(".mini-action-btn");
        if (!btn) return;

        // 阻止事件冒泡和默认行为，避免触发其他意外逻辑
        e.stopPropagation();
        e.preventDefault();

        // 获取目标输入框的 ID
        const targetId = btn.dataset.target;
        if (!targetId) return;

        const targetInput = document.getElementById(targetId);
        if (!targetInput) {
            console.warn(`[TextareaActions] Target input #${targetId} not found.`);
            return;
        }

        // 功能分支
        if (btn.classList.contains("copy-btn")) {
            handleCopy(targetInput);
        } else if (btn.classList.contains("clear-btn")) {
            handleClear(targetInput);
        }
    }, true);

    /**
     * 处理复制逻辑
     */
    function handleCopy(inputElement) {
        // 选中内容（视觉反馈）
        inputElement.select();
        // 移动端兼容：确保选区范围正确
        inputElement.setSelectionRange(0, 99999);

        // 使用 Clipboard API
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(inputElement.value)
                .then(() => showFeedback("已复制到剪贴板"))
                .catch(err => {
                    console.error("Clipboard API failed:", err);
                    fallbackCopy(inputElement);
                });
        } else {
            fallbackCopy(inputElement);
        }
    }

    /**
     * 降级复制逻辑 (execCommand)
     */
    function fallbackCopy(inputElement) {
        try {
            const successful = document.execCommand('copy');
            if (successful) {
                showFeedback("已复制");
            } else {
                showFeedback("复制失败，请手动长按复制");
            }
        } catch (err) {
            console.error("Fallback copy failed:", err);
            showFeedback("复制出错");
        }
    }

    /**
     * 处理清空逻辑
     */
    function handleClear(inputElement) {
        if (!inputElement.value) return;

        // 简单确认，防止误触
        if (confirm("确定要清空当前内容吗？此操作无法撤销。")) {
            inputElement.value = "";
            inputElement.focus();

            // 触发事件以通知 Vue/React 或其他绑定框架更新数据
            inputElement.dispatchEvent(new Event('input', { bubbles: true }));
            inputElement.dispatchEvent(new Event('change', { bubbles: true }));

            showFeedback("已清空");
        }
    }

    /**
     * 显示简单的反馈提示
     * 优先使用全局定义的 toast，没有则使用 alert
     */
    function showFeedback(message) {
        if (typeof window.showToast === 'function') {
            window.showToast(message);
        } else if (typeof window.toast === 'function') {
            window.toast(message);
        } else {
            // 避免频繁 alert 打断操作，非错误提示可以忽略 alert 或使用 console
            // 但为了确保用户知道结果，这里还是用 alert (或者您可以自己实现一个小 toast)
            // console.log(message); 
            // alert(message); 
        }
    }

    console.log('[TextareaActions] Module loaded.');
})();
