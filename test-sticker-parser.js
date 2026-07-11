// 群聊表情包解析测试用例
// 测试 parseGroupSticker 函数的各种格式支持

// 模拟 parseGroupSticker 函数
function parseGroupSticker(text) {
    if (!text || typeof text !== 'string') return null;
    
    // 定义多种正则模式,按优先级排序
    const patterns = [
        // 格式1: 表情包：[关键词:http://xxx]  (带完整URL)
        /(?:表情包|贴图|sticker)[：:]\s*[\[【]([^:\]】]+):(\s*https?:\/\/[^\]】\s]+)\s*[\]】]/i,
        
        // 格式2: 表情包：[关键词]  (标准格式)
        /(?:表情包|贴图|sticker)[：:]\s*[\[【]([^\]】]+)[\]】]/i,
        
        // 格式3: 表情包：关键词  (无括号)
        /(?:表情包|贴图|sticker)[：:]\s*([^\s\[\]【】()（）]+)/i,
        
        // 格式4: (表情包：xx) 或 （表情包：xx）  (带圆括号)
        /[（(](?:表情包|贴图|sticker)[：:]\s*([^)）]+)[)）]/i,
    ];
    
    // 依次尝试每个模式
    for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match) {
            const keyword = match[1].trim();
            const url = match[2] ? match[2].trim() : null;
            
            // 验证关键词不为空
            if (keyword) {
                return { keyword, url };
            }
        }
    }
    
    return null;
}

// 测试用例
const testCases = [
    // 标准格式
    { input: '表情包：[哈哈]', expected: { keyword: '哈哈', url: null } },
    { input: '表情包：【笑哭】', expected: { keyword: '笑哭', url: null } },
    
    // 无括号格式
    { input: '表情包：开心', expected: { keyword: '开心', url: null } },
    { input: '表情包:难过', expected: { keyword: '难过', url: null } },
    
    // 带URL格式
    { input: '表情包：[哈哈:https://example.com/emoji.png]', expected: { keyword: '哈哈', url: 'https://example.com/emoji.png' } },
    { input: '表情包：【笑哭:http://test.com/img.jpg】', expected: { keyword: '笑哭', url: 'http://test.com/img.jpg' } },
    
    // 圆括号格式
    { input: '(表情包：开心)', expected: { keyword: '开心', url: null } },
    { input: '（表情包：哈哈）', expected: { keyword: '哈哈', url: null } },
    
    // 英文关键词
    { input: 'sticker:[happy]', expected: { keyword: 'happy', url: null } },
    { input: '贴图：[微笑]', expected: { keyword: '微笑', url: null } },
    
    // 带空格
    { input: '表情包： [哈哈]', expected: { keyword: '哈哈', url: null } },
    { input: '表情包：[ 笑哭 ]', expected: { keyword: '笑哭', url: null } },
    
    // 不匹配的情况
    { input: '这是普通文本', expected: null },
    { input: '表情包', expected: null },
    { input: '', expected: null },
];

// 运行测试
console.log('=== 群聊表情包解析测试 ===\n');
let passCount = 0;
let failCount = 0;

testCases.forEach((test, index) => {
    const result = parseGroupSticker(test.input);
    const passed = JSON.stringify(result) === JSON.stringify(test.expected);
    
    if (passed) {
        passCount++;
        console.log(`✅ 测试 ${index + 1} 通过`);
    } else {
        failCount++;
        console.log(`❌ 测试 ${index + 1} 失败`);
        console.log(`   输入: "${test.input}"`);
        console.log(`   期望:`, test.expected);
        console.log(`   实际:`, result);
    }
});

console.log(`\n=== 测试结果 ===`);
console.log(`通过: ${passCount}/${testCases.length}`);
console.log(`失败: ${failCount}/${testCases.length}`);
console.log(`成功率: ${(passCount / testCases.length * 100).toFixed(1)}%`);
