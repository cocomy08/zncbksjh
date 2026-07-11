/* =====================================================================
 * user-profiles.js
 * 用户人设管理：抽离 contact.user 为可复用 profile，支持全局默认 + 单聊切换。
 * 与 main.min.js 解耦：通过 hook Kl.loadData / Kl.saveData 透明同步。
 * 依赖：window.Kl (IndexedDB 抽象, 由 main.min.js 提供)
 * ===================================================================== */
(function () {
    "use strict";

    /* ---------- 常量 ---------- */
    const STORE = "settingsStore";
    const PROFILES_KEY = "userProfiles";
    const DEFAULT_KEY = "defaultUserProfileId";
    const MIGRATION_FLAG_KEY = "userProfilesMigrated_v1";
    // 可爱小动物默认头像 (inline SVG dataURI - kawaii 小猫，零外部依赖)
    const PLACEHOLDER_AVATAR =
        'data:image/svg+xml;utf8,' +
        encodeURIComponent(
            `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#FFE2D1"/>
      <stop offset="100%" stop-color="#FFC9B5"/>
    </linearGradient>
    <linearGradient id="cat" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#FFFFFF"/>
      <stop offset="100%" stop-color="#FFE8D6"/>
    </linearGradient>
  </defs>
  <rect width="120" height="120" fill="url(#bg)"/>
  <!-- ears -->
  <path d="M28 50 L40 22 L52 46 Z" fill="url(#cat)" stroke="#E8B89A" stroke-width="1.5" stroke-linejoin="round"/>
  <path d="M92 50 L80 22 L68 46 Z" fill="url(#cat)" stroke="#E8B89A" stroke-width="1.5" stroke-linejoin="round"/>
  <path d="M33 44 L40 30 L48 42 Z" fill="#FFB3C1"/>
  <path d="M87 44 L80 30 L72 42 Z" fill="#FFB3C1"/>
  <!-- face -->
  <ellipse cx="60" cy="68" rx="34" ry="30" fill="url(#cat)" stroke="#E8B89A" stroke-width="1.5"/>
  <!-- cheeks -->
  <ellipse cx="38" cy="76" rx="6" ry="4" fill="#FFB3C1" opacity="0.7"/>
  <ellipse cx="82" cy="76" rx="6" ry="4" fill="#FFB3C1" opacity="0.7"/>
  <!-- eyes -->
  <ellipse cx="48" cy="64" rx="3.5" ry="4.5" fill="#3A2A1F"/>
  <ellipse cx="72" cy="64" rx="3.5" ry="4.5" fill="#3A2A1F"/>
  <circle cx="49.2" cy="62.5" r="1.2" fill="#fff"/>
  <circle cx="73.2" cy="62.5" r="1.2" fill="#fff"/>
  <!-- nose -->
  <path d="M58 73 L62 73 L60 76 Z" fill="#FFB3C1"/>
  <!-- mouth -->
  <path d="M60 76 Q56 80 53 78" fill="none" stroke="#3A2A1F" stroke-width="1.5" stroke-linecap="round"/>
  <path d="M60 76 Q64 80 67 78" fill="none" stroke="#3A2A1F" stroke-width="1.5" stroke-linecap="round"/>
  <!-- whiskers -->
  <line x1="22" y1="70" x2="34" y2="72" stroke="#C49A7E" stroke-width="1" stroke-linecap="round"/>
  <line x1="22" y1="76" x2="34" y2="76" stroke="#C49A7E" stroke-width="1" stroke-linecap="round"/>
  <line x1="86" y1="72" x2="98" y2="70" stroke="#C49A7E" stroke-width="1" stroke-linecap="round"/>
  <line x1="86" y1="76" x2="98" y2="76" stroke="#C49A7E" stroke-width="1" stroke-linecap="round"/>
</svg>`,
        );

    /* ---------- 状态 ---------- */
    const state = {
        profiles: [],
        defaultId: null,
        initialized: false,
        editingProfileId: null,
        // chat-settings 当前展示的 contact 选中的 profileId（仅 UI 缓存）
        currentPickerContactId: null,
        currentPickerProfileId: null,
        // 编辑器打开来源："picker" 表示新建后需自动 apply 到当前 contact
        editorOpenSource: null,
    };

    /* ---------- 工具 ---------- */
    function uid() {
        return (
            "up_" +
            Date.now().toString(36) +
            "_" +
            Math.random().toString(36).slice(2, 7)
        );
    }

    function db() {
        return window.Kl;
    }

    function escapeHtml(s) {
        if (s == null) return "";
        return String(s).replace(/[&<>"']/g, (c) => ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;",
        })[c]);
    }

    function findProfile(id) {
        return state.profiles.find((p) => p.id === id) || null;
    }

    function getDefaultProfile() {
        return findProfile(state.defaultId) || state.profiles[0] || null;
    }

    function userEqual(a, b) {
        if (!a || !b) return false;
        return (
            (a.name || "") === (b.name || "") &&
            (a.persona || "") === (b.persona || "") &&
            (a.avatar || "") === (b.avatar || "")
        );
    }

    /* ---------- 持久化 ---------- */
    async function loadProfilesFromDB() {
        const r = await db().loadData(STORE, PROFILES_KEY);
        state.profiles =
            r && Array.isArray(r.value) ? r.value.map((p) => ({ ...p })) : [];
        const d = await db().loadData(STORE, DEFAULT_KEY);
        state.defaultId = d && d.value ? d.value : null;
    }

    async function saveProfiles() {
        await db().saveData(STORE, PROFILES_KEY, state.profiles);
    }

    async function saveDefaultId() {
        await db().saveData(STORE, DEFAULT_KEY, state.defaultId);
    }

    /* ---------- 与 contact 同步 ---------- */
    function ensureProfileForContact(contact) {
        if (!contact) return null;
        if (contact.userProfileId) {
            const existing = findProfile(contact.userProfileId);
            if (existing) return existing;
        }
        // 没有 profileId：根据 user 数据匹配，匹配不上则新建
        const u = contact.user || {};
        let p = state.profiles.find((p) => userEqual(p, u));
        if (!p) {
            p = {
                id: uid(),
                name: u.name || "我",
                persona: u.persona || "",
                avatar: u.avatar || PLACEHOLDER_AVATAR,
                createdAt: Date.now(),
            };
            state.profiles.push(p);
        }
        contact.userProfileId = p.id;
        return p;
    }

    function applyProfileToContact(contact) {
        if (!contact || !contact.userProfileId) return;
        const p = findProfile(contact.userProfileId);
        if (!p) return;
        contact.user = contact.user || {};
        contact.user.name = p.name;
        contact.user.persona = p.persona;
        contact.user.avatar = p.avatar;
    }
    /* ---------- 迁移 ---------- */
    async function migrateExistingContacts() {
        const flag = await db().loadData(STORE, MIGRATION_FLAG_KEY);
        if (flag && flag.value) return;

        const data = await db().loadData("messageContacts", "allContacts");
        const list = data && Array.isArray(data.value) ? data.value : [];

        let changed = false;
        list.forEach((c) => {
            if (c && !c.userProfileId) {
                ensureProfileForContact(c);
                changed = true;
            }
        });

        // 迁移完写回（一次性）
        if (changed) {
            await db().saveData("messageContacts", "allContacts", list);
        }
        await saveProfiles();

        // 默认 profile：第一个
        if (!state.defaultId && state.profiles.length) {
            state.defaultId = state.profiles[0].id;
            await saveDefaultId();
        }

        await db().saveData(STORE, MIGRATION_FLAG_KEY, true);
        console.log(
            "[UserProfiles] 迁移完成，profiles =",
            state.profiles.length,
        );
    }

    /* ---------- Hook Kl 让 main.min.js 透明使用 profile 数据 ---------- */
    function installKlHooks() {
        const Kl = db();
        if (!Kl || Kl.__userProfilesHooked) return;

        const origLoad = Kl.loadData.bind(Kl);
        Kl.loadData = async function (storeName, key) {
            const result = await origLoad(storeName, key);
            try {
                if (storeName === "messageContacts" && key === "allContacts") {
                    if (result && Array.isArray(result.value)) {
                        result.value.forEach((c) => {
                            if (c) {
                                if (!c.userProfileId) ensureProfileForContact(c);
                                applyProfileToContact(c);
                            }
                        });
                    }
                }
            } catch (e) {
                console.warn("[UserProfiles] hook loadData 失败:", e);
            }
            return result;
        };

        // 拦截写入：保存 contacts 时确保 userProfileId 字段被持久化
        const origSave = Kl.saveData.bind(Kl);
        Kl.saveData = async function (storeName, key, value) {
            try {
                if (storeName === "messageContacts" && key === "allContacts" &&
                    Array.isArray(value)) {
                    value.forEach((c) => {
                        if (c && !c.userProfileId) ensureProfileForContact(c);
                    });
                }
            } catch (e) {
                console.warn("[UserProfiles] hook saveData 失败:", e);
            }
            return origSave(storeName, key, value);
        };

        Kl.__userProfilesHooked = true;
    }

    /* ---------- DOM 引用 ---------- */
    let DOM = {};

    function refreshDOMRefs() {
        DOM = {
            messagesScreen: document.getElementById("messages-screen"),
            bottomBar: document.querySelector(
                "#messages-screen .messages-bottom-bar .glass-segment-control",
            ),
            messagesContent: document.querySelector(
                "#messages-screen .messages-content",
            ),
            // 新建对话框
            addContactModal: document.getElementById("add-contact-modal"),
            roleSwitcher: document.querySelector(
                "#add-contact-modal .role-switcher",
            ),
            userForm: document.getElementById("user-form"),
            userNameInput: document.getElementById("user-name-input"),
            userPersonaInput: document.getElementById("user-persona-input"),
            userAvatarPreview: document.getElementById("user-avatar-preview"),
            // 聊天设置
            chatSettingsPage: document.getElementById("chat-settings-page"),
            roleTabAi: document.getElementById("chat-role-tab-ai"),
            roleTabUser: document.getElementById("chat-role-tab-user"),
        };
    }

    /* ---------- 底栏 + 设置页 ---------- */
    function renderSettingsTab() {
        if (!DOM.bottomBar) return;
        if (DOM.bottomBar.dataset.userTabInjected === "1") return;

        // 增加第三个 tab
        const btn = document.createElement("button");
        btn.className = "segment-btn";
        btn.dataset.type = "user-settings";
        btn.id = "messages-segment-user-settings";
        btn.textContent = "User";
        // 插在 indicator 之前
        const indicator = DOM.bottomBar.querySelector(".segment-indicator");
        if (indicator) DOM.bottomBar.insertBefore(btn, indicator);
        else DOM.bottomBar.appendChild(btn);

        DOM.bottomBar.classList.add("up-3-segments");
        DOM.bottomBar.dataset.userTabInjected = "1";

        btn.addEventListener("click", (e) => {
            e.stopPropagation();
            // 取消其它两个的 active
            DOM.bottomBar
                .querySelectorAll(".segment-btn")
                .forEach((b) => b.classList.remove("active"));
            btn.classList.add("active");
            DOM.bottomBar.classList.remove("group-mode");
            DOM.bottomBar.classList.add("user-mode");
            showProfilesScreen();
        });

        // 点击 单聊/群聊 时回到联系人列表
        DOM.bottomBar
            .querySelectorAll('.segment-btn[data-type="single"], .segment-btn[data-type="group"]')
            .forEach((b) => {
                b.addEventListener(
                    "click",
                    () => {
                        DOM.bottomBar.classList.remove("user-mode");
                        hideProfilesScreen();
                    },
                    true,
                );
            });
    }

    function ensureProfilesScreen() {
        let scr = document.getElementById("up-profiles-screen");
        if (scr) return scr;
        scr = document.createElement("div");
        scr.id = "up-profiles-screen";
        scr.className = "up-profiles-screen";
        scr.innerHTML = `
            <div class="up-profiles-header">
                <span class="up-profiles-title">User列表</span>
                <button class="up-profiles-add-btn" id="up-add-profile-btn" aria-label="新建">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
                        <line x1="12" y1="5" x2="12" y2="19"></line>
                        <line x1="5" y1="12" x2="19" y2="12"></line>
                    </svg>
                </button>
            </div>
            <div class="up-profiles-content">
                <div class="up-profiles-default-card" id="up-default-card" style="display:none">
                    <div class="up-default-avatar" id="up-default-avatar"></div>
                    <div class="up-default-info">
                        <div class="up-default-label">默认人设</div>
                        <div class="up-default-name" id="up-default-name">未设置</div>
                        <div class="up-default-persona" id="up-default-persona"></div>
                    </div>
                </div>
                <div class="up-section-title" id="up-list-title" style="display:none">所有人设</div>
                <ul class="up-profiles-list" id="up-profiles-list"></ul>
                <div class="up-profiles-empty" id="up-profiles-empty" style="display:none">
                    还没有任何人设。<br>点击右上角加号新建一个。
                </div>
            </div>
        `;
        if (DOM.messagesScreen) DOM.messagesScreen.appendChild(scr);
        else document.body.appendChild(scr);

        scr.querySelector("#up-add-profile-btn").addEventListener("click", () => {
            openProfileEditor(null);
        });
        // 点击默认卡进入编辑
        scr.querySelector("#up-default-card").addEventListener("click", () => {
            const def = getDefaultProfile();
            if (def) openProfileEditor(def.id);
        });
        return scr;
    }

    function showProfilesScreen() {
        ensureProfilesScreen();
        renderProfilesList();
        const scr = document.getElementById("up-profiles-screen");
        if (scr) scr.classList.add("show");
        if (DOM.messagesContent)
            DOM.messagesContent.classList.add("up-hidden");
        const header = document.querySelector("#messages-screen .settings-header");
        if (header) header.classList.add("up-hidden-header");
    }

    function hideProfilesScreen() {
        const scr = document.getElementById("up-profiles-screen");
        if (scr) scr.classList.remove("show");
        if (DOM.messagesContent)
            DOM.messagesContent.classList.remove("up-hidden");
        const header = document.querySelector("#messages-screen .settings-header");
        if (header) header.classList.remove("up-hidden-header");
    }

    function renderProfilesList() {
        const ul = document.getElementById("up-profiles-list");
        const empty = document.getElementById("up-profiles-empty");
        const card = document.getElementById("up-default-card");
        const listTitle = document.getElementById("up-list-title");
        if (!ul) return;
        ul.innerHTML = "";

        // 默认卡
        const def = getDefaultProfile();
        if (def && card) {
            card.style.display = "flex";
            const av = document.getElementById("up-default-avatar");
            const nm = document.getElementById("up-default-name");
            const ps = document.getElementById("up-default-persona");
            if (av)
                av.style.backgroundImage = `url('${def.avatar || PLACEHOLDER_AVATAR}')`;
            if (nm) nm.textContent = def.name || "(未命名)";
            if (ps) ps.textContent = def.persona ? def.persona.slice(0, 60) : "暂无人设描述";
        } else if (card) {
            card.style.display = "none";
        }

        if (!state.profiles.length) {
            if (empty) empty.style.display = "block";
            if (listTitle) listTitle.style.display = "none";
            return;
        }
        if (empty) empty.style.display = "none";
        if (listTitle) listTitle.style.display = "block";

        state.profiles.forEach((p) => {
            const li = document.createElement("li");
            const isDefault = p.id === state.defaultId;
            li.className = "up-profile-item" + (isDefault ? " is-default" : "");
            li.dataset.id = p.id;
            li.innerHTML = `
                <div class="up-profile-avatar" style="background-image:url('${escapeHtml(p.avatar || PLACEHOLDER_AVATAR)}')"></div>
                <div class="up-profile-info">
                    <div class="up-profile-name-row">
                        <span class="up-profile-name">${escapeHtml(p.name || "(未命名)")}</span>
                        ${isDefault ? '<span class="up-profile-badge">默认</span>' : ""}
                    </div>
                    <div class="up-profile-persona">${escapeHtml((p.persona || "暂无人设描述").slice(0, 50))}</div>
                </div>
                <button class="up-profile-action" data-act="more" aria-label="更多">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="5" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="12" cy="19" r="1.6"/></svg>
                </button>
            `;
            li.addEventListener("click", (e) => {
                if (e.target.closest('[data-act="more"]')) return;
                openProfileEditor(p.id);
            });
            li.querySelector('[data-act="more"]').addEventListener(
                "click",
                (e) => {
                    e.stopPropagation();
                    openProfileMenu(p.id, e.currentTarget);
                },
            );
            ul.appendChild(li);
        });
    }

    /* ---------- profile menu (设为默认 / 删除) ---------- */
    function openProfileMenu(id, anchor) {
        closeProfileMenu();
        const p = findProfile(id);
        if (!p) return;
        const menu = document.createElement("div");
        menu.className = "up-action-menu";
        menu.id = "up-action-menu";
        const isDefault = state.defaultId === id;
        menu.innerHTML = `
            <button data-act="default" ${isDefault ? "disabled" : ""}>${isDefault ? "已是默认" : "设为默认"}</button>
            <button data-act="edit">编辑</button>
            <button data-act="delete" class="danger">删除</button>
        `;
        document.body.appendChild(menu);
        const r = anchor.getBoundingClientRect();
        // 优先放在按钮下方右对齐
        const top = Math.min(r.bottom + 6, window.innerHeight - 160);
        const left = Math.max(8, r.right - 140);
        menu.style.top = top + "px";
        menu.style.left = left + "px";

        menu.addEventListener("click", async (e) => {
            const btn = e.target.closest("button");
            if (!btn) return;
            const act = btn.dataset.act;
            closeProfileMenu();
            if (act === "default") {
                state.defaultId = id;
                await saveDefaultId();
                renderProfilesList();
            } else if (act === "edit") {
                openProfileEditor(id);
            } else if (act === "delete") {
                await deleteProfile(id);
            }
        });
        setTimeout(() => {
            document.addEventListener("click", closeProfileMenu, { once: true });
        }, 0);
    }

    function closeProfileMenu() {
        const m = document.getElementById("up-action-menu");
        if (m) m.remove();
    }

    async function deleteProfile(id) {
        if (state.profiles.length <= 1) {
            alert("至少需要保留一个人设");
            return;
        }
        if (!confirm("删除该人设？正在使用它的对话会回退到默认人设。")) return;
        state.profiles = state.profiles.filter((p) => p.id !== id);
        if (state.defaultId === id) {
            state.defaultId = state.profiles[0].id;
            await saveDefaultId();
        }
        // 把所有指向被删 profile 的 contact 改成默认
        try {
            const data = await db().loadData(
                "messageContacts",
                "allContacts",
            );
            if (data && Array.isArray(data.value)) {
                let dirty = false;
                data.value.forEach((c) => {
                    if (c && c.userProfileId === id) {
                        c.userProfileId = state.defaultId;
                        dirty = true;
                    }
                });
                if (dirty)
                    await db().saveData(
                        "messageContacts",
                        "allContacts",
                        data.value,
                    );
            }
        } catch (e) {
            console.warn("[UserProfiles] 同步 contact 失败:", e);
        }
        await saveProfiles();
        renderProfilesList();
    }
    /* ---------- profile editor (新建 / 编辑) - 全屏页 ---------- */
    function ensureProfileEditor() {
        let m = document.getElementById("up-editor-page");
        if (m) return m;
        m = document.createElement("div");
        m.id = "up-editor-page";
        m.className = "up-editor-page";
        m.innerHTML = `
            <div class="up-editor-header">
                <button class="up-editor-back-btn" id="up-editor-back" aria-label="返回">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M15 18l-6-6 6-6"/>
                    </svg>
                </button>
                <span class="up-editor-title" id="up-editor-title">New Persona</span>
                <button class="up-editor-save-btn" id="up-editor-save" aria-label="保存">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="20 6 9 17 4 12"/>
                    </svg>
                </button>
            </div>
            <div class="up-editor-content">
                <div class="up-editor-avatar-card">
                    <div class="up-editor-avatar" id="up-editor-avatar"></div>
                    <input type="file" accept="image/*" id="up-editor-avatar-input" style="display:none">
                    <button class="up-editor-avatar-btn" id="up-editor-avatar-btn">更换头像</button>
                </div>
                <div class="up-editor-form">
                    <div class="up-editor-field">
                        <label>姓名</label>
                        <input type="text" id="up-editor-name" placeholder="给这个人设起个名字" maxlength="60">
                    </div>
                    <div class="up-editor-field">
                        <label>人设</label>
                        <textarea id="up-editor-persona" placeholder="描述你的偏好、身份、设定..." rows="6"></textarea>
                    </div>
                </div>
                <button class="up-editor-delete-btn" id="up-editor-delete" style="display:none">删除该人设</button>
            </div>
        `;
        // 放进 .content-mask 让它跟 chat-settings-page 一样在手机屏幕内做全屏，
        // 并能正确盖住任何 .screen
        const mount = document.querySelector(".content-mask") || document.body;
        mount.appendChild(m);

        m.querySelector("#up-editor-back").addEventListener("click", closeProfileEditor);
        m.querySelector("#up-editor-save").addEventListener("click", saveProfileEditor);
        m.querySelector("#up-editor-delete").addEventListener("click", async () => {
            if (state.editingProfileId) {
                await deleteProfile(state.editingProfileId);
                closeProfileEditor();
            }
        });
        m.querySelector("#up-editor-avatar-btn").addEventListener("click", () => {
            m.querySelector("#up-editor-avatar-input").click();
        });
        m.querySelector("#up-editor-avatar").addEventListener("click", () => {
            m.querySelector("#up-editor-avatar-input").click();
        });
        m.querySelector("#up-editor-avatar-input").addEventListener("change", async (e) => {
            const file = e.target.files && e.target.files[0];
            if (!file) return;
            try {
                const dataUrl = await readFileAsDataURL(file);
                const av = m.querySelector("#up-editor-avatar");
                av.style.backgroundImage = `url('${dataUrl}')`;
                av.dataset.value = dataUrl;
            } catch (err) {
                console.error("[UserProfiles] 读取头像失败:", err);
                alert("头像读取失败");
            }
            e.target.value = "";
        });
        return m;
    }

    function readFileAsDataURL(file) {
        if (window.iOSBabyMode && window.iOSBabyMode.enabled && file.size > 512e3) {
            return window.iOSBabyMode.safeCompressImage(file, {
                maxWidth: 400,
                maxHeight: 400,
                quality: 0.8,
            });
        }
        if (window.iOSBabyMode && window.iOSBabyMode.safeReadFileAsDataURL) {
            return window.iOSBabyMode.safeReadFileAsDataURL(file);
        }
        return new Promise((resolve, reject) => {
            const r = new FileReader();
            r.onload = (e) => resolve(e.target.result);
            r.onerror = reject;
            r.readAsDataURL(file);
        });
    }

    function openProfileEditor(id) {
        const m = ensureProfileEditor();
        state.editingProfileId = id;
        const titleEl = m.querySelector("#up-editor-title");
        const nameEl = m.querySelector("#up-editor-name");
        const personaEl = m.querySelector("#up-editor-persona");
        const avatarEl = m.querySelector("#up-editor-avatar");
        const deleteBtn = m.querySelector("#up-editor-delete");
        if (id) {
            const p = findProfile(id);
            if (!p) return;
            titleEl.textContent = "编辑人设";
            nameEl.value = p.name || "";
            personaEl.value = p.persona || "";
            avatarEl.style.backgroundImage = `url('${p.avatar || PLACEHOLDER_AVATAR}')`;
            avatarEl.dataset.value = p.avatar || "";
            // 仅当不是唯一/默认时显示删除
            if (deleteBtn) {
                const showDel = state.profiles.length > 1;
                deleteBtn.style.display = showDel ? "block" : "none";
            }
        } else {
            titleEl.textContent = "新建";
            nameEl.value = "";
            personaEl.value = "";
            avatarEl.style.backgroundImage = `url('${PLACEHOLDER_AVATAR}')`;
            avatarEl.dataset.value = "";
            if (deleteBtn) deleteBtn.style.display = "none";
        }
        m.classList.add("show");
        setTimeout(() => nameEl.focus(), 100);
    }

    function closeProfileEditor() {
        const m = document.getElementById("up-editor-page");
        if (m) m.classList.remove("show");
        state.editingProfileId = null;
        // 清除编辑器来源标志（如果用户取消则不自动应用）
        if (state.editorOpenSource === "picker") {
            state.editorOpenSource = null;
        }
    }

    async function saveProfileEditor() {
        const m = document.getElementById("up-editor-page");
        if (!m) return;
        const name = m.querySelector("#up-editor-name").value.trim();
        const persona = m.querySelector("#up-editor-persona").value.trim();
        const avatar =
            m.querySelector("#up-editor-avatar").dataset.value ||
            PLACEHOLDER_AVATAR;
        if (!name) {
            alert("请填写姓名");
            return;
        }
        let createdProfile = null;
        if (state.editingProfileId) {
            const p = findProfile(state.editingProfileId);
            if (p) {
                p.name = name;
                p.persona = persona;
                p.avatar = avatar;
                // 同步所有引用此 profile 的 contact 数据
                await syncProfileToContacts(p);
            }
        } else {
            const newP = {
                id: uid(),
                name,
                persona,
                avatar,
                createdAt: Date.now(),
            };
            state.profiles.push(newP);
            createdProfile = newP;
            if (!state.defaultId) {
                state.defaultId = newP.id;
                await saveDefaultId();
            }
        }
        await saveProfiles();

        // 来自 picker 的新建：自动应用到当前 contact
        const source = state.editorOpenSource;
        state.editorOpenSource = null;
        if (createdProfile && source === "picker" && window.currentOpenContact) {
            await pickProfileForCurrentContact(createdProfile.id);
        }

        closeProfileEditor();
        renderProfilesList();
        // 刷新可能已打开的 picker 列表
        refreshOpenPicker();
        // 刷新可能正在显示的新建对话框默认填充
        fillHiddenUserFromDefault();
    }

    async function syncProfileToContacts(profile) {
        try {
            const data = await db().loadData(
                "messageContacts",
                "allContacts",
            );
            if (!data || !Array.isArray(data.value)) return;
            let dirty = false;
            data.value.forEach((c) => {
                if (c && c.userProfileId === profile.id) {
                    c.user = c.user || {};
                    c.user.name = profile.name;
                    c.user.persona = profile.persona;
                    c.user.avatar = profile.avatar;
                    dirty = true;
                }
            });
            if (dirty) {
                await db().saveData(
                    "messageContacts",
                    "allContacts",
                    data.value,
                );
            }
        } catch (e) {
            console.warn("[UserProfiles] 同步 profile 到 contacts 失败:", e);
        }
    }

    /* ---------- 改造新建对话框 ---------- */
    function adaptAddContactModal() {
        if (!DOM.addContactModal) return;
        if (DOM.addContactModal.dataset.upAdapted === "1") return;
        DOM.addContactModal.dataset.upAdapted = "1";

        // 隐藏 user/char 切换 + user-form
        if (DOM.roleSwitcher) DOM.roleSwitcher.classList.add("up-hidden");
        if (DOM.userForm) DOM.userForm.classList.add("up-hidden");

        // 在 ai-form 里追加一个提示卡
        injectUserHintCard();

        // 监听打开（display 从 none -> flex/block）：自动用 default profile 填充隐藏字段
        const obs = new MutationObserver(() => {
            const display = DOM.addContactModal.style.display;
            if (display && display !== "none") {
                fillHiddenUserFromDefault();
            }
        });
        obs.observe(DOM.addContactModal, {
            attributes: true,
            attributeFilter: ["style"],
        });
        // 立即同步一次
        fillHiddenUserFromDefault();
    }

    function injectUserHintCard() {
        const aiForm = document.getElementById("ai-form");
        if (!aiForm || aiForm.querySelector(".up-user-hint-card")) return;
        const hint = document.createElement("div");
        hint.className = "up-user-hint-card";
        hint.innerHTML = `
            <svg class="up-user-hint-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="16" x2="12" y2="12"/>
                <line x1="12" y1="8" x2="12.01" y2="8"/>
            </svg>
            <div class="up-user-hint-text">USER使用默认人设，可在<strong>聊天设置</strong>内换</div>
        `;
        // 把它插在 ai-form 第一个子元素之前（顶部）
        aiForm.parentNode.insertBefore(hint, aiForm);
    }

    function fillHiddenUserFromDefault() {
        const p = getDefaultProfile();
        if (!p) return;
        if (DOM.userNameInput) DOM.userNameInput.value = p.name || "我";
        if (DOM.userPersonaInput)
            DOM.userPersonaInput.value = p.persona || "";
        if (DOM.userAvatarPreview)
            DOM.userAvatarPreview.src = p.avatar || PLACEHOLDER_AVATAR;
    }

    // 新建保存后绑定 profileId（在 main.min.js 写入后异步补字段）
    async function bindNewContactToDefault() {
        const data = await db().loadData("messageContacts", "allContacts");
        if (!data || !Array.isArray(data.value)) return;
        const def = getDefaultProfile();
        if (!def) return;
        let dirty = false;
        // 仅给最近未绑定的联系人补
        data.value.forEach((c) => {
            if (c && !c.userProfileId) {
                c.userProfileId = def.id;
                // 同步写回 user 字段，保证一致
                c.user = c.user || {};
                c.user.name = def.name;
                c.user.persona = def.persona;
                c.user.avatar = def.avatar;
                dirty = true;
            }
        });
        if (dirty)
            await db().saveData("messageContacts", "allContacts", data.value);
    }

    /* ---------- 聊天设置：选择器 + 隐藏 user tab ---------- */
    function adaptChatSettings() {
        if (!DOM.chatSettingsPage) return;
        if (DOM.chatSettingsPage.dataset.upAdapted === "1") return;
        DOM.chatSettingsPage.dataset.upAdapted = "1";

        // 隐藏 user tab
        if (DOM.roleTabUser) DOM.roleTabUser.classList.add("up-hidden");
        if (DOM.roleTabAi) {
            // 单 tab 时让样式更紧凑
            const wrap = DOM.roleTabAi.parentElement;
            if (wrap) wrap.classList.add("up-single-tab");
        }

        // 注入 user picker 长条到 profile-info 下方（角色名下面）
        const profileInfo = DOM.chatSettingsPage.querySelector(".profile-info");
        const tabsWrap = DOM.chatSettingsPage.querySelector(".role-tabs-wrapper");
        if (!profileInfo) return;

        const picker = document.createElement("div");
        picker.id = "up-chat-user-picker";
        picker.className = "up-chat-user-picker";
        picker.innerHTML = `
            <div class="up-picker-avatar" id="up-picker-avatar"></div>
            <div class="up-picker-text">
                <div class="up-picker-label">当前用户人设</div>
                <div class="up-picker-name" id="up-picker-name">未选择</div>
            </div>
            <svg class="up-picker-chevron" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="9 18 15 12 9 6"/>
            </svg>
        `;
        // 放在 role-tabs 之后
        if (tabsWrap && tabsWrap.parentElement === profileInfo) {
            tabsWrap.parentElement.insertBefore(picker, tabsWrap.nextSibling);
        } else {
            profileInfo.appendChild(picker);
        }
        picker.addEventListener("click", openUserPicker);

        // hook 当聊天设置页打开时刷新选择器显示
        const settingsObs = new MutationObserver(() => {
            if (DOM.chatSettingsPage.classList.contains("active")) {
                syncPickerWithCurrentContact();
            }
        });
        settingsObs.observe(DOM.chatSettingsPage, {
            attributes: true,
            attributeFilter: ["class"],
        });

        // 也 hook 「聊天设置」入口按钮（chat-settings-button），保证及时同步
        const entryBtn = document.getElementById("chat-settings-button");
        if (entryBtn && !entryBtn.dataset.upHooked) {
            entryBtn.dataset.upHooked = "1";
            entryBtn.addEventListener("click", () => {
                setTimeout(syncPickerWithCurrentContact, 200);
            });
        }
        // 初次同步一次
        setTimeout(syncPickerWithCurrentContact, 200);
    }

    function syncPickerWithCurrentContact() {
        const c = window.currentOpenContact;
        if (!c) return;
        // 确保 contact 有 profileId
        if (!c.userProfileId) ensureProfileForContact(c);
        const p = findProfile(c.userProfileId);
        const av = document.getElementById("up-picker-avatar");
        const nm = document.getElementById("up-picker-name");
        if (p) {
            if (av)
                av.style.backgroundImage = `url('${p.avatar || PLACEHOLDER_AVATAR}')`;
            if (nm) nm.textContent = p.name || "(未命名)";
            // 同步到隐藏的 chat-user-* 字段，防止 main.little.js 保存时覆盖
            syncHiddenChatUserFields(p);
        } else if (av && nm) {
            av.style.backgroundImage = `url('${PLACEHOLDER_AVATAR}')`;
            nm.textContent = "未选择";
        }
        state.currentPickerContactId = c.id;
        state.currentPickerProfileId = c.userProfileId;
    }

    function syncHiddenChatUserFields(p) {
        if (!p) return;
        const nameInput = document.getElementById("chat-user-name-input");
        const personaInput = document.getElementById("chat-user-persona-input");
        const avPrev = document.getElementById("chat-user-avatar-preview");
        if (nameInput) nameInput.value = p.name || "";
        if (personaInput) personaInput.value = p.persona || "";
        if (avPrev)
            avPrev.style.backgroundImage = `url('${p.avatar || PLACEHOLDER_AVATAR}')`;
    }

    /* ---------- user picker 弹窗 ---------- */
    function ensureUserPickerSheet() {
        let sh = document.getElementById("up-picker-sheet");
        if (sh) return sh;
        sh = document.createElement("div");
        sh.id = "up-picker-sheet";
        sh.className = "up-picker-sheet";
        sh.innerHTML = `
            <div class="up-picker-sheet-mask"></div>
            <div class="up-picker-sheet-content">
                <div class="up-picker-sheet-handle"></div>
                <div class="up-picker-sheet-header">
                    <span class="up-picker-sheet-title">更换人设</span>
                    <button class="up-picker-sheet-close" id="up-picker-close">完成</button>
                </div>
                <ul class="up-picker-sheet-list" id="up-picker-sheet-list"></ul>
                <button class="up-picker-sheet-add" id="up-picker-sheet-add">+ 新建人设</button>
            </div>
        `;
        document.body.appendChild(sh);
        sh.querySelector(".up-picker-sheet-mask").addEventListener("click", closeUserPicker);
        sh.querySelector("#up-picker-close").addEventListener("click", closeUserPicker);
        sh.querySelector("#up-picker-sheet-add").addEventListener("click", () => {
            // 标记：本次新建是从 picker 触发，保存后自动应用到当前 contact
            state.editorOpenSource = "picker";
            closeUserPicker();
            openProfileEditor(null);
        });
        return sh;
    }

    function openUserPicker() {
        const sh = ensureUserPickerSheet();
        renderPickerList();
        sh.classList.add("show");
    }

    function closeUserPicker() {
        const sh = document.getElementById("up-picker-sheet");
        if (sh) sh.classList.remove("show");
    }

    function refreshOpenPicker() {
        const sh = document.getElementById("up-picker-sheet");
        if (sh && sh.classList.contains("show")) renderPickerList();
    }

    function renderPickerList() {
        const ul = document.getElementById("up-picker-sheet-list");
        if (!ul) return;
        ul.innerHTML = "";
        const c = window.currentOpenContact;
        const currentId = c ? c.userProfileId : null;
        state.profiles.forEach((p) => {
            const li = document.createElement("li");
            li.className =
                "up-picker-row" + (p.id === currentId ? " selected" : "");
            li.dataset.id = p.id;
            li.innerHTML = `
                <div class="up-picker-row-avatar" style="background-image:url('${escapeHtml(p.avatar || PLACEHOLDER_AVATAR)}')"></div>
                <div class="up-picker-row-info">
                    <div class="up-picker-row-name">
                        <span class="up-picker-row-name-text">${escapeHtml(p.name || "(未命名)")}</span>
                        ${p.id === state.defaultId ? '<span class="up-picker-row-badge">默认</span>' : ""}
                    </div>
                    <div class="up-picker-row-persona">${escapeHtml((p.persona || "暂无人设描述").slice(0, 60))}</div>
                </div>
                <div class="up-picker-row-check">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                </div>
            `;
            li.addEventListener("click", async () => {
                await pickProfileForCurrentContact(p.id);
            });
            ul.appendChild(li);
        });
    }

    async function pickProfileForCurrentContact(profileId) {
        const c = window.currentOpenContact;
        if (!c) {
            closeUserPicker();
            return;
        }
        const p = findProfile(profileId);
        if (!p) return;
        c.userProfileId = profileId;
        applyProfileToContact(c);

        // 写回 messageContacts（保持 main.min.js 不用改也能持久化）
        try {
            const data = await db().loadData(
                "messageContacts",
                "allContacts",
            );
            if (data && Array.isArray(data.value)) {
                const idx = data.value.findIndex((x) => x.id === c.id);
                if (idx >= 0) {
                    data.value[idx].userProfileId = profileId;
                    data.value[idx].user = {
                        name: p.name,
                        persona: p.persona,
                        avatar: p.avatar,
                    };
                    await db().saveData(
                        "messageContacts",
                        "allContacts",
                        data.value,
                    );
                }
            }
        } catch (e) {
            console.warn("[UserProfiles] 持久化 contact.userProfileId 失败:", e);
        }
        syncPickerWithCurrentContact();
        renderPickerList();
        closeUserPicker();
    }

    /* ---------- 启动 ---------- */
    async function init() {
        if (state.initialized) return;
        if (!db()) {
            // Kl 还没加载完，稍后重试
            setTimeout(init, 200);
            return;
        }
        try {
            await db().init?.();
            installKlHooks();
            await loadProfilesFromDB();
            await migrateExistingContacts();
            // 迁移之后重新读一次保证 state.profiles 是最新
            await loadProfilesFromDB();

            refreshDOMRefs();
            renderSettingsTab();
            adaptAddContactModal();
            adaptChatSettings();

            // hook 新建对话框的 Save 按钮：保存后给新 contact 补 userProfileId
            const saveBtn = document.getElementById("save-contact-btn");
            if (saveBtn && !saveBtn.dataset.upHooked) {
                saveBtn.dataset.upHooked = "1";
                saveBtn.addEventListener(
                    "click",
                    () => {
                        // 等 main.min.js 的异步保存写完
                        setTimeout(bindNewContactToDefault, 600);
                    },
                    true,
                );
            }

            state.initialized = true;
            console.log(
                "[UserProfiles] 初始化完成。profiles=",
                state.profiles.length,
                "default=",
                state.defaultId,
            );
        } catch (e) {
            console.error("[UserProfiles] 初始化失败:", e);
        }
    }

    // 暴露给外部调试
    window.UserProfiles = {
        getState: () => ({ ...state }),
        getProfiles: () => state.profiles.slice(),
        getDefault: getDefaultProfile,
        reinit: () => {
            state.initialized = false;
            return init();
        },
    };

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", () =>
            setTimeout(init, 300),
        );
    } else {
        setTimeout(init, 300);
    }
})();
