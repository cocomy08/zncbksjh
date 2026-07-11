// 缓存的名称和版本 - 修改此处版本号即可自动更新所有用户
const CACHE_NAME = 'qiqi-phone-cache-v3.00410';

// 需要缓存的核心文件列表
const urlsToCache = [
  './',
  './index.html',
  './manifest.json',
  './main.min.js',
  './style.css',
  './voice-bubble-fix.css',
  './chat-settings-page.css',
  './GLOBAL_MENU_FIX.js',
  './settings-ios-style.css',
  './src/styles/littleworld.css',
  './src/scripts/littleworld.js',
  './src/styles/user-profiles.css',
  './src/scripts/user-profiles.js',
  './src/styles/changelog.css',
  './src/scripts/changelog.js'
];

// 1. 安装 Service Worker
self.addEventListener('install', event => {
  // 强制立即进入 waiting 状态，触发 activate
  self.skipWaiting();

  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache:', CACHE_NAME);
        return cache.addAll(urlsToCache);
      })
  );
});

// 2. 激活 Service Worker - 清理旧缓存
self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME];

  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          // 如果当前缓存名称不在白名单中，或者是旧版本的缓存
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      // 立即接管所有客户端，确保新版本立即生效（无需重新加载页面）
      return self.clients.claim();
    })
  );
});

// 3. 拦截网络请求 - 混合策略 (Smart Hybrid Strategy)
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // 0. 忽略非 GET 请求 (如 POST API 调用)
  // Service Worker 默认不支持缓存 POST 请求，且 API 调用通常不需要 SW 介入
  if (event.request.method !== 'GET') {
    return;
  }

  // 策略 A: Network First (网络优先)
  // 适用于: HTML, JS, CSS, 根路径, 以及明确需要绕过缓存的请求
  // 目的: 确保用户总是第一时间获取到最新的代码和样式更新，无需手动清理缓存，只需刷新一次
  if (event.request.headers.get('Cache-Control') === 'no-cache' ||
    url.pathname.endsWith('.html') ||
    url.pathname.endsWith('/') ||
    url.pathname.endsWith('manifest.json') ||
    url.pathname.endsWith('.js') ||
    url.pathname.endsWith('.css')) {

    event.respondWith(
      fetch(event.request)
        .then(response => {
          // 网络成功：更新缓存并返回
          if (response && response.status === 200) {
            const responseToCache = response.clone();
            caches.open(CACHE_NAME).then(cache => {
              cache.put(event.request, responseToCache);
            });
          }
          return response;
        })
        .catch(() => {
          // 网络失败：回退到缓存
          console.log('Network failed, falling back to cache for:', event.request.url);
          return caches.match(event.request).then(cachedResponse => {
            // 如果缓存也没有，只能返回通过 Promise.reject 或构建一个新的 Response
            // 为了防止 "Load failed"，这里可以返回一个简单的离线提示或者 null
            if (cachedResponse) return cachedResponse;
            // 最后的兜底：如果是 HTML 请求且没网没缓存，可以返回一个简单的离线 HTML (可选)
            return new Response('Offline: Network request failed and no cache available.', { status: 503, statusText: 'Service Unavailable' });
          });
        })
    );
    return;
  }

  // 策略 B: Cache First (缓存优先)
  // 适用于: 图片, 字体等静态大资源
  // 目的: 最大化加载速度，节省流量
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        if (response) {
          return response;
        }

        // 缓存未命中，发起网络请求
        return fetch(event.request).then(response => {
          // 检查响应是否有效
          if (!response || response.status !== 200 || response.type !== 'basic') {
            return response;
          }

          // 克隆响应放入缓存
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, responseToCache);
          });

          return response;
        }).catch(err => {
          // 网络请求失败 (例如处于后台断网)
          console.warn('SW Fetch failed (Strategy B):', err);
          // 对于图片，可以返回一个透明占位图或什么都不做(让浏览器显示破图)
          // 但决不能抛出异常导致 "Load failed" 这里的错误
          // 返回一个 404 响应是比较安全的做法
          return new Response('', { status: 404, statusText: 'Not Found' });
        });
      })
  );
});

// ================= Push Notification Support =================

// 4. 接收推送消息
self.addEventListener('push', event => {
  console.log('[SW] Push received:', event);

  let data = {
    title: 'New Message',
    body: 'You have a new notification',
    icon: 'https://i.postimg.cc/s2n0gxBB/appicon.png',
    badge: 'https://i.postimg.cc/s2n0gxBB/appicon.png'
  };

  // 尝试解析推送数据
  if (event.data) {
    try {
      const pushData = event.data.json();
      data = { ...data, ...pushData };
    } catch (e) {
      // 如果不是 JSON，尝试作为文本
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body,
    icon: data.icon || 'https://i.postimg.cc/s2n0gxBB/appicon.png',
    badge: data.badge || 'https://i.postimg.cc/s2n0gxBB/appicon.png',
    vibrate: [100, 50, 100],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1,
      url: data.url || '/'
    },
    actions: [
      { action: 'open', title: '查看', icon: '' },
      { action: 'close', title: '关闭', icon: '' }
    ],
    requireInteraction: false, // 自动消失
    tag: data.tag || 'offline-life-notification' // 相同 tag 会替换旧通知
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// 5. 通知点击处理
self.addEventListener('notificationclick', event => {
  console.log('[SW] Notification clicked:', event);

  event.notification.close();

  if (event.action === 'close') {
    return;
  }

  // 打开应用
  const urlToOpen = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(windowClients => {
        // 如果已有窗口打开，聚焦它
        for (let client of windowClients) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            return client.focus();
          }
        }
        // 否则打开新窗口
        if (clients.openWindow) {
          return clients.openWindow(urlToOpen);
        }
      })
  );
});

// 6. 监听来自主页面的消息 (用于 SKIP_WAITING 等控制)
self.addEventListener('message', event => {
  console.log('[SW] Message received:', event.data);

  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
