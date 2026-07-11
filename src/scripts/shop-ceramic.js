/**
 * 7 SHOP - Ceramic Edition JavaScript
 * 陶瓷质感商城UI完整逻辑
 */

(function() {
    'use strict';

    // === 商品数据 ===
    const productData = {
        takeout: [
            { name: '豪华牛肉汉堡', description: '精选安格斯牛肉，搭配新鲜生菜和秘制酱料，多汁美味。', price: 28.50 },
            { name: '日式豚骨拉面', description: '浓郁猪骨汤底，配上溏心蛋和叉烧，温暖你的胃。', price: 35.00 },
            { name: '麻辣小龙虾', description: '夏日必备，鲜活小龙虾配以独家麻辣调料，香辣过瘾。', price: 88.00, img: 'https://images.unsplash.com/photo-1565557623262-b51c2513a641?auto=format&fit=crop&w=100&q=80' },
            { name: '水果缤纷沙拉', description: '多种新鲜时令水果，低卡健康，是轻食主义者的最爱。', price: 22.00, img: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=100&q=80' },
            { name: '意式番茄肉酱面', description: '经典意式风味，慢炖番茄肉酱搭配筋道意面，回味无穷。', price: 32.00 },
            { name: '奥尔良烤鸡翅', description: '秘制奥尔良酱料腌制，外焦里嫩，香气四溢。', price: 26.00 }
        ],
        milktea: [
            { name: '波霸奶茶', description: '经典台式风味，Q弹波霸搭配香浓奶茶，口感丰富。', price: 15.00, brand: 'CoCo都可' },
            { name: '多肉葡萄', description: '新鲜手剥葡萄果肉，搭配清爽绿妍茶底和Q弹脆波波，人气首选。', price: 29.00, brand: '喜茶' },
            { name: '幽兰拿铁', description: '精选红茶底与鲜奶融合，顶部撒上香脆碧根果，茶香与坚果香交织。', price: 20.00, brand: '茶颜悦色' },
            { name: '芋泥波波牛乳', description: '手工捣制的香甜芋泥，搭配Q弹波波和新鲜牛乳，口感绵密。', price: 22.00, brand: '奈雪的茶' },
            { name: '冰鲜柠檬水', description: '新鲜柠檬切片，搭配冰块和纯净水，清爽解渴，性价比之王。', price: 4.00, brand: '蜜雪冰城' },
            { name: '珍珠奶茶', description: '经典的蜜雪奶茶，搭配Q弹珍珠，是每个人的入门款。', price: 7.00, brand: '蜜雪冰城' }
        ],
        electronics: [
            { name: '超静音机械键盘', description: '采用茶轴设计，既有段落感又保持安静，办公游戏两相宜。', price: 399.00 },
            { name: '高清降噪耳机', description: '主动降噪技术，让你在嘈杂环境中也能享受纯净音乐。', price: 799.00 },
            { name: '便携式充电宝', description: '20000mAh大容量，支持快充，告别电量焦虑。', price: 129.00 },
            { name: '智能运动手环', description: '实时监测心率、步数和睡眠，你的腕上健康管家。', price: 199.00 },
            { name: '4K超高清显示器', description: '27英寸大屏，4K分辨率，色彩精准，适合设计和观影。', price: 1499.00 },
            { name: '无线蓝牙耳机', description: '半入耳式设计，佩戴舒适，续航长达24小时。', price: 299.00 }
        ],
        daily: [
            { name: '进口无芯卷纸', description: '原生木浆制造，四层加厚，亲肤柔软，一包12卷。', price: 19.90 },
            { name: '自动感应洗手液机', description: '红外感应，免接触出泡，有效避免交叉感染。', price: 69.00 },
            { name: '懒人桌面吸尘器', description: '强力吸除桌面灰尘、橡皮屑和零食碎屑，一键开启。', price: 45.00 },
            { name: '分类收纳盒套装', description: '一套三件，不同尺寸满足各种收纳需求。', price: 38.00 },
            { name: '天然竹纤维毛巾', description: '吸水性强，柔软亲肤，抗菌防霉，三条装。', price: 29.90 },
            { name: '超声波香薰机', description: '静音运行，加湿香薰二合一，营造舒适环境。', price: 79.00 }
        ],
        brands: [
            { name: '宝格丽 Serpenti 系列手镯', description: '以灵蛇为灵感，采用 18K 金材质，镶嵌璀璨宝石，灵动优雅。', price: 19800.00, brand: '宝格丽 BVLGARI' },
            { name: '梵克雅宝 四叶草项链', description: '经典四叶草造型，红玉髓搭配钻石，象征着幸运与美好。', price: 21000.00, brand: '梵克雅宝' },
            { name: '卡地亚 Love 系列手镯', description: '标志性的螺丝钉设计，18K 金材质，寓意着将爱牢牢锁住。', price: 23000.00, brand: '卡地亚 CARTIER' },
            { name: '劳力士日志型腕表', description: '劳力士经典款式，蚝式表壳坚固防水，展现卓越品质。', price: 18500.00, brand: '劳力士 ROLEX' },
            { name: '香奈儿 CF Mini 链条包', description: '香奈儿经典的 CF 系列，小羊皮材质手感柔软，时尚又百搭。', price: 20500.00, brand: '香奈儿 CHANEL' },
            { name: '爱马仕 Evelyne 斜挎包', description: '简约的设计风格，经典的 "H" 扣标识，实用性与时尚感兼具。', price: 22000.00, brand: '爱马仕 HERMÈS' }
        ],
        sports: [
            { name: '专业防滑瑜伽垫', description: '8mm加厚天然橡胶材质，防滑性能优异，环保无异味。', price: 129.00 },
            { name: '折叠露营帐篷', description: '3-4人全自动速开帐篷，防水防晒面料，适合家庭户外露营。', price: 459.00 },
            { name: '轻量徒步登山鞋', description: '防水透气鞋面，防滑大底，适合中低难度徒步。', price: 699.00 },
            { name: '智能运动手表', description: '支持100+运动模式，心率血氧监测，50米防水。', price: 899.00 },
            { name: '多功能户外背包', description: '45L大容量，防水面料，背负系统舒适。', price: 399.00 },
            { name: '专业羽毛球拍套装', description: '全碳素纤维材质，轻量化设计，含2支球拍。', price: 259.00 }
        ],
        beautyCare: [
            { name: '氨基酸洁面乳', description: '温和清洁配方，含氨基酸成分，洗完不紧绷。', price: 89.00 },
            { name: '玻尿酸补水面膜', description: '高浓度玻尿酸精华，深层补水锁水，一盒10片装。', price: 129.00 },
            { name: '烟酰胺亮肤精华液', description: '5%烟酰胺浓度，提亮肤色改善暗沉，淡化痘印。', price: 159.00 },
            { name: '神经酰胺修护面霜', description: '三重神经酰胺配方，修复肌肤屏障，敏感肌适用。', price: 219.00 },
            { name: '防晒霜SPF50+', description: '高倍防晒，防水防汗，清爽不油腻。', price: 99.00 },
            { name: '化妆刷套装12支', description: '柔软人造纤维毛，含散粉刷、眼影刷等，送收纳包。', price: 139.00 }
        ],
        foodSnacks: [
            { name: '混合坚果礼盒', description: '包含巴旦木、腰果、核桃等6种坚果，独立小包装。', price: 159.00 },
            { name: '无蔗糖全麦饼干', description: '高纤维低热量，无蔗糖添加，口感酥脆。', price: 39.90 },
            { name: '冻干水果脆片', description: '草莓、芒果、香蕉多种口味组合，非油炸保留营养。', price: 45.00 },
            { name: '纯黑巧克力', description: '85%可可含量，微苦醇厚，无添加蔗糖。', price: 59.00 },
            { name: '速溶黑咖啡', description: '哥伦比亚进口咖啡豆，冻干技术保留风味，40条装。', price: 65.00 },
            { name: '牛肉干礼盒', description: '内蒙古风干工艺，原味和香辣两种口味。', price: 89.00 }
        ],
        gifts: [
            { name: '简约情侣对戒', description: '采用优质金属打造，设计简约时尚，象征永恒爱意。', price: 520.00, brand: '周大福' },
            { name: '99朵红玫瑰花束', description: '精选99朵鲜艳红玫瑰，寓意长长久久，浪漫至极。', price: 399.00, brand: '野兽派BEAST' },
            { name: '永生花小熊礼盒', description: '可爱小熊搭配永不凋谢的永生花，精致又浪漫。', price: 258.00, brand: '诺誓ROSEONLY' },
            { name: '情侣手表', description: '简约表盘设计，精准走时，时刻相伴。', price: 799.00, brand: '卡西欧CASIO' },
            { name: '情侣香水礼盒', description: '男香女香搭配，独特香味，增添浪漫氛围。', price: 560.00, brand: '祖玛珑Jo Malone' },
            { name: '情侣玩偶', description: '可爱毛绒玩偶，一对搭配，萌趣十足。', price: 89.00, brand: '迪士尼Disney' }
        ]
    };

    // === 全局变量 ===
    let shoppingCart = [];
    let currentShopper = null;
    let currentRecipient = null;

    // === DOM 元素获取 ===
    const phoneFrame = document.querySelector('.phone-frame');
    const shopScreen = document.getElementById('shop-screen');
    const shopMainView = document.getElementById('shop-main-view');
    const shopMeView = document.getElementById('shop-me-view');
    const productGrid = document.getElementById('product-grid');
    
    // 导航元素
    const ceramicNavBtns = document.querySelectorAll('.ceramic-nav-btn');
    const ceramicCategoryTabs = document.querySelectorAll('.ceramic-category-tab');
    const shopBackButton = document.getElementById('shop-back-button');
    
    // 身份选择
    const shopperAvatarButton = document.getElementById('shopper-avatar-button');
    const shopperAvatarImg = document.getElementById('shopper-avatar-img');
    const shopperSelectModal = document.getElementById('shopper-select-modal');
    const shopperModalCloseBtn = document.getElementById('shopper-modal-close-btn');
    const shopperListContainer = document.getElementById('shopper-list-container');
    
    // 购物车和订单
    const myOrdersButton = document.getElementById('my-orders-button');
    const myCartButton = document.getElementById('my-cart-button');
    const cartScreen = document.getElementById('cart-screen');
    const cartBackButton = document.getElementById('cart-back-button');
    const cartItemsContainer = document.getElementById('cart-items-container');
    const ordersScreen = document.getElementById('orders-screen');
    const ordersBackButton = document.getElementById('orders-back-button');
    const ordersListContainer = document.getElementById('orders-list-container');
    const confirmPurchaseBtn = document.getElementById('confirm-purchase-btn');
    const recipientSelectModal = document.getElementById('recipient-select-modal');
    const recipientModalCloseBtn = document.getElementById('recipient-modal-close-btn');
    const recipientListContainer = document.getElementById('recipient-list-container');
    const checkoutRecipientTrigger = document.getElementById('checkout-recipient-trigger');

    // === 渲染商品函数 ===
    function renderProducts(category) {
        if (!productGrid) return;
        
        productGrid.innerHTML = '';
        const items = productData[category] || [];

        if (items.length === 0) {
            productGrid.innerHTML = '<p style="text-align: center; color: #888; grid-column: span 2;">该分类下暂无商品</p>';
            return;
        }

        items.forEach(item => {
            const card = document.createElement('div');
            card.className = 'ceramic-product-card';

            const brandTagHTML = item.brand ? `<div class="ceramic-product-brand">${item.brand}</div>` : '';

            const iconSVG = `
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                    <path d="M16.5 9.4l-9-5.19M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
                    <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
                    <line x1="12" y1="22.08" x2="12" y2="12"></line>
                </svg>
            `;

            card.innerHTML = `
                <div class="ceramic-product-img-box">
                    ${iconSVG}
                </div>
                <div class="ceramic-product-info">
                    ${brandTagHTML}
                    <div class="ceramic-product-name">${item.name}</div>
                    <div class="ceramic-product-price">¥${item.price.toFixed(2)}</div>
                </div>
                <button class="ceramic-add-btn add-to-cart-btn" data-name="${item.name}" data-price="${item.price}" data-brand="${item.brand || ''}">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="12" y1="5" x2="12" y2="19"></line>
                        <line x1="5" y1="12" x2="19" y2="12"></line>
                    </svg>
                </button>
            `;
            productGrid.appendChild(card);
        });
    }

    // === 购物车操作 ===
    async function saveCartToDB() {
        // 确保数据库已初始化
        if (typeof window.dbHelper !== 'undefined' && window.dbHelper.db) {
            try {
                await window.dbHelper.saveData('settingsStore', 'shoppingCart', shoppingCart);
            } catch (e) {
                console.warn('[7 SHOP] 保存购物车失败:', e);
            }
        }
    }

    async function loadCartFromDB() {
        // 确保数据库已初始化
        if (typeof window.dbHelper !== 'undefined' && window.dbHelper.db) {
            try {
                const cartData = await window.dbHelper.loadData('settingsStore', 'shoppingCart');
                if (cartData && Array.isArray(cartData.value)) {
                    shoppingCart = cartData.value;
                }
            } catch (e) {
                console.warn('[7 SHOP] 加载购物车失败:', e);
            }
        }
    }

    function renderCart() {
        if (!cartItemsContainer) return;
        cartItemsContainer.innerHTML = '';
        
        const checkoutBar = document.getElementById('cart-checkout-bar');
        const totalDisplay = document.getElementById('cart-total-display');

        if (shoppingCart.length === 0) {
            cartItemsContainer.innerHTML = '<p style="text-align: center; color: #888; padding: 50px 0;">购物车是空的</p>';
            if (checkoutBar) checkoutBar.style.display = 'none';
            return;
        }

        let totalPrice = 0;

        shoppingCart.forEach((item, index) => {
            const itemTotal = item.price * (item.quantity || 1);
            totalPrice += itemTotal;

            const cartItem = document.createElement('div');
            cartItem.className = 'ceramic-cart-item'; // 使用新样式类
            cartItem.innerHTML = `
                <div class="ceramic-cart-thumb">
                    <!-- 占位图或实际图片 -->
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"></path>
                        <line x1="3" y1="6" x2="21" y2="6"></line>
                        <path d="M16 10a4 4 0 0 1-8 0"></path>
                    </svg>
                </div>
                <div style="flex: 1;">
                    <div style="font-weight: 600; font-size: 15px; margin-bottom: 2px;">${item.name}</div>
                    <div style="font-size: 14px; color: var(--ceramic-text-secondary);">¥${item.price.toFixed(2)}</div>
                </div>
                <div class="ceramic-qty-control">
                    <button class="ceramic-qty-btn decrease-qty" data-index="${index}">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                            <line x1="5" y1="12" x2="19" y2="12"></line>
                        </svg>
                    </button>
                    <span class="ceramic-qty-val">${item.quantity || 1}</span>
                    <button class="ceramic-qty-btn increase-qty" data-index="${index}">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                            <line x1="12" y1="5" x2="12" y2="19"></line>
                            <line x1="5" y1="12" x2="19" y2="12"></line>
                        </svg>
                    </button>
                </div>
            `;
            cartItemsContainer.appendChild(cartItem);
        });

        // 更新 Checkout Bar
        if (checkoutBar) {
            checkoutBar.style.display = 'flex';
            if (totalDisplay) totalDisplay.textContent = `¥${totalPrice.toFixed(2)}`;
        }
    }

    async function loadOrdersFromDB() {
        if (!ordersListContainer) return;
        if (typeof window.dbHelper !== 'undefined' && window.dbHelper.db) {
            try {
                const ordersData = await window.dbHelper.loadData('settingsStore', 'myOrders');
                if (ordersData && Array.isArray(ordersData.value)) {
                    renderOrders(ordersData.value);
                }
            } catch (e) {
                console.warn('[7 SHOP] 加载订单失败:', e);
            }
        }
    }

    function renderOrders(orders) {
        if (!ordersListContainer) return;
        ordersListContainer.innerHTML = '';
        
        if (orders.length === 0) {
            ordersListContainer.innerHTML = '<p style="text-align: center; color: #888; padding: 50px 0;">暂无订单</p>';
            return;
        }

        orders.forEach(order => {
            const orderCard = document.createElement('div');
            orderCard.className = 'ceramic-order-item'; // 使用新样式
            
            // 简单的状态模拟
            const isDelivered = Math.random() > 0.5;
            const statusColor = isDelivered ? '#E8F5E9' : '#E3F2FD';
            const statusIconColor = isDelivered ? '#2E7D32' : '#1565C0';
            const statusIcon = isDelivered 
                ? '<path d="M20 6L9 17l-5-5"></path>' // Check
                : '<rect x="1" y="3" width="15" height="13"></rect><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"></polygon><circle cx="5.5" cy="18.5" r="2.5"></circle><circle cx="18.5" cy="18.5" r="2.5"></circle>'; // Truck

            orderCard.innerHTML = `
                <div class="ceramic-order-icon" style="background: ${statusColor}; color: ${statusIconColor};">
                     <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        ${statusIcon}
                     </svg>
                </div>
                <div style="flex: 1;">
                    <div style="font-weight: 600;">订单 #${order.id || Math.floor(Math.random()*10000)}</div>
                    <div style="font-size: 13px; color: var(--ceramic-text-secondary);">${isDelivered ? '已送达 • 昨天' : '运输中 • 下午2:00'}</div>
                    <div style="font-size: 12px; color: #999; margin-top: 2px;">${order.items.map(i=>i.name).join(', ')}</div>
                </div>
                <div style="display:flex; flex-direction:column; align-items:flex-end; gap:4px;">
                    <div style="font-weight: 700; font-family: 'SF Mono', monospace;">¥${order.total.toFixed(2)}</div>
                    <button class="ceramic-qty-btn share-order-btn" data-order-id="${order.id}" style="width:auto; padding:4px 8px; border-radius:8px; background:#f0f0f0; font-size:12px; height:auto; gap:4px;">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"></path><polyline points="16 6 12 2 8 6"></polyline><line x1="12" y1="2" x2="12" y2="15"></line></svg>
                        分享
                    </button>
                </div>
            `;
            ordersListContainer.appendChild(orderCard);
        });
        
        // 分享按钮事件
        const shareBtns = ordersListContainer.querySelectorAll('.share-order-btn');
        shareBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const orderId = btn.dataset.orderId;
                const order = orders.find(o => String(o.id) === String(orderId));
                if (order) {
                    shareOrderToChat(order);
                }
            });
        });
    }

    async function shareOrderToChat(order) {
        // 尝试找到接收者
        // 注意：order.recipient 现在应该是 AI 对象 {id, name, avatar...} 或者包含 name 的对象
        // 如果是 V1 版本的数据，可能只是个字符串 name
        
        let recipientName = '';
        if (typeof order.recipient === 'string') {
            recipientName = order.recipient;
        } else if (order.recipient && order.recipient.name) {
            recipientName = order.recipient.name;
        }

        if (!recipientName) {
            alert('无法识别收货人，无法分享');
            return;
        }
        
        // 如果收货人是"Me"或者"我自己"，可能需要特殊处理，或者不让分享给 AI？
        // 假设这里我们只想分享给 AI 角色
        
        try {
             // 依赖 window.dbHelper 和全局 openChatView, callAI
             if (typeof window.dbHelper === 'undefined' || typeof window.openChatView === 'undefined') {
                 console.warn('全局环境缺失，无法自动分享');
                 // Fallback
                 const itemsName = order.items.map(i => i.name).join('、');
                 const fallbackText = `我刚给你买了 ${itemsName}，花了 ¥${order.total.toFixed(2)}！`;
                 const messageInput = document.getElementById('message-input');
                 if (messageInput) {
                     messageInput.value = fallbackText;
                     document.querySelector('.phone-frame').classList.remove('show-shop', 'show-orders');
                 }
                 return;
             }

             const contactsData = await window.dbHelper.loadData('messageContacts', 'allContacts');
             // 查找对应的 AI 联系人
             // 这里的匹配逻辑可能较弱，必须确保 order.recipient.name 和 contact.ai.name 一致
             const recipientContact = contactsData.value.find(c => c.ai.name === recipientName);
             
             if (!recipientContact) {
                 alert(`找不到与 ${recipientName} 的聊天对话，无法分享。`);
                 return;
             }

            // --- 构造分享逻辑 (复用 main.js 中的高级逻辑) ---
            const itemsText = order.items.map(item => {
                if (item.brand) {
                    return `${item.brand}的“${item.name}”`;
                }
                return `“${item.name}”`;
            }).join('，'); 

            // AI 触发词 (System Prompt Trigger)
            const aiTriggerMessage = `(我给你分享了一个订单，商品是${itemsText}，请根据你的人设和我们的关系对此作出回应。)`;
            
            // 用户消息 (显示为卡片)
            const messageText = `[ORDER_SHARE_CARD]${JSON.stringify(order)}`;

            const userMessage = {
                sender: 'user', 
                text: messageText, 
                timestamp: new Date(),
                uuid: Date.now() + '-' + Math.random().toString(36).substr(2, 9)
            };

            // 保存消息到历史
            if (!Array.isArray(recipientContact.history)) recipientContact.history = [];
            recipientContact.history.push(userMessage);
            recipientContact.lastMessage = "[订单分享]"; // 更新列表预览
            recipientContact.lastTime = new Date(); // 更新时间
            
            const allContacts = contactsData.value;
            const contactIndex = allContacts.findIndex(c => c.id === recipientContact.id);
            if (contactIndex > -1) {
                allContacts[contactIndex] = recipientContact;
                await window.dbHelper.saveData('messageContacts', 'allContacts', allContacts);
            }

            // 界面跳转
            const phoneFrame = document.querySelector('.phone-frame');
            if (phoneFrame) {
                 phoneFrame.classList.remove('show-shop');
                 phoneFrame.classList.remove('show-orders');
                 phoneFrame.classList.add('show-messages'); // 如果需要先回列表
            }
            
            // 打开聊天窗口
            await window.openChatView(recipientContact.id);

            // 触发 AI 回复
            if (typeof window.callAI !== 'undefined') {
                await window.callAI(aiTriggerMessage, recipientContact);
            } else {
                console.warn('callAI function not found');
            }

        } catch (error) {
            console.error("分享订单失败:", error);
            alert(`分享失败: ${error.message}`);
        }
    }

    // === 更新个人中心视图 ===
    function updateShopMeView() {
        const meAvatar = document.getElementById('shop-me-avatar');
        const meName = document.getElementById('shop-me-name');
        const ordersCount = document.getElementById('shop-orders-count');
        const cartCount = document.getElementById('shop-cart-count');
        
        if (currentShopper) {
            if (meAvatar) meAvatar.src = currentShopper.avatar || '';
            if (meName) meName.textContent = currentShopper.name || '用户';
        }
        
        if (ordersCount && typeof window.dbHelper !== 'undefined' && window.dbHelper.db) {
            window.dbHelper.loadData('settingsStore', 'myOrders').then(data => {
                if (data && Array.isArray(data.value)) {
                    ordersCount.textContent = data.value.length;
                }
            }).catch(() => {});
        }
        
        if (cartCount) {
            cartCount.textContent = shoppingCart.length;
        }
    }

    // === 更新购物者身份 ===
    function updateShopper(contact) {
        if (contact && contact.user) {
            currentShopper = contact.user;
            // 默认收货人也是自己
            currentRecipient = currentShopper; 
            
            if (shopperAvatarImg) {
                shopperAvatarImg.src = currentShopper.avatar;
            }
            // 更新Checkout Bar上的收货人文字
            updateRecipientDisplay();
            
            console.log(`当前购物身份已切换为: ${currentShopper.name}`);
        }
    }

    // === 更新收货人显示 ===
    function updateRecipientDisplay() {
        if (!checkoutRecipientTrigger) return;
        const nameSpan = checkoutRecipientTrigger.querySelector('span');
        if (nameSpan) {
            if (currentRecipient && currentShopper && currentRecipient.id === currentShopper.id) {
                nameSpan.textContent = 'Me';
            } else if (currentRecipient) {
                nameSpan.textContent = currentRecipient.name;
            } else {
                nameSpan.textContent = 'Me';
            }
        }
    }

    // === 事件监听初始化 ===
    function initEventListeners() {
        // 返回按钮
        if (shopBackButton) {
            shopBackButton.addEventListener('click', () => {
                if (phoneFrame) {
                    phoneFrame.classList.remove('show-shop');
                }
            });
        }

        // 底部导航栏切换
        ceramicNavBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const target = btn.dataset.target;
                
                ceramicNavBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                
                if (target === 'shop') {
                    if (shopMainView) shopMainView.classList.add('active');
                    if (shopMeView) shopMeView.classList.remove('active');
                } else if (target === 'me') {
                    if (shopMainView) shopMainView.classList.remove('active');
                    if (shopMeView) shopMeView.classList.add('active');
                    updateShopMeView();
                }
            });
        });

        // 分类标签切换
        ceramicCategoryTabs.forEach(tab => {
            tab.addEventListener('click', () => {
                ceramicCategoryTabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                
                const category = tab.dataset.category;
                renderProducts(category);
            });
        });

        // 加入购物车
        if (productGrid) {
            productGrid.addEventListener('click', async (event) => {
                const addBtn = event.target.closest('.add-to-cart-btn');
                if (addBtn) {
                    const name = addBtn.dataset.name;
                    const price = parseFloat(addBtn.dataset.price);
                    const brand = addBtn.dataset.brand || null;
                    
                    // 检查是否已存在
                    const existingItem = shoppingCart.find(i => i.name === name);
                    if (existingItem) {
                        existingItem.quantity = (existingItem.quantity || 1) + 1;
                    } else {
                        shoppingCart.push({ name, price, brand, quantity: 1 });
                    }
                    
                    await saveCartToDB();
                    updateShopMeView(); // 更新购物车角标
                    
                    // 视觉反馈
                    addBtn.style.transform = 'scale(0.8)';
                    setTimeout(() => {
                        addBtn.style.transform = '';
                    }, 150);
                    
                    console.log(`已将 ${name} 加入购物车`);
                }
            });
        }

        // 购物车页面
        if (myCartButton) {
            myCartButton.addEventListener('click', () => {
                renderCart();
                if (phoneFrame) phoneFrame.classList.add('show-cart');
            });
        }

        if (cartBackButton) {
            cartBackButton.addEventListener('click', () => {
                if (phoneFrame) phoneFrame.classList.remove('show-cart');
            });
        }

        // 订单页面
        if (myOrdersButton) {
            myOrdersButton.addEventListener('click', () => {
                loadOrdersFromDB();
                if (phoneFrame) phoneFrame.classList.add('show-orders');
            });
        }

        if (ordersBackButton) {
            ordersBackButton.addEventListener('click', () => {
                if (phoneFrame) phoneFrame.classList.remove('show-orders');
            });
        }

        // 购物车交互 (数量加减)
        if (cartItemsContainer) {
            cartItemsContainer.addEventListener('click', async (event) => {
                const increaseBtn = event.target.closest('.increase-qty');
                const decreaseBtn = event.target.closest('.decrease-qty');
                
                if (increaseBtn) {
                    const index = parseInt(increaseBtn.dataset.index, 10);
                    if (shoppingCart[index]) {
                        shoppingCart[index].quantity = (shoppingCart[index].quantity || 1) + 1;
                        await saveCartToDB();
                        renderCart();
                        updateShopMeView();
                    }
                } else if (decreaseBtn) {
                    const index = parseInt(decreaseBtn.dataset.index, 10);
                    if (shoppingCart[index]) {
                        if (shoppingCart[index].quantity > 1) {
                            shoppingCart[index].quantity--;
                        } else {
                            shoppingCart.splice(index, 1); // 数量为1时删除
                        }
                        await saveCartToDB();
                        renderCart();
                        updateShopMeView();
                    }
                }
            });
        }
        
        // 触发收货人选择
        if (checkoutRecipientTrigger) {
            checkoutRecipientTrigger.addEventListener('click', async () => {
                if (!recipientListContainer || !recipientSelectModal) return;
                
                recipientListContainer.innerHTML = '<p style="text-align:center; color:#888;">正在加载...</p>';
                
                try {
                    if (typeof window.dbHelper !== 'undefined' && window.dbHelper.db) {
                        const contactsData = await window.dbHelper.loadData('messageContacts', 'allContacts');
                        if (contactsData && Array.isArray(contactsData.value) && contactsData.value.length > 0) {
                            recipientListContainer.innerHTML = '';
                            
                            // 增加 "自己 (Me)" 选项
                            if (currentShopper) {
                                const meItem = document.createElement('div');
                                meItem.className = 'invite-contact-item';
                                meItem.style.cursor = 'pointer';
                                meItem.style.borderBottom = '1px solid #eee'; 
                                meItem.dataset.isMe = 'true';
                                meItem.innerHTML = `
                                    <img src="${currentShopper.avatar}" alt="avatar" class="invite-contact-avatar">
                                    <span class="invite-contact-name">我自己 (Me)</span>
                                    ${(currentRecipient && currentRecipient.id === currentShopper.id) ? '<span style="margin-left:auto; color:green;">✓</span>' : ''}
                                `;
                                recipientListContainer.appendChild(meItem);
                            }

                            contactsData.value.forEach(contact => {
                                // 修改：展示 AI 而不是 User
                                const ai = contact.ai; 
                                if (!ai) return;

                                const contactItem = document.createElement('div');
                                contactItem.className = 'invite-contact-item';
                                contactItem.style.cursor = 'pointer';
                                // 使用 dataset 存储必要信息，注意这里现在存的是 AI 的 ID
                                contactItem.dataset.contactId = contact.id; 
                                contactItem.dataset.aiId = ai.id;
                                
                                const isSelected = currentRecipient && currentRecipient.id === ai.id;

                                contactItem.innerHTML = `
                                    <img src="${ai.avatar}" alt="avatar" class="invite-contact-avatar">
                                    <span class="invite-contact-name">${ai.name}</span>
                                    ${isSelected ? '<span style="margin-left:auto; color:#007AFF;">✓</span>' : ''}
                                `;
                                recipientListContainer.appendChild(contactItem);
                            });
                        } else {
                            recipientListContainer.innerHTML = '<p style="text-align:center; color:#888;">没有联系人可选</p>';
                        }
                    }
                } catch (error) {
                    console.error("加载联系人失败:", error);
                    recipientListContainer.innerHTML = '<p style="text-align:center; color:red;">加载失败</p>';
                }

                recipientSelectModal.style.display = 'flex';
                setTimeout(() => {
                    recipientSelectModal.style.opacity = '1';
                    const modalContent = recipientSelectModal.querySelector('.modal-content');
                    if (modalContent) modalContent.style.transform = 'scale(1)';
                }, 10);
            });
        }

        // 关闭收货人选择弹窗
        if (recipientModalCloseBtn) {
            recipientModalCloseBtn.addEventListener('click', () => {
                if (recipientSelectModal) {
                    recipientSelectModal.style.opacity = '0';
                    const modalContent = recipientSelectModal.querySelector('.modal-content');
                    if (modalContent) modalContent.style.transform = 'scale(0.95)';
                    setTimeout(() => {
                        recipientSelectModal.style.display = 'none';
                    }, 300);
                }
            });
        }

        // 选中收货人
        if (recipientListContainer) {
            recipientListContainer.addEventListener('click', async (event) => {
                const item = event.target.closest('.invite-contact-item');
                if (item) {
                    // 如果选的是自己
                    if (item.dataset.isMe === 'true') {
                         currentRecipient = currentShopper;
                    } else {
                        const contactId = parseInt(item.dataset.contactId, 10);
                        if (typeof window.dbHelper !== 'undefined' && window.dbHelper.db) {
                             const contactsData = await window.dbHelper.loadData('messageContacts', 'allContacts');
                             const selectedContact = contactsData.value.find(c => c.id === contactId);
                             if (selectedContact && selectedContact.ai) {
                                 // 修改：设置为选中的 AI
                                 currentRecipient = selectedContact.ai;
                             }
                        }
                    }
                    
                    updateRecipientDisplay();

                    // Close Modal
                    if (recipientSelectModal) {
                        recipientSelectModal.style.opacity = '0';
                        setTimeout(() => {
                            recipientSelectModal.style.display = 'none';
                        }, 300);
                    }
                }
            });
        }
        
        // 确认支付逻辑
        if (confirmPurchaseBtn) {
            confirmPurchaseBtn.addEventListener('click', async () => {
                if (shoppingCart.length === 0) return;
                
                const recipientName = currentRecipient ? currentRecipient.name : (currentShopper ? currentShopper.name : 'Me');
                const confirmMsg = `Total: ¥${shoppingCart.reduce((sum, item) => sum + item.price * (item.quantity||1), 0).toFixed(2)}\nRecipient: ${recipientName}\n\nConfirm purchase?`;

                if (confirm(confirmMsg)) {
                    const total = shoppingCart.reduce((sum, item) => sum + (item.price * (item.quantity || 1)), 0);
                    const newOrder = {
                        id: Date.now(),
                        items: [...shoppingCart],
                        total: total,
                        date: new Date().toISOString(),
                        recipient: recipientName // 使用当前选择的收货人
                    };
                    
                    try {
                        if (typeof window.dbHelper !== 'undefined' && window.dbHelper.db) {
                            const ordersData = await window.dbHelper.loadData('settingsStore', 'myOrders') || { value: [] };
                            const orders = Array.isArray(ordersData.value) ? ordersData.value : [];
                            orders.unshift(newOrder); // 最新订单在最前
                            
                            await window.dbHelper.saveData('settingsStore', 'myOrders', orders);
                            
                            // 清空购物车
                            shoppingCart = [];
                            await saveCartToDB();
                            
                            renderCart();
                            updateShopMeView();
                            alert('支付成功！');
                            if (phoneFrame) phoneFrame.classList.remove('show-cart');
                        }
                    } catch (e) {
                        console.error('支付失败:', e);
                        alert('支付处理失败');
                    }
                }
            });
        }

        // 选择购物者身份
        if (shopperAvatarButton) {
            shopperAvatarButton.addEventListener('click', async () => {
                if (!shopperListContainer || !shopperSelectModal) return;
                
                shopperListContainer.innerHTML = '<p style="text-align:center; color:#888;">正在加载...</p>';
                
                try {
                    if (typeof window.dbHelper !== 'undefined' && window.dbHelper.db) {
                        const contactsData = await window.dbHelper.loadData('messageContacts', 'allContacts');
                        if (contactsData && Array.isArray(contactsData.value) && contactsData.value.length > 0) {
                            shopperListContainer.innerHTML = '';
                            contactsData.value.forEach(contact => {
                                const user = contact.user;
                                const contactItem = document.createElement('div');
                                contactItem.className = 'invite-contact-item';
                                contactItem.style.cursor = 'pointer';
                                contactItem.dataset.contactId = contact.id;
                                contactItem.innerHTML = `
                                    <img src="${user.avatar}" alt="avatar" class="invite-contact-avatar">
                                    <span class="invite-contact-name">${user.name}</span>
                                `;
                                shopperListContainer.appendChild(contactItem);
                            });
                        } else {
                            shopperListContainer.innerHTML = '<p style="text-align:center; color:#888;">没有可用的用户身份</p>';
                        }
                    } else {
                        shopperListContainer.innerHTML = '<p style="text-align:center; color:#888;">数据库未就绪</p>';
                    }
                } catch (error) {
                    console.error("加载用户列表失败:", error);
                    shopperListContainer.innerHTML = '<p style="text-align:center; color:red;">加载失败</p>';
                }
                
                shopperSelectModal.style.display = 'flex';
                setTimeout(() => {
                    shopperSelectModal.style.opacity = '1';
                    const modalContent = shopperSelectModal.querySelector('.modal-content');
                    if (modalContent) modalContent.style.transform = 'scale(1)';
                }, 10);
            });
        }

        // 关闭购物者选择弹窗
        if (shopperModalCloseBtn) {
            shopperModalCloseBtn.addEventListener('click', () => {
                if (shopperSelectModal) {
                    shopperSelectModal.style.opacity = '0';
                    const modalContent = shopperSelectModal.querySelector('.modal-content');
                    if (modalContent) modalContent.style.transform = 'scale(0.95)';
                    setTimeout(() => {
                        shopperSelectModal.style.display = 'none';
                    }, 300);
                }
            });
        }

        // 选择购物者
        if (shopperListContainer) {
            shopperListContainer.addEventListener('click', async (event) => {
                const item = event.target.closest('.invite-contact-item');
                if (item) {
                    const contactId = parseInt(item.dataset.contactId, 10);
                    
                    if (typeof window.dbHelper !== 'undefined' && window.dbHelper.db) {
                        try {
                            const contactsData = await window.dbHelper.loadData('messageContacts', 'allContacts');
                            const selectedContact = contactsData.value.find(c => c.id === contactId);
                            
                            if (selectedContact) {
                                updateShopper(selectedContact);
                                // 关闭弹窗
                                if (shopperSelectModal) {
                                    shopperSelectModal.style.opacity = '0';
                                    setTimeout(() => {
                                        shopperSelectModal.style.display = 'none';
                                    }, 300);
                                }
                            }
                        } catch (e) {
                            console.warn('[7 SHOP] 选择购物者失败:', e);
                        }
                    }
                }
            });
        }
    }

    // === 初始化 ===
    function init() {
        loadCartFromDB();
        renderProducts('takeout'); // 默认显示外卖分类
        initEventListeners();
        console.log('[7 SHOP] 陶瓷质感商城已初始化');
    }

    // 页面加载完成后初始化
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // 暴露必要的函数和变量
    window.shopCeramic = {
        renderProducts,
        updateShopMeView,
        shoppingCart,
        productData,
        loadCartFromDB,
        loadOrdersFromDB
    };
})();
