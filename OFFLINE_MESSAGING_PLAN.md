# 离线消息与 AI 独立生活系统 (Offline Messaging & Independent Life System) - 实现方案

## 1. 核心理念 (Core Concept)

本方案旨在赋予 AI **“独立的时间线”**和**“生活感”**。
不仅仅是简单的消息回复，而是构建一个运行在云端的 **Shadow Brain（影子大脑）**。它拥有自己的日程表、状态机，并能在用户缺席的情况下，依照自己的生活逻辑主动发起交互。

---

## 2. 架构概览 (Architecture)

系统分为两部分：**前端 (浏览器/App)** 和 **后端 (腾讯云服务器)**。

### 客户端 (Frontend) - 状态感知与指令捕获

- **主要职责**: 聊天界面展示、解析 AI 的隐式指令、检测用户在线状态。
- **关键逻辑**:
  - **Regex Filter**: 过滤 AI 回复中的隐藏指令（如 `<action:meeting>`），不展示给用户。
  - **State Syncer**: 将 AI 的状态变更（"我去开会了"）同步给服务器。

### 服务端 (Backend) - 状态维持与主动唤醒

- **运行环境**: Node.js + SQLite/Redis (部署于腾讯云 2 核/2G 服务器)。
- **主要职责**:
  - **State Store (状态存储)**: 记录 AI 当前是否忙碌、何时结束。
  - **Scheduler (调度器)**: 每分钟检查 AI 的日程表，判断是否该“下班”或“散会”。
  - **LLM Worker**: 在后台独立调用大模型，生成主动消息。
  - **Push Service**: 通过 Web Push API 发送通知给用户。

---

## 3. 关键问题解决方案 (Solutions to Key Challenges)

### Q1: 如何实现“自动挡”忙碌状态 & 正则裁剪？

**策略**: **协议化 Prompt (Protocol-based Prompting)**
我们不在界面上显示控制代码，而是要求 AI 在输出时携带**“隐形元数据”**。

- **System Prompt 设计**:

  > 每当你决定去做某事（如开会、睡觉、吃饭、专注工作）时，必须在回复末尾附加一个隐藏的 XML 标签。格式如下：
  > `<meta type="status_change" status="busy" reason="meeting" duration="60" />`
  > 这一行内容不要包含任何其他文字。

- **前端处理**:
  1.  用户收到: _"那先不说了，部门两点有个急会，我去准备一下。 <meta ... />"_
  2.  **正则处理**: 前端检测到 `<meta ... />`，将其从显示文本中**剔除**（用户只看到“我去准备一下”）。
  3.  **上报**: 前端解析 XML/JSON，提取 `{status: "busy", duration: 60}`，发送 POST 请求给服务器：`/api/update_status`。

### Q2: 如何防止“每次生成回复导致忙碌状态一直在变”？

**策略**: **状态锁定 (State Locking) & 持久化存储**

- **问题**: 如果单纯依赖每次 LLM 的输出，确实会因为随机性导致上一秒说开会，下一秒说在摸鱼。
- **解决**:
  - **服务器作为“唯一真理”**: 状态存储在服务器数据库中（`CurrentState`）。
  - **锁定机制**: 当服务器收到 `status="busy"` 指令后，将 AI 标记为 **LOCKED** 状态，并设定 `endTime = now + duration`。
  - **上下文注入**: 在锁定期间，如果用户强行发消息，服务器在调用 LLM 时，会在 System Prompt 里强制注入当前状态：
    > [System Info]: 你当前处于“开会”状态，直到 15:00 结束。用户发来了消息。请简短回复说明你在忙，不要接受新的任务。

### Q3: 用户未回复时，AI 如何主动发消息？（例如开完会后）

**策略**: **生命周期事件触发 (Lifecycle Event Triggering)**

这是本系统的亮点。即使没有用户的 `Pending Message`，服务器也会自行运转。

- **场景**: AI 说“我去开会了”（14:00），用户没回。现在是 15:00。
- **服务器逻辑 (Cron Job)**:
  1.  每分钟轮询 `State Store`。
  2.  检测到: `CurrentTime >= State.endTime` (忙碌结束)。
  3.  触发事件: `EVENT_STATE_TRANSITION (Busy -> Idle)`。
  4.  **检查上下文**: 读取服务器缓存的最后几条对话。
      - 发现最后一条是 AI 发的（Sender = AI），且内容包含“去开会”。
      - **结论**: 用户还没回，我需要主动告知我回来了。
  5.  **主动生成 (Self-Prompting)**:
      - 服务器向 LLM 发送 Prompt（注意，**不能只有开会这一种情况，情况可能有几百种，我们预设 prompt 不现实**）:
        > [System]: 你刚刚结束了时长 1 小时的会议。现在是 15:00。之前的对话停留在你告诉用户你去开会了。用户没有回复。请主动发起一条新消息，告诉用户你回来了，并根据你的人设（吐槽会议无聊/分享新点子），开启一个新的话题。
  6.  **推送**: 生成结果 -> Web Push -> 用户手机收到通知。

---

## 4. 数据传输策略 (Data Strategy)

针对你提到的带宽和连贯性问题：

- **人设同步**:

  - 服务器不需要存储庞大的人设库。
  - **初始化**: 在网页端配置好人设后，打一个包（System Prompt 核心部分 + 关键设定）POST 给服务器存起来（`profiles` 表）。
  - **更新**: 如果你在网页改了人设，触发一次 `sync`。

- **上下文 (Context)**:
  - 只有在触发 **“后台生成”**（即 AI 离线回复）时，才需要上下文。
  - **Payload**: 发送请求时，只携带 `RecentMessages` (最后 10-15 条)。这只有几 KB，对 2 核 2G 服务器完全无压力。
  - **不存全量**: 服务器只临时缓存这些 Context 用于生成回复，回复完可丢弃或存入轻量历史表，不需要同步整个数据库。（**存进去是不是可能更好的实现活人感？**但是用户太多可能服务器会爆，也许可以给这个功能单独弄个收费机制？比如触发一次 1 分钱？）

---

## 5. 开发路线图 (Development Roadmap)

### Phase 1: 基础环境 (Infrastructure)

1.  **Server**: Node.js Express 服务，搭建 API `/api/status`, `/api/webhook/llm`.
2.  **Database**: 初始化 SQLite，建立 `ai_states` (存储忙碌状态), `message_queue` (存储待推送消息).
3.  **Push**: 配置 VAPID Keys，打通 Web Push 通道。

### Phase 2: 状态机与正则 (The Glue)

1.  **Frontend**: 修改 `chat.js`，加入 `parseHiddenInstruction()` 函数，用于识别并隐藏 `<meta>` 标签。
2.  **Frontend**: 实现“状态上报”网络请求。
3.  **Prompt**: 调整 Character Card，植入 Status Protocol 指令。

### Phase 3: 影子大脑 (The Shadow Brain)

1.  **Backend**: 实现 Scheduler (定时任务扫描)。
2.  **Backend**: 集成 LLM API SDK (复用你的 Key)。
3.  **Logic**: 编写“主动唤醒”的 Prompt 模板。

---

## 6. 总结 (Summary)

这个方案的核心在于**将 AI 的“意识”分层**：

- **表层意识 (Frontend)**: 负责实时的、基于用户输入的快速交互。
- **深层意识 (Backend/Server)**: 负责维护时间感、日程安排和长期状态。

这种**正则隐藏指令 + 服务端状态机**的模式，是目前实现 Agentic AI（也就是有自主性的 AI）最成熟的轻量化方案。不需要复杂的 Agent 框架，只需简单的协议即可实现非常惊艳的效果。
