(function() {
    // 1. 初始化黑匣子配置
    const LOG_KEY = 'crash_reporter_logs';
    const LAST_SESSION_KEY = 'crash_reporter_last_session';
    const MAX_LOGS = 200; // 只保留最近200条，防止自己把内存撑爆

    // 2. 定义日志存储结构
    let logs = [];
    try {
        const saved = localStorage.getItem(LOG_KEY);
        if (saved) logs = JSON.parse(saved);
    } catch(e) {}

    // 3. 核心记录函数
    function writeLog(level, message, errorObj = null) {
        const time = new Date().toLocaleTimeString();
        const logEntry = `[${time}] [${level}] ${message} ${errorObj ? JSON.stringify(errorObj, Object.getOwnPropertyNames(errorObj)) : ''}`;
        
        logs.push(logEntry);
        if (logs.length > MAX_LOGS) logs.shift(); // 保持队列长度

        // 关键：每条主要日志都同步写入 storage，确保崩溃前能存下来
        // (为了性能，普通log可以不存，但 error 必须存)
        try {
            localStorage.setItem(LOG_KEY, JSON.stringify(logs));
        } catch(e) {
            // 存储满了也没办法，只能忽略
        }
    }

    // 4. 拦截全局错误 (Window Error)
    window.onerror = function(msg, url, line, col, error) {
        writeLog('CRASH', `全局错误: ${msg} @ ${line}:${col}`, error);
        return false; // 不阻止默认报告
    };

    // 5. 拦截 Promise 错误
    window.onunhandledrejection = function(event) {
        writeLog('PROMISE', `未捕获的 Promise: ${event.reason}`);
    };

    // 6. 拦截 console 输出 (把控制台日志也偷出来)
    const originalLog = console.log;
    const originalWarn = console.warn;
    const originalError = console.error;

    console.log = function(...args) {
        originalLog.apply(console, args);
        // 只记录关键步骤，避免刷屏
        if (args[0] && typeof args[0] === 'string' && (args[0].includes('Step') || args[0].includes('===') || args[0].includes('加载'))) {
            writeLog('LOG', args.join(' '));
        }
    };

    console.warn = function(...args) {
        originalWarn.apply(console, args);
        writeLog('WARN', args.join(' '));
    };

    console.error = function(...args) {
        originalError.apply(console, args);
        writeLog('ERROR', args.join(' '));
    };

    // 7. 页面加载状态追踪
    writeLog('SYSTEM', '黑匣子启动，页面开始加载...');
    document.addEventListener('DOMContentLoaded', () => writeLog('SYSTEM', 'DOM 加载完成 (DOMContentLoaded)'));
    window.addEventListener('load', () => {
        writeLog('SYSTEM', '所有资源加载完成 (Window Load)');
        localStorage.setItem(LAST_SESSION_KEY, 'clean_exit'); // 标记为正常加载
    });
    
    // 8. 崩溃检测与报告 UI
    // 如果上次没有标记 'clean_exit'，可能是崩了
    setTimeout(() => {
        const lastSession = localStorage.getItem(LAST_SESSION_KEY);
        
        // 创建一个永久悬浮球，防止白屏时无法调出
        const bugBtn = document.createElement('div');
        bugBtn.innerHTML = '🐞';
        bugBtn.style.cssText = 'position:fixed; bottom:100px; right:20px; width:40px; height:40px; background:red; border-radius:50%; z-index:999999; text-align:center; line-height:40px; box-shadow:0 5px 10px rgba(0,0,0,0.5); font-size:20px; cursor:pointer;';
        bugBtn.onclick = showCrashReport;
        document.documentElement.appendChild(bugBtn);

        // 如果检测到疑似崩溃，自动弹出
        if (lastSession !== 'clean_exit') {
            writeLog('SYSTEM', '检测到非正常退出 (疑似崩溃)');
            // 自动延时弹出，给页面一点反应时间
            // setTimeout(showCrashReport, 1000); 
        }
        
        // 每次启动重置状态
        localStorage.setItem(LAST_SESSION_KEY, 'running');
    }, 100);

    // 9. 显示报告的 UI 函数
    window.showCrashReport = function() {
        const reportDiv = document.createElement('div');
        reportDiv.style.cssText = 'position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.9); z-index:9999999; color:#0f0; font-family:monospace; padding:20px; box-sizing:border-box; overflow:auto; -webkit-overflow-scrolling:touch;';
        
        const logsText = logs.join('\n');
        
        reportDiv.innerHTML = `
            <h2 style="color:white; margin-top:0;">崩溃黑匣子日志</h2>
            <div style="margin-bottom:10px;">
                <button id="copy-log-btn" style="padding:10px 20px; background:#fff; color:#000; border:none; border-radius:5px; margin-right:10px; font-weight:bold;">复制日志</button>
                <button onclick="this.parentElement.parentElement.remove()" style="padding:10px 20px; background:#333; color:#fff; border:1px solid #666; border-radius:5px;">关闭</button>
                <button onclick="localStorage.removeItem('${LOG_KEY}'); location.reload()" style="padding:10px 20px; background:red; color:white; border:none; border-radius:5px; float:right;">清空并刷新</button>
            </div>
            <pre style="white-space:pre-wrap; word-break:break-all; font-size:12px;">${logsText}</pre>
        `;
        
        document.body.appendChild(reportDiv);
        
        document.getElementById('copy-log-btn').onclick = function() {
            navigator.clipboard.writeText(logsText).then(() => {
                this.innerText = '已复制！快去发给开发者';
                this.style.background = '#4cd964';
            }).catch(e => {
                this.innerText = '复制失败，请手动长按复制';
            });
        };
    };

})();
