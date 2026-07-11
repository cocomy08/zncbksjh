/**
 * Backup and Restore Logic Repair Script
 * Extracted and fixed from main.min.js to resolve event listener issues.
 */

(function () {
    console.log("🚀 Backup/Restore Repair Script Loaded");

    // Polyfill/Alias for Boomboom.js which expects dbHelper
    if (window.Kl && !window.dbHelper) {
        window.dbHelper = window.Kl;
        console.log("🔧 Aliased window.Kl to window.dbHelper for compatibility");
    } else if (!window.Kl && !window.dbHelper) {
        console.warn("⚠️ Database Manager (Kl/dbHelper) not found! Backup/Restore may fail.");
        // Attempt to find it on window if it has a different name? 
        // For now, we hope main.min.js exposes it.
        // If main.min.js runs later, we might need to poll for it.
        const checkDB = setInterval(() => {
            if (window.Kl) {
                window.dbHelper = window.Kl;
                console.log("🔧 Late-bound window.Kl to window.dbHelper");
                clearInterval(checkDB);
            }
        }, 500);
    }

    const SETTINGS_STORES = [
        "settingsStore",
        "messageContacts",
        "groupChats",
        "worldBooks",
        "worldBookGroups",
        "gachaPosts",
        "emojiStore",
        "iconPresets",
        "datingSetupStore",
        "datingHistoryStore",
        "writingStylePresets",
        "fontUrlStore",
        "wowoData",
        "memoryCheques",
        "musicPlaylists",
    ];

    // Helper functions
    function sanitizeString(e) {
        return e
            ? e.length < 100
                ? e
                : `${e.length}_${e.substring(0, 50)}_${e.substring(e.length - 50)}`
            : "empty";
    }

    const isIOS = (function () {
        const e = navigator.userAgent || navigator.vendor || window.opera || "";
        return (
            /iPad|iPhone|iPod/.test(e) ||
            (navigator.platform && /iP(ad|hone|od)/.test(navigator.platform))
        );
    })();

    // Image deduplication logic
    async function processImages(e, t, n, a) {
        if (e && "object" == typeof e)
            for (const o in e) {
                const s = e[o];
                if ("string" == typeof s && s.startsWith("data:image/")) {
                    console.log(`📸 发现图片字段: ${o}, 长度: ${s.length}`);
                    const i = s.match(/^data:image\/(\w+);base64,/);
                    if (!i) {
                        console.warn(`⚠️  无法解析图片格式: ${o}`);
                        continue;
                    }
                    const r = i[1];
                    let l = s.substring(i[0].length);
                    const c = sanitizeString(l),
                        d = a.get(c);
                    if (d)
                        ((e[o] = `backup://images/${d}`),
                            console.log(`♻️  图片已去重: ${o} -> ${d}`));
                    else {
                        n.count++;
                        const s = `img_${n.count}.${r}`;
                        (t.file(s, l, {
                            base64: !0,
                        }),
                            a.set(c, s),
                            (e[o] = `backup://images/${s}`),
                            (l = null),
                            console.log(`✅ 图片已保存并替换: ${o} -> ${s}`));
                    }
                    (n.loopTick++,
                        isIOS &&
                        n.loopTick % 5 == 0 &&
                        (await new Promise((e) => setTimeout(e, 10))));
                } else if (
                    "string" == typeof s &&
                    s.trim().startsWith("url(") &&
                    s.includes("data:image/")
                ) {
                    const i = s.match(/^url\(["']?(data:image\/[^"']+)["']?\)$/);
                    if (i) {
                        const s = i[1],
                            r = s.match(/^data:image\/(\w+);base64,/);
                        if (!r) continue;
                        const l = r[1];
                        let c = s.substring(r[0].length);
                        const d = sanitizeString(c),
                            u = a.get(d);
                        if (u) e[o] = `url("backup://images/${u}")`;
                        else {
                            n.count++;
                            const s = `img_${n.count}.${l}`;
                            (t.file(s, c, {
                                base64: !0,
                            }),
                                a.set(d, s),
                                (e[o] = `url("backup://images/${s}")`),
                                (c = null));
                        }
                        (n.loopTick++,
                            isIOS &&
                            n.loopTick % 5 == 0 &&
                            (await new Promise((e) => setTimeout(e, 10))));
                    }
                } else "object" == typeof s && null !== s && (await processImages(s, t, n, a));
            }
    }

    function exportStore(storeName, imagesFolder, progressObj, dedupeMap) {
        return new Promise((resolve, reject) => {
            const dbRef = window.dbHelper || window.Kl;
            if (!dbRef || !dbRef.dbName) {
                return reject(new Error("Database Manager (Kl) not initialized"));
            }

            const i = indexedDB.open(dbRef.dbName, dbRef.dbVersion);
            ((i.onsuccess = (evt) => {
                const db = evt.target.result;
                const r = db.transaction([storeName], "readonly")
                    .objectStore(storeName)
                    .openCursor(),
                    l = [];
                l.push("[");
                let first = !0,
                    count = 0;
                ((r.onsuccess = async (evt2) => {
                    const cursor = evt2.target.result;
                    if (cursor) {
                        const key = cursor.key;

                        first ? (first = !1) : l.push(",");
                        let record = cursor.value;

                        try {
                            // Use structuredClone if available, else JSON
                            if (typeof structuredClone === 'function') {
                                record = structuredClone(record);
                            } else {
                                record = JSON.parse(JSON.stringify(record));
                            }

                            await processImages(record, imagesFolder, progressObj, dedupeMap);

                            const json = JSON.stringify(record);
                            (l.push(json),
                                count++,
                                isIOS &&
                                count % 5 == 0 &&
                                (await new Promise((r) => setTimeout(r, 20))));
                        } catch (err) {
                            console.warn("处理记录失败", err);
                        }
                        cursor.continue();
                    } else {
                        l.push("]");
                        const blob = new Blob(l, {
                            type: "application/json",
                        });
                        ((l.length = 0), resolve(blob));
                    }
                }),
                    (r.onerror = (err) => {
                        reject(err);
                    }));
            }),
                (i.onerror = (err) => {
                    reject(err);
                }));
        });
    }

    async function restoreImages(e, t) {
        if (e && "object" == typeof e)
            for (const n in e) {
                const a = e[n];
                try {
                    if ("string" == typeof a && a.startsWith("backup://images/")) {
                        const o = a.replace("backup://images/", ""),
                            s = await getImageBase64(t, o);
                        s &&
                            ((e[n] = s), isIOS && (await new Promise((e) => setTimeout(e, 0))));
                    } else if (
                        "string" == typeof a &&
                        a.startsWith('url("backup://images/')
                    ) {
                        const o = a.match(/url\("backup:\/\/images\/([^"]+)"\)/);
                        if (o && o[1]) {
                            const a = o[1],
                                s = await getImageBase64(t, a);
                            s &&
                                ((e[n] = `url("${s}")`),
                                    isIOS && (await new Promise((e) => setTimeout(e, 0))));
                        }
                    } else "object" == typeof a && null !== a && (await restoreImages(a, t));
                } catch (e) {
                    console.warn(`图片还原失败 (${n}):`, e.message);
                }
            }
    }

    async function getImageBase64(e, t) {
        const n = e.file(`images/${t}`) || e.file(t);
        if (!n) return null;
        const a = await n.async("base64");
        let o = "data:image/jpeg;base64,";
        return (
            t.toLowerCase().endsWith(".png")
                ? (o = "data:image/png;base64,")
                : t.toLowerCase().endsWith(".gif")
                    ? (o = "data:image/gif;base64,")
                    : t.toLowerCase().endsWith(".webp") &&
                    (o = "data:image/webp;base64,"),
            o + a
        );
    }

    async function importStore(e, t, n, a, o, s = 0, i = 1) {
        const dbRef = window.dbHelper || window.Kl;
        (console.log(`[Import] 开始导入表: ${e}`),
            (n.textContent = `正在读取: ${e}...`));
        const r = (s / i) * 100,
            l = 100 / i;
        (a && (a.style.width = `${Math.round(r)}%`),
            await dbRef.clearStore(e),
            console.log(`[Import] 读取 ${e} JSON 数据...`));
        const c = await t.async("string");
        let d;
        (console.log(
            `[Import] ${e} 读取完成，大小: ${(c.length / 1024).toFixed(1)} KB`,
        ),
            (n.textContent = `解析 ${e}...`),
            a && (a.style.width = `${Math.round(r + 0.1 * l)}%`));
        try {
            d = JSON.parse(c);
        } catch (t) {
            throw (
                console.error(`[Import] ${e} JSON 解析失败:`, t),
                new Error(`${e} 数据格式错误`)
            );
        }
        if (!Array.isArray(d))
            return void console.warn(`[Import] ${e} 不是数组，跳过`);
        console.log(`[Import] ${e} 解析完成，共 ${d.length} 条记录`);
        const u = isIOS ? 10 : 50;
        let m = 0;
        for (let t = 0; t < d.length; t += u) {
            const s = d.slice(t, Math.min(t + u, d.length));
            m += s.length;
            const i = (m / d.length) * 0.8,
                c = Math.round(r + l * (0.1 + i));
            ((n.textContent = `恢复 ${e}: ${m}/${d.length}`),
                a && (a.style.width = `${Math.min(95, c)}%`));
            for (const item of s)
                try {
                    await restoreImages(item, o);
                    if ("messageContacts" === e && item.id === "allContacts" && Array.isArray(item.value)) {
                        for (const contact of item.value) {
                            if (contact.history && contact.history.length > 0) {
                                await dbRef.saveData("messageContacts", `history_${contact.id}`, contact.history);
                                contact.history = [];
                                contact.hasSeparatedHistory = true;
                            }
                        }
                    }
                } catch (err) {
                    console.warn("[Import] 图片还原失败:", err);
                }
            const p = s.map((t) => {
                try {
                    return "emojiStore" === e
                        ? dbRef.updateRecord(e, t)
                        : void 0 !== t.id && void 0 !== t.value
                            ? dbRef.saveData(e, t.id, t.value)
                            : void 0 !== t.id
                                ? dbRef.updateRecord(e, t)
                                : Promise.resolve();
                } catch (e) {
                    return (console.warn("[Import] 记录写入失败:", e), Promise.resolve());
                }
            });
            (await Promise.all(p),
                isIOS
                    ? await new Promise((e) => setTimeout(e, 50))
                    : await new Promise((e) => setTimeout(e, 10)));
        }
        console.log(`✅ [Import] ${e} 导入完成，共 ${m} 条`);
    }

    // ==========================================
    // Event Listener Attachments
    // ==========================================

    // Helper to get element safely
    function get(id) {
        return document.getElementById(id);
    }

    const start = () => {
        const backupBtn = get('backup-data-btn');
        const importBtn = get('import-data-btn');
        const fileInput = get('import-file-input');

        if (backupBtn) {
            console.log("✅ Backup Button found, linking event...");
            // Use cloned element to remove old listeners if necessary?
            // For now, simple addEventListener.
            backupBtn.onclick = async function () { // Using onclick to override previous if simple property
                console.log("📦 Backup button clicked (via repair script)");
                let e = null;
                try {
                    const t = new Date(),
                        n = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`,
                        a = new JSZip(),
                        o = a.folder("data"),
                        s = a.folder("images");

                    // Loader
                    e = document.createElement("div");
                    e.className = "system-loader-overlay";
                    e.innerHTML = `
                        <div class="system-loader-card">
                            <div class="loader-icon-wrapper bounce-icon">📦</div>
                            <div class="loader-title">正在备份数据</div>
                            <div class="loader-desc" id="backup-status-text">准备开始...</div>
                            <div class="progress-track">
                                <div class="progress-fill" id="backup-progress-bar"></div>
                            </div>
                        </div>
                    `;
                    document.body.appendChild(e);

                    const i = document.getElementById("backup-status-text"),
                        r = document.getElementById("backup-progress-bar");

                    if (!i || !r) throw new Error("UI 初始化失败");

                    // iOS Confirmation
                    if (isIOS) {
                        if (!confirm("⚠️ 继续备份？")) {
                            if (e && document.body.contains(e)) document.body.removeChild(e);
                            return;
                        }
                    }

                    console.log("🚀 开始图片去重备份...");
                    const l = {
                        count: 0,
                        loopTick: 0,
                    },
                        c = new Map();

                    for (let e = 0; e < SETTINGS_STORES.length; e++) {
                        const t = SETTINGS_STORES[e];
                        if (i) i.textContent = `提取中: ${t}`;
                        const n = await exportStore(t, s, l, c);
                        o.file(`${t}.json`, n);
                        const a = Math.round(((e + 1) / SETTINGS_STORES.length) * 50);
                        if (r) r.style.width = `${a}%`;
                    }
                    c.clear();

                    const d = {
                        themePresets: localStorage.getItem("themePresets"),
                        bubblePresets: localStorage.getItem("bubblePresets"),
                        meetuStyles: localStorage.getItem("meetuStyles_backup"),
                    };

                    (a.file("localStoragePresets.json", JSON.stringify(d)),
                        console.log("✅ 已导出 localStorage 预设"),
                        a.file(
                            "version.json",
                            JSON.stringify({
                                version: "3.2",
                                type: "SevenPhoneBackup_Split_Dedupe",
                                date: n,
                            }),
                        ),
                        i && (i.textContent = `正在打包... (共 ${l.count} 张图片)`));

                    const u = await a.generateAsync(
                        {
                            type: "blob",
                            compression: "DEFLATE",
                            compressionOptions: {
                                level: isIOS ? 1 : 5,
                            },
                            streamFiles: !0,
                        },
                        (e) => {
                            const t = 50 + e.percent / 2;
                            (i && (i.textContent = `压缩中: ${e.percent.toFixed(0)}%`),
                                r && (r.style.width = `${t}%`));
                        },
                    ),
                        m = URL.createObjectURL(u),
                        p = document.createElement("a");
                    ((p.download = `phone_77_${n}.zip`),
                        (p.href = m),
                        document.body.appendChild(p),
                        p.click(),
                        document.body.removeChild(p),
                        setTimeout(() => URL.revokeObjectURL(m), 1e4),
                        e && document.body.contains(e) && document.body.removeChild(e),
                        console.log(
                            `备份完成，去重后共存图 ${l.count} 张，体积: ${(u.size / 1024 / 1024).toFixed(2)} MB`,
                        ));
                } catch (t) {
                    (console.error("备份失败:", t),
                        e && document.body.contains(e) && document.body.removeChild(e),
                        alert(`❌ 备份失败: ${t.message}`));
                }
            };
        }

        if (importBtn && fileInput) {
            console.log("✅ Import Button found, linking event...");
            importBtn.onclick = () => fileInput.click();

            // Remove old listeners to prevent double execution if possible?
            // We can't remove anonymous listeners easily.
            // But 'change' event on file input is what triggers import.
            // We should use onchange property to override.
            fileInput.onchange = async function (e) {
                const dbRef = window.dbHelper || window.Kl;
                const t = e.target.files[0];
                if (!t) return;

                const n = t.name.toLowerCase(),
                    a = n.endsWith(".zip"),
                    o = n.endsWith(".json");

                if (a && "undefined" == typeof JSZip)
                    return (
                        alert(
                            "❌ JSZip 库尚未加载完成，请稍后再试！\n\n提示：页面加载后需要等待约 1-2 秒，JSZip 才会完成加载。",
                        ),
                        void (e.target.value = "")
                    );

                if (
                    !confirm(
                        "⚠️ 警告：导入将覆盖当前所有数据！\n建议先备份现有数据。\n\n确定要继续吗？",
                    )
                )
                    return void (e.target.value = "");

                const s = document.createElement("div");
                ((s.className = "system-loader-overlay"),
                    (s.innerHTML = `
                    <div class="system-loader-card">
                        <div class="loader-icon-wrapper">
                            <div class="spinner-ios"></div>
                        </div>
                        <div class="loader-title">正在恢复数据</div>
                        <div class="loader-desc" id="import-status-text">解析文件中...</div>
                        <div class="progress-track">
                            <div class="progress-fill" id="import-progress-bar"></div>
                        </div>
                    </div>
                `),
                    document.body.appendChild(s));

                const i = document.getElementById("import-status-text"),
                    r = document.getElementById("import-progress-bar");

                try {
                    if ((console.log("📂 开始解析备份文件..."), o)) {
                        (console.log("📄 检测到 JSON 格式备份，使用旧版导入逻辑..."),
                            (i.textContent = "正在读取 JSON 文件..."));
                        const e = await t.text(),
                            n = JSON.parse(e);
                        let a = 0;
                        const o = Object.keys(n);
                        for (let e = 0; e < o.length; e++) {
                            const s = o[e],
                                l = n[s];
                            if (!Array.isArray(l) || 0 === l.length) continue;
                            i.textContent = `正在恢复: ${s}...`;
                            const c = Math.round(((e + 1) / o.length) * 100);
                            r && (r.style.width = `${c}%`);
                            try {
                                await dbRef.clearStore(s);
                            } catch (e) {
                                console.warn(`跳过清空不存在的表: ${s}`);
                                continue;
                            }
                            let d = isIOS ? 10 : 50;
                            if (isIOS && t && t.size && t.size > 10485760) {
                                d = 5;
                                i.textContent = "iOS 大文件导入：启用超低速模式";
                            }

                            for (let t = 0; t < l.length; t += d) {
                                const n = Math.min(t + d, l.length),
                                    a = l.slice(t, n),
                                    c = Math.round(((e + t / l.length) / o.length) * 100);
                                ((i.textContent = `恢复 ${s}: ${t}/${l.length}`),
                                    r && (r.style.width = `${c}%`));
                                for (const e of a)
                                    try {
                                        void 0 !== e.id && void 0 !== e.value
                                            ? await dbRef.saveData(s, e.id, e.value)
                                            : void 0 !== e.id && (await dbRef.updateRecord(s, e));
                                    } catch (t) {
                                        console.warn("跳过无效记录:", e);
                                    }
                                await new Promise((e) => setTimeout(e, 20));
                            }
                            (a++, console.log(`✅ 表 ${s} 恢复完成，共 ${l.length} 条`));
                        }
                        return (
                            document.body.removeChild(s),
                            alert(`🎉 JSON 导入成功！\\n成功恢复了 ${a} 个模块的数据。`),
                            void location.reload()
                        );
                    }
                    if (a) {
                        (console.log("📦 检测到 ZIP 格式备份，使用新版导入逻辑..."));
                        if (isIOS && t && t.size && t.size > 10485760 && !confirm("⚠️ 检测到 iOS 设备且导入文件较大，为避免崩溃将启用超低速恢复模式，是否继续导入？")) {
                            if (document.body.contains(s)) document.body.removeChild(s);
                            e.target.value = "";
                            return;
                        }

                        const n = await JSZip.loadAsync(t),
                            verFile = n.file("version.json");
                        if (verFile) {
                            const e = JSON.parse(await verFile.async("string"));
                            console.log("备份版本信息:", e);
                        }

                        let l = 0;
                        for (const e of SETTINGS_STORES) {
                            let t = n.file(`${e}.json`) || n.file(`data/${e}.json`);
                            if (!t) {
                                console.log(`跳过: ZIP中未找到 ${e} 表的数据`);
                                continue;
                            }
                            const a = SETTINGS_STORES.indexOf(e),
                                o = SETTINGS_STORES.length,
                                currP = Math.round((a / o) * 100);
                            if (r) r.style.width = `${currP}%`;

                            try {
                                (await importStore(e, t, i, r, n, a, o), l++);
                                const s = Math.round(((a + 1) / o) * 100);
                                (r && (r.style.width = `${s}%`),
                                    console.log(`✅ ${e} 导入完成 (${s}%)`));
                            } catch (a) {
                                console.error(`流式导入失败: ${e}`, a);
                                // Fallback
                                let o = 0;
                                if (
                                    (t._data &&
                                        t._data.uncompressedSize &&
                                        (o = t._data.uncompressedSize),
                                        o > 0 && o < 5242880)
                                ) {
                                    console.log("尝试回退到普通模式...");
                                    try {
                                        const a = await t.async("string"),
                                            o = JSON.parse(a);
                                        if (Array.isArray(o)) {
                                            await dbRef.clearStore(e);
                                            for (const t of o)
                                                (await restoreImages(t, n),
                                                    "emojiStore" === e
                                                        ? await dbRef.updateRecord(e, t)
                                                        : void 0 !== t.id && void 0 !== t.value
                                                            ? await dbRef.saveData(e, t.id, t.value)
                                                            : void 0 !== t.id && (await dbRef.updateRecord(e, t)));
                                            (l++, console.log("✅ 回退模式导入成功"));
                                        }
                                    } catch (e) {
                                        console.error("回退模式也失败了", e);
                                    }
                                } else console.warn(`文件过大或无法读取大小 (${o})，放弃回退模式`);
                            }
                        }

                        i.textContent = "正在完成...";
                        const c = n.file("localStoragePresets.json");
                        if (c)
                            try {
                                const e = await c.async("string"),
                                    t = JSON.parse(e);
                                (t.themePresets &&
                                    (localStorage.setItem("themePresets", t.themePresets),
                                        console.log("✅ 已恢复主题预设")),
                                    t.bubblePresets &&
                                    (localStorage.setItem("bubblePresets", t.bubblePresets),
                                        console.log("✅ 已恢复气泡预设")),
                                    t.meetuStyles &&
                                    (localStorage.setItem("meetuStyles_backup", t.meetuStyles),
                                        console.log("✅ 已恢复笔风预设")));
                            } catch (e) {
                                console.warn("localStorage 预设恢复失败:", e);
                            }

                        if (typeof runDiagnosticCheck === 'function') await runDiagnosticCheck();

                        if (document.body.contains(s)) document.body.removeChild(s);
                        alert(`🎉 导入成功！\n成功恢复了 ${l} 个模块的数据。`);
                        location.reload();
                    } else {
                        // Not zip and not json (should be caught by file filter but just in case)
                        alert("不支持的文件格式");
                        document.body.removeChild(s);
                        e.target.value = "";
                    }

                } catch (e) {
                    (console.error("导入过程中出错:", e),
                        document.body.contains(s) && document.body.removeChild(s),
                        alert(`❌ 导入失败: ${e.message}`));
                    e.target.value = "";
                }
            };
        }
    };

    // Auto start if ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', start);
    } else {
        start();
    }
})();
