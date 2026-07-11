/**
 * virtual-list.js
 * A lightweight virtual list manager using IntersectionObserver.
 * Designed to handle variable height items by "freezing" their height
 * and emptying their content when they leave the viewport.
 */
(function () {
    const DEBUG_VL = false;
    const ROOT_MARGIN = '800px 0px 800px 0px';

    class VirtualListManager {
        constructor() {
            this.observer = new IntersectionObserver(this.handleIntersection.bind(this), {
                root: null, // viewport - 默认是视口，但也支持滚动容器（如果需要精确控制，未来可以扩展）
                rootMargin: ROOT_MARGIN,
                threshold: 0
            });
            // Map: DOM Element -> { type: string, data: any }
            this.itemMap = new WeakMap();
            // Registry: type -> renderFunction(element, data)
            this.renderers = {};
        }

        /**
         * 注册一种列表项的渲染器
         * @param {string} type 类型标识符 (e.g. 'chat-msg', 'contact-item')
         * @param {Function} renderer 渲染函数 (element, data) => void
         */
        registerRenderer(type, renderer) {
            this.renderers[type] = renderer;
        }

        /**
         * 开始观察一个列表项
         * @param {HTMLElement} element DOM元素
         * @param {string} type 类型标识符
         * @param {Object} data 恢复渲染所需的数据
         */
        observe(element, type, data) {
            if (!element) return;

            // 兼容旧的调用方式 observe(element, message, contact) -> 映射为 type='chat-msg'
            if (arguments.length === 3 && typeof type === 'object' && data && data.id) {
                // 这是旧代码在调用: observe(row, message, contact)
                // 我们自动转换一下
                const message = type;
                const contact = data;
                this.itemMap.set(element, {
                    type: 'chat-msg',
                    data: { message, contact }
                });
            } else {
                // 新的标准调用
                this.itemMap.set(element, { type, data });
            }

            this.observer.observe(element);
        }

        unobserve(element) {
            if (element) {
                this.observer.unobserve(element);
                this.itemMap.delete(element);
            }
        }

        handleIntersection(entries) {
            entries.forEach(entry => {
                const element = entry.target;
                const record = this.itemMap.get(element);

                if (!record) return;

                if (entry.isIntersecting) {
                    if (element.classList.contains('virtual-hidden')) {
                        this.restoreItem(element, record);
                    }
                } else {
                    if (!element.classList.contains('virtual-hidden')) {
                        this.virtualizeItem(element);
                    }
                }
            });
        }

        virtualizeItem(element) {
            const height = element.offsetHeight;
            if (height === 0) return;

            element.style.height = `${height}px`;
            element.style.contain = 'paint layout';
            element.classList.add('virtual-hidden');
            element.innerHTML = '';

            if (DEBUG_VL) console.log(`[VL] Virtualized item`);
        }

        restoreItem(element, { type, data }) {
            element.classList.remove('virtual-hidden');
            element.style.contain = '';

            let rendered = false;

            // 1. 优先使用注册的渲染器
            if (this.renderers[type]) {
                this.renderers[type](element, data);
                rendered = true;
            }
            // 2. 回退到全局硬编码 (兼容旧代码)
            else if (type === 'chat-msg' && window.renderMessageRowContent) {
                window.renderMessageRowContent(element, data.message, data.data || data.contact);
                rendered = true;
            }
            else {
                console.warn(`[VL] No renderer found for type: ${type}`);
                // 🔥【关键修复】防止渲染失败导致高度塌陷引发无限循环崩溃
                if (!element.innerHTML.trim()) {
                    element.innerHTML = `<div style="padding:10px; color:red; border:1px solid red;">渲染失败: ${type}</div>`;
                }
                // 保持原有高度，防止布局抖动
                // element.style.height = ''; // Remove this line to keep fixed height if failed
                return;
            }

            // 只有成功渲染才释放高度限制
            if (rendered) {
                element.style.height = '';
            }

            if (DEBUG_VL) console.log(`[VL] Restored ${type}`);
        }
    }

    window.VirtualListManager = new VirtualListManager();
    console.log('[VirtualList] ✅ Library loaded and Manager initialized');
})();
