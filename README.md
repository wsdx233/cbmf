# 模型色彩指纹 · cbmf

一个纯静态的「模型色彩指纹」测试页：让同一个大模型在相同提示词下反复生成配色板，然后把多组结果并排铺开，用颜色本身去观察模型输出的稳定性与偏好。

在线使用：<https://wsdx233.github.io/cbmf/>

仓库名 **cbmf** 即 *color block matrix fingerprint*。

## 它做什么

给定一个色彩主题描述（例如「逻辑的颜色」），页面并发发起多组完全相同的请求，每组要求模型返回指定数量的 HEX 颜色，然后把每组颜色渲染成一行色块。多行堆叠后形成一张色彩矩阵：

- **行**：一次独立的模型调用（「并发重复次数」）。
- **列**：该次调用中颜色出现的顺序。
- **颜色**：模型直接输出的 HEX 值。

同一提示词下多次采样，颜色分布越集中说明模型偏好越稳定；不同模型/参数之间的矩阵形态差异，就是所谓的「指纹」。

## 功能

- **三种协议**：`chat`（经典 OpenAI `/chat/completions`）、`response`（新 OpenAI `/responses`）、`message`（Claude `/v1/messages`）。
- **并发采样**：一次发起多个相同请求，每组独立流式接收，实时上色。
- **流式捕获**：不等待整段响应结束，边收边用正则提取 HEX，色块逐步弹出。
- **自动排序**：可将每行按两种算法之一排列——HEX 数值升序（默认）或 HSL（色相 → 明度 → 饱和度，灰阶最前，视觉上是自然色谱）；「HSL 排序」开关在开启自动排序后才出现。
- **共有色**：统计出现在超过一半组中的颜色，按当前排序算法排列，追加为最下方一行。
- **点击复制**：点击任意色块复制其 HEX 值。
- **错误提示**：接口错误、跨域失败等会通过页面底部 Snackbar 显示原因，失败行同时标记红色虚线。
- **导出图像**：把当前矩阵导出为无文本、无间隙的 PNG 拼图。
- **接口预设**：按名称保存/读取 Base URL、Key、模型、任务参数等组合。
- **本地持久化**：配置只写入浏览器 `localStorage`。

## 工作原理

### 请求内容

每个请求的 system prompt 固定为（`{count}` 为「每组颜色数量」）：

```text
你是一个色彩提取引擎。请根据用户需求生成严格由十六进制色彩HEX组成的JSON数组，包含准确的{count}个颜色。格式范例：["#A1B2C3", "#FFFFFF"]。除了纯JSON格式数据本身外，严禁输出任何解释、注释、Markdown标签或无意义文字。
```

user message 为：

```text
生成 {count} 个颜色：<色彩主题描述>
```

各协议的组装方式：

| 协议 | 端点 | system / user | 思考强度 |
| --- | --- | --- | --- |
| `chat` | `{baseUrl}/chat/completions` | 两条 `messages` | `reasoning_effort` |
| `response` | `{baseUrl}/responses` | 拼接为单个 `input`：`system\n\n需求：user` | `reasoning.effort` |
| `message` | `{baseUrl}/v1/messages`（末尾 `/v1` 会先去掉，避免 `/v1/v1/messages`） | `system` 字段 + 单条 user `messages`，`max_tokens` 4096 | `thinking.budget_tokens` |

### 颜色捕获与排序

- 响应按 SSE 行流式解析，累计已输出文本后用 `#(?:[0-9a-fA-F]{6}|[0-9a-fA-F]{3})(?=[^0-9a-fA-F])` 按出现顺序提取，每组只保留前 `count` 个。颜色必须被后续非 HEX 字符收尾才算完整，避免分片恰好截在 `#A1B` 时把 6 位值误捕成 3 位；流结束时仍无分隔符的颜色也会补捕。
- `response` 协议只采纳 `response.output_text.delta` 事件，推理摘要等其它 `delta` 不参与取色。
- 排序由「自动排序」决定是否启用；启用后才显示「HSL 排序」开关来选择算法：
  - HEX 数值（默认）：把 HEX 当作十六进制整数升序比较（`#RRGGBB` 数值小的在前）。
  - HSL：先按色相 0–360°，同色相按明度、饱和度升序，灰阶（饱和度 0）按明度排在最前。
  - 两种算法下排序键相同的颜色都保持原始出现顺序。
- 共有色先对每组内部去重（忽略大小写），统计每种颜色出现在多少组中，保留出现组数 **严格大于** 组数一半的颜色，并按当前排序算法排列。

## 隐私

- 页面是纯静态站点，没有后端、没有中继服务器，请求由浏览器直接发往你填写的 Base URL。
- API Key 与所有配置只保存在本机浏览器 `localStorage`，不上传、不记录、不统计。
- Key 会随请求直接交给该 Base URL 对应的服务方，其隐私政策由服务方决定。公共设备上使用后请清除本地配置。

## 本地运行

无需构建、无依赖。直接打开 `index.html`，或用任意静态服务器托管：

```bash
python -m http.server 8080
# 然后访问 http://localhost:8080/
```

浏览器要求：支持 `fetch`、`ReadableStream`、`localStorage` 的现代浏览器（Chrome/Edge/Firefox/Safari 当前版本）。

### 跨域说明

请求由浏览器直连你填写的 Base URL，该服务必须允许跨域（CORS）。Claude 协议额外携带 `anthropic-dangerous-direct-browser-access: true`，这是 Anthropic 官方为浏览器直连提供的开关。

## 文件结构

```text
index.html   页面结构、表单、各类弹窗（含关于本站）
styles.css   Material Design 3 风格样式
app.js       配置持久化、自定义下拉、弹窗栈、请求与流解析、排序、共有色、导出
```

## 部署

仓库根目录即站点根目录，无构建步骤。推送到 `main` 后由 GitHub Pages 直接托管：

<https://wsdx233.github.io/cbmf/>

GitHub Pages 对静态资源返回 `Cache-Control: max-age=600`，为让本次改动立即生效，`index.html` 里的 `styles.css` / `app.js` 带 `?v=<commit>` 查询串；改动这两个文件后同步更新该版本号即可绕开旧缓存。

## 作者

wsdx233 · <https://github.com/wsdx233>

## 友情链接

- [LINUX DO](https://linux.do/) —— 真诚、友善、团结、专业的技术社区
