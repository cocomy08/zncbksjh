/* =====================================================================
 * changelog.js
 * 更新日志：从 #changelog-data <template> 读取每个版本的内容并渲染。
 * 触发入口：#changelog-open-btn (设置页顶栏)
 * 同时拓展 window.showUpdateNotification，使其在弹窗里加「查看详情」按钮。
 * ===================================================================== */
(function () {
    "use strict";

    const STORAGE_LAST_SEEN_KEY = "changelog_last_seen_version";

    /* ---------- 工具 ---------- */
    function getCurrentVersion() {
        // 优先：模板里第一个 article（最新版本）的 data-version
        const tpl = document.getElementById("changelog-data");
        if (tpl) {
            const first = tpl.content.querySelector("article[data-version]");
            if (first) return first.dataset.version;
        }
        return null;
    }

    function readEntries() {
        const tpl = document.getElementById("changelog-data");
        if (!tpl) return [];
        const frag = tpl.content.cloneNode(true);
        const entries = Array.from(frag.querySelectorAll("article")).map(
            (a) => ({
                version: a.dataset.version || "",
                date: a.dataset.date || "",
                html: a.innerHTML.trim(),
            }),
        );
        // 按 version 字符串倒序（保持模板里手写的顺序通常已是新到旧）
        return entries;
    }

    /* ---------- 全屏页（仿 chat-settings-page） ---------- */
    function ensurePage() {
        let page = document.getElementById("changelog-page");
        if (page) return page;
        page = document.createElement("div");
        page.id = "changelog-page";
        page.className = "changelog-page";
        page.innerHTML = `
            <div class="changelog-header">
                <button class="changelog-back-btn" id="changelog-back" aria-label="返回">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M15 18l-6-6 6-6"/>
                    </svg>
                </button>
                <span class="changelog-title">更新日志</span>
                <span class="changelog-spacer"></span>
            </div>
            <div class="changelog-content" id="changelog-content"></div>
        `;
        const mount = document.querySelector(".content-mask") || document.body;
        mount.appendChild(page);
        page.querySelector("#changelog-back").addEventListener("click", closePage);
        return page;
    }

    function renderEntries(filterToVersion) {
        const root = document.getElementById("changelog-content");
        if (!root) return;
        const entries = readEntries();
        const list = filterToVersion
            ? entries.filter((e) => e.version === filterToVersion)
            : entries;

        if (!list.length) {
            root.innerHTML = `<div class="changelog-empty">暂无更新内容</div>`;
            return;
        }

        root.innerHTML = list
            .map(
                (e) => `
            <section class="changelog-entry">
                <div class="changelog-entry-head">
                    <span class="changelog-version">v${escapeAttr(e.version)}</span>
                    ${e.date ? `<span class="changelog-date">${escapeAttr(e.date)}</span>` : ""}
                </div>
                <div class="changelog-body">${e.html}</div>
            </section>
        `,
            )
            .join("");
    }

    function escapeAttr(s) {
        return String(s || "").replace(/[&<>"']/g, (c) => ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;",
        })[c]);
    }

    function openPage(opts) {
        ensurePage();
        renderEntries(opts && opts.onlyLatest ? getCurrentVersion() : null);
        const page = document.getElementById("changelog-page");
        page.classList.add("active");
        // 标记已查看
        const v = getCurrentVersion();
        if (v) localStorage.setItem(STORAGE_LAST_SEEN_KEY, v);
        markBadgeSeen();
    }

    function closePage() {
        const page = document.getElementById("changelog-page");
        if (page) page.classList.remove("active");
    }

    /* ---------- 设置页按钮 ---------- */
    function bindEntryBtn() {
        const btn = document.getElementById("changelog-open-btn");
        if (!btn || btn.dataset.bound === "1") return;
        btn.dataset.bound = "1";
        btn.addEventListener("click", () => openPage({ onlyLatest: false }));
        // 如有未读新版本，加红点
        refreshBadge();
    }

    function refreshBadge() {
        const btn = document.getElementById("changelog-open-btn");
        if (!btn) return;
        const cur = getCurrentVersion();
        const seen = localStorage.getItem(STORAGE_LAST_SEEN_KEY);
        if (cur && seen !== cur) {
            btn.classList.add("changelog-has-new");
        } else {
            btn.classList.remove("changelog-has-new");
        }
    }

    function markBadgeSeen() {
        refreshBadge();
    }

    /* ---------- 增强系统的 update notification：加「查看详情」 ---------- */
    function patchUpdateNotification() {
        // 等到原 showUpdateNotification 已挂载并被首次调用时，向卡片内追加按钮
        const obs = new MutationObserver(() => {
            const card = document.getElementById("app-update-notification");
            if (!card || card.dataset.changelogPatched === "1") return;
            card.dataset.changelogPatched = "1";

            const refreshBtn = card.querySelector("#refresh-btn");
            if (!refreshBtn) return;

            const detail = document.createElement("button");
            detail.id = "changelog-detail-btn";
            detail.textContent = "详情";
            detail.style.cssText = `
                background: rgba(0, 122, 255, 0.08);
                color: #007AFF;
                border: none;
                padding: 8px 14px;
                border-radius: 12px;
                cursor: pointer;
                font-weight: 600;
                font-size: 14px;
                transition: background 0.2s;
                font-family: inherit;
            `;
            detail.addEventListener("click", () => {
                openPage({ onlyLatest: true });
            });
            refreshBtn.parentNode.insertBefore(detail, refreshBtn);
        });
        obs.observe(document.body, { childList: true, subtree: false });
    }

    /* ---------- 启动 ---------- */
    function init() {
        bindEntryBtn();
        patchUpdateNotification();
        // 设置页可能是后渲染的（lucide 等），观察它出现
        const settingsHeader = document.querySelector("#settings-screen header");
        if (settingsHeader) {
            const o = new MutationObserver(bindEntryBtn);
            o.observe(settingsHeader, { childList: true, subtree: true });
        }
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", () => setTimeout(init, 200));
    } else {
        setTimeout(init, 200);
    }

    // 暴露调试入口
    window.Changelog = {
        open: () => openPage({ onlyLatest: false }),
        openLatest: () => openPage({ onlyLatest: true }),
        close: closePage,
    };
})();
