# 一键提示词：AI 顾问 v2（本地 Claude Code）

在仓库根目录打开 Claude Code，先确认 `.env.local` 里有 `ANTHROPIC_API_KEY`、`ANTHROPIC_WORKSPACE_ID`、`NEXT_PUBLIC_SUPABASE_URL`、`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`，然后把下面整段粘贴进去。

```text
你要在这个仓库里一次性做完"AI 顾问 v2"：两位顾问并行辩论（先读研 vs 先工作）+ 裁判 + 审计（Make It Fail）+ 路线图页面。全程自主推进，不要停下来问我，除非遇到下面"必须停下"里列的情况。稳定性优先于功能多少。

## 0. 准备（按顺序执行）
1. git status 必须干净，不干净就停下告诉我。
2. git fetch origin
3. git checkout -b adviser-debate origin/adviser-server（分支已存在就 git checkout adviser-debate）
4. git checkout origin/claude/amazing-rubin-d4g0qz -- docs/agent/debate-blueprint.md docs/agent/one-shot-prompt.md
5. npm install
6. 检查 .env.local 里有没有 ANTHROPIC_API_KEY。没有就停下告诉我。只检查是否存在，不要打印它的值。
7. 完整读一遍 docs/agent/debate-blueprint.md 和 AGENTS.md。这是 Next.js 16，写路由前先读 node_modules/next/dist/docs/ 里 route handler 和 streaming 的指南。用 Anthropic SDK 前先读 node_modules/@anthropic-ai/sdk 的类型定义，确认 messages.stream、stream.on("thinking")、output_config、对话中途 role:"system" 消息在当前版本里的写法，不要凭记忆猜。

蓝图是设计依据：文件结构、types.ts 契约、C 部分的提示词原文、路由行为都照它做。蓝图里"S1–S5"的内容由你在这一个会话里按顺序完成，不用开第二个窗口。

## 1. 阶段与检查点（每个阶段结束都要：npm run typecheck && npm run lint 通过 → git commit）
- 阶段 1：修已知的 400。Opus 5.5 和 Sonnet 5.5 都不接受 thinking:{type:"disabled"}，也不接受强制 tool_choice（type tool 或 any）。lib/agent/run.ts 和 lib/agent/audit.ts 里都这样写了，按蓝图 C5 修。然后写 lib/adviser/{types,prompts,model,loop,roads,checks}.ts（蓝图 S1）。
- 阶段 2：写 app/api/adviser/{intake,case,judge,audit}/route.ts 和 scripts/check-adviser.ts，并在 package.json 加 "check:adviser" 脚本（蓝图 S2）。用 npm run dev -- -p 3200 起服务（后台运行），跑 npm run check:adviser，修到通过。
- 阶段 3：写 app/[lang]/adviser/page.tsx 和 components/adviser/*（蓝图 S3），先用 ?mock=1 跑通，再接真实路由。补齐 i18n：先运行 node scripts/i18n/extract.mjs，把缺的简体中文写进 scripts/i18n/zh-hans/adviser.json，再运行 node scripts/i18n/build.mjs。
- 阶段 4：联调和调提示词（蓝图 S4 的 7 项检查）。录制兜底：把一次真实 Arjun 运行的全部事件存成 public/adviser/arjun-recorded.json，页面支持 ?replay=arjun，并在页面上标明"这是一次录制的真实运行"。
- 阶段 5：npm run build 必须通过。然后做最终稳定性验收（见第 3 节）。

## 2. 稳定性要求（必须全部做到）
服务端：
- 模型统一用 process.env.ADVISER_MODEL || "claude-opus-5-5"，thinking adaptive + display summarized，tool_choice 只用 auto。ADVISER_FAST 默认关闭；打开后只要出错，就自动退回标准速度。
- 每次模型调用都用 AbortController 绑定该阶段的截止时间（DEADLINE_MS），超时就立即中止。对 429、5xx、overloaded 和网络错误，在截止时间内最多重试 2 次，用指数退避加随机抖动；400 不重试，直接报 failed。stop_reason 是 refusal 时返回 failed。
- assistant 消息原样追加（包括 thinking 块），不改历史。同一轮的工具并行执行，所有 tool_result 放进同一条 user 消息。单个工具抛错时返回 is_error 的 tool_result，循环继续，不中断。
- 到 NUDGE_MS 提醒模型收尾。模型 end_turn 但没调 submit_* 时重试 1 次；再失败就返回 failed，不要无限循环。工具调用总数硬上限 12。
- 所有输出都过检查（lineOk、inLanguage、来源 id、programme/role id 必须是工具返回过的）。不合格的行丢掉，不能整段失败。检查后某个必需字段为空时，填一条中性的占位说明，不要返回半残的 JSON。
- 后一阶段在服务器上重放前一阶段的工具调用，不信任浏览器送来的文本。
- 防护照抄 app/api/parents/route.ts。限流放宽到演示够用：每 IP 每分钟 30 次、每天 500 次。绝不记录或打印学生文本和 answers。
- 每个路由同时支持 NDJSON 流式和 ?stream=0 一次性返回，最长运行时间按 Next 16 的写法声明为 60 秒。流的最后一行必须是 result 或 error；遇到异常也要先写出 error 行再关闭流。
前端：
- 每个请求用 AbortController，58 秒超时。网络错误或 502 时自动重试 1 次（随机等待 0.5–1.5 秒）；429 时提示"稍等一分钟"。
- 每次运行带一个 runId，迟到的响应和旧运行的事件一律丢弃。运行中禁用开始按钮；离开页面或重新开始时中止所有请求。
- NDJSON 解析要处理被拆开的半行，坏行跳过，不能让页面崩溃。整个顾问区包一层 React error boundary。
- 降级规则：
  · intake 失败 → 跳过追问，直接进入辩论；
  · 某一个 case 重试后仍失败 → judge 只用另一个 case，页面在那一栏标"这一方没能完成"；
  · 两个 case 都失败 → 显示错误，并提供"看录制版"按钮（?replay=arjun）；
  · judge 失败 → 同上；
  · audit 报错（不是拦截）→ 不展示未经核对的结论，按拦截处理一次改写；仍然失败 → 显示"请找人工顾问"。
- 未经审计通过的 Step 3 和 Step 4 永远不显示给学生。
不要改的东西：不动 lib/agent/types.ts 的现有导出，不动 app/ui.css，现有页面只加一个"问 AI 顾问"入口链接。不部署 --prod。

## 3. 完成标准（全部满足才算完成）
1. npm run typecheck、npm run lint、npm run check:deps、npm run build 都通过。
2. npm run check:adviser 连续跑 3 次，3 次全部通过（4 个样例 × 断言见蓝图 S2）。任何一次失败都要修，然后重新从第 1 次计数。
3. 用 Playwright（本机已装，require('playwright') 可用）打开 http://localhost:3200/zh-hans/adviser 和 /en/adviser，用示例 Arjun 点完整流程，确认四步都出现且没有控制台报错，截图保存到 exports/adviser-zh.png 和 exports/adviser-en.png。另外截一张 ?replay=arjun 的图。
4. 手动制造故障验证降级：临时把 ADVISER_MODEL 设成一个不存在的模型名，确认页面显示错误和"看录制版"按钮，而不是白屏或无限转圈；验证完恢复原值。
5. 把 public/adviser/arjun-recorded.json 和截图一起提交。最后一次提交完成后执行 git push -u origin adviser-debate。

## 4. 必须停下告诉我的情况
- .env.local 缺 key；git 工作区不干净；
- 同一个错误修了 3 次还在；
- 需要改 lib/agent/types.ts 的现有导出、改 app/ui.css，或者删除现有功能；
- 任何阶段实测耗时持续超过 55 秒，降 effort 也压不下来。

## 5. 最终报告（用中文）
- 每个新文件一句话说明；
- check:adviser 三次运行里每个样例的阶段耗时、工具序列、lean、审计结果；
- 截图路径；
- 偏离蓝图的地方和原因；
- 还没做的事项。
```

## 跑完之后（你自己做）

部署前在 check 链接上实测 Netlify 的时长限制（蓝图 S5 第 1–3 步）：

```bash
netlify deploy --build --alias check
```

如果线上流式响应被截断，在页面网址后加 `?stream=0`；还不行就用本地 `npm run dev` 现场演示，`?replay=arjun` 作为最后的兜底。
