# 路线图第 4 步改版 + 去掉悬浮档案按钮（2026-11-03 交接说明）

> 本文是 2026-11-03 这次云端会话的完整记录（中文）。英文设计文档见 `docs/agent/roadmap.md`，Kappy 见 `docs/agent/kappy.md`，顾问 v2 整体蓝图见 `docs/agent/debate-blueprint.md`。

## 一、改了什么（一句话）

1. **去掉了页面右侧的悬浮档案按钮**（`components/profile/ProfileFab`）：角落只留 Kappy，Kappy 的气泡直接链到 `/adviser`。
2. **重做了 AI 顾问第 4 步「Your roadmap」**：审计通过后，模型起草**三份计划**供学生选择（页面明示 *Human must decide*，不选不保存）；**Kappy（同一个模型）读这三份计划**，写出对比、每份一句话、以及只有学生能回答的一个问题，并在自己写的文字里**自动高亮 3–6 处重点**（每处带理由）；页面处处让学生意识到**这是大语言模型在写、在读、在划重点**：实时流出的思考摘要、服务器给出的模型名、"高亮是模型自己选的，不是规则"的说明、像素 Kappy 随运行状态变化。

## 二、分支与如何同步到本地

这次工作在分支 **`claude/optimistic-ritchie-ioyesv`** 上，已推送到 GitHub。它的历史是：

```
main
 └─ adviser-debate（顾问 v2：辩论、裁判、审计，四步页面）
     └─ 合并 claude/amazing-rubin-d4g0qz（Kappy 像素吉祥物）
         └─ 7826058 本次改动
```

原来 `main` 上既没有顾问页面也没有 Kappy，所以先把两条分支合进来（只有 `package.json` 冲突，已解决），再在其上开发。

本地拉取：

```bash
git fetch origin
```

```bash
git checkout claude/optimistic-ritchie-ioyesv
```

```bash
npm install
```

```bash
npm run dev -- -p 3200
```

打开 http://localhost:3200/adviser?mock=1 → 点「Try the Arjun example」→ 回答问题 → 一路看到第 4 步（mock 不调用模型）。中文页在 http://localhost:3200/zh-hans/adviser?mock=1 。真实运行需要 `.env.local` 里有 `ANTHROPIC_API_KEY`（可选 `ADVISER_MODEL`，默认 `claude-opus-5-5`）。

## 三、去掉悬浮档案按钮

| 位置 | 改动 |
|---|---|
| `components/profile/ProfileFab.tsx` | 删除 |
| `app/[lang]/layout.tsx` | 去掉挂载和 `Suspense` 包裹 |
| `app/globals.css` | 删除整段 `.pfab*` 样式，以及顾问侧栏打开时给它让位的规则 |
| `components/profile/profile.ts` | 删除只给它用的 `filledGroups`、`PROFILE_GROUPS`、`ProfileGroup`；`serviceOf` 等「返回上一页」的函数保留（`BackToService`、`EditProfileLink` 还在用） |
| `components/kappy/KappyDock.tsx` | `ADVISER_HREF` 从 `/kappy` 改为 `/adviser`，气泡里的链接文字改为「Ask the AI adviser」；在 `/adviser` 第 4 步出现后角落 Kappy 自动隐藏（`body:has([data-kappy-stage])`，见 `kappy.module.css`） |

「Show/Hide the profile button」「Your profile: {n} of {m} parts filled」三条文案随之不再使用。

## 四、第 4 步的设计

### 4.1 流程

```
审计通过（passed）
  → planning：POST /api/adviser/plans   模型起草三份计划（agent "planner"，effort medium，可用读工具，50 s）
  → reviewing：POST /api/adviser/review Kappy 读三份计划（agent "kappy"，effort low，无工具，45 s）
  → done
```

- 浏览器状态机（`components/adviser/use-adviser.ts`）新增阶段 `planning`、`reviewing`；任一半失败只影响第 4 步：计划失败时显示裁判原来的带日期步骤 + 「Draft the three plans again」；解读失败时计划仍在 + 「Read them again」。
- 两个新路由沿用 `lib/adviser/route-kit.ts` 的防护（同源、限流、200 KB 上限、无 key 返回 503、不记录文本）和 NDJSON 流。
- plans 路由先在服务器上**重放两位顾问的工具调用**（和裁判一样），模型能用的数字和项目/岗位 id 只来自服务器结果，不信任浏览器回传的文本。

### 4.2 三份计划（`PlansResult`）

每份计划：`id`（A/B/C）、`title`（它做什么，不是标签）、`road`（先读研 / 先工作 / 定好顺序的两者）、`bet`（这份计划押的赌注）、`steps`（2–6 个带 `YYYY-MM` 日期的具体动作，按日期排序）、`givesUp`（选它要放弃什么）、`worksIf`（成立条件）、`picks`（≤2 个项目 id）、`roles`（≤2 个岗位 id）。`follows` 标出哪一份沿用裁判的决定，另外两份必须是学生真实的备选（另一条路、不同顺序、更晚的入学季、更便宜或更短的版本），提示词明确禁止稻草人。

**Human must decide**：三张卡片是一个 radio group，默认**没有**选中项；保存按钮在未选时显示「Choose a plan first」并禁用；旁注「Nothing is saved until you choose.」。选中后 Kappy 说「Plan X: your decision. Save it when you're sure.」。

### 4.3 Kappy 的解读（`ReviewResult`）

- `paragraphs`：2–4 段短文（每段 ≤3 句），对比而不是复述：各自最擅长什么、代价、成立条件、三份在钱 / 时间 / 工作准证 / 技能差距上的差别。
- `marks`：模型在**自己的段落里**选 3–6 处原文片段高亮，`kind` 三种：`key`（最有分量）、`risk`（条件不成立时的风险）、`check`（先去官网核对的数字或日期），每处带 `why`。
- `takes`：每份计划一句话（最擅长 + 代价），显示在对应卡片里。
- `question`：只有学生能回答、且决定选哪份的一个问题。
- `model`：由**服务器**写入的模型名（不是模型自己说的），页面用它告诉学生在读哪个 LLM。
- 提示词明文：**不替学生选，也不说该选哪份**。

### 4.4 怎样让使用者意识到「这是 LLM」

| 页面元素 | 作用 |
|---|---|
| 顶部说明 | 「A large language model drafts three plans … Kappy, the same model, reads them and highlights what it thinks matters. Neither picks for you」 |
| 实时思考摘要 | 起草和阅读两个阶段都把模型的 summarized thinking 流到页面；阅读完成后收进「Show Kappy's reasoning」 |
| 模型徽章 | 「LLM at work」→ 完成后显示服务器给的模型名 |
| 高亮 | 逐条画入（380 ms 一条，减少动态时直接显示），编号，点一下显示「Why Kappy marked this」；图例按三种 kind 计数 |
| 尾注 | 「You are reading a large language model, {model}. The highlights are its own choice, not a rule…」 |
| 像素 Kappy | 起草时思考、每次查询胸屏闪图标、计划到达时灯泡弹出、解读完成全亮、失败变红、保存时跳起撒星 |

### 4.5 校验（和决定同一套）

- 每一行都过 `lineCheck`：数字只能来自工具结果 / 学生资料 / 学生文本（外加 1–6 和未来五年的年份）、无录取承诺、无含糊词、页面语言正确（`lib/adviser/checks.ts`）。
- `checkPlans`：不足三份有效计划（每份 ≥2 个有效步骤）就返回 null，循环会把具体要求告诉模型再让它提交一次（`loop.ts` 新增 `submit.hint`）。
- `checkReview`：高亮的 `quote` 必须一字不差出现在它所在段落里，否则丢弃；段落全部不合格则重试。

### 4.6 保存到我的规划

「Save plan X to my plan」写入：

- `PlanAnswers.roadmap`（新增字段，`lib/plan-storage.ts`，`parsePlan` 校验）：计划 id、标题、步骤、日期；
- 该计划的项目进 `shortlist`（先读研的计划若没写项目，用裁判的 picks）；
- 裁判的技能差距进 `skillGaps`；
- 10 秒内可撤销。

`/plan` 时间线把选定计划的每一步显示为学生自己的行（`lib/plan-timeline.ts`，id `goal-roadmap-*`，education 步骤归学位停靠点，career 步骤归经历）。

## 五、文件清单

| 文件 | 内容 |
|---|---|
| `lib/adviser/types.ts` | `PlansRequest` / `Plan` / `PlansResult` / `ReviewRequest` / `Mark` / `ReviewResult`；agent 增加 `planner`、`kappy`；`DEADLINE_MS.plans`、`.review` |
| `lib/adviser/schemas.ts` | `SUBMIT_PLANS`、`SUBMIT_REVIEW`（非 strict） |
| `lib/adviser/prompts.ts` | `plansPrompt`、`reviewPrompt`；首条消息新增 `<decision>`、`<plans>` |
| `lib/adviser/checks.ts` | `checkPlans`、`checkReview`、`PLANS_HINT`、`REVIEW_HINT` |
| `lib/adviser/request.ts` | `plansOf`、导出 `callsOf` |
| `lib/adviser/loop.ts` | `submit.hint` |
| `app/api/adviser/plans/route.ts`、`app/api/adviser/review/route.ts` | 两个新路由 |
| `components/adviser/use-adviser.ts` | 新阶段、`retry("plans" \| "review")`、旧录像的 mock 兜底 |
| `components/adviser/roadmap.tsx` | 第 4 步整体：舞台、三份计划、Kappy 解读、技能差距、保存/撤销 |
| `components/adviser/plan-cards.tsx` | 三张卡片（radio group） |
| `components/adviser/kappy-read.tsx` | 段落 + 模型高亮 + 理由 + 图例 + 问题 + 思考开关 |
| `components/adviser/kappy-stage.tsx` | 舞台上的 Kappy，随运行驱动 |
| `components/adviser/adviser-app.tsx` | 第 4 步标题改为「Your roadmap: three plans, your call」，接入新状态 |
| `components/adviser/mock-run.ts` | mock 增加 `plans`、`review` 两段 |
| `lib/plan-storage.ts`、`lib/plan-timeline.ts` | `PlanAnswers.roadmap` 及其在 `/plan` 的行 |
| `app/ui.css` | `@source "../components/adviser"`（原来漏了，Tailwind 类名可能缺失） |
| `scripts/check-ui-css.mjs` | `components/adviser`、`components/kappy` 计入工作区（原先此检查在 adviser-debate 上就不通过，现在通过） |
| `scripts/check-adviser.ts` | 审计通过后继续驱动 plans、review，并断言：恰好三份计划、每份 ≥2 步、所有行通过措辞检查、高亮引文在段落中；`RECORD=` 时把两段一起录进 Arjun 录像 |
| `scripts/i18n/zh-hans/25-roadmap.json` | 新文案的简体中文（繁体由 `build.mjs` 生成） |
| `docs/agent/roadmap.md`、本文、`docs/agent/kappy.md`、`README.md` | 文档 |
| `exports/adviser-roadmap.png` | mock 运行下第 4 步（已选计划 B）的截图 |

## 六、已做的验证

| 检查 | 结果 |
|---|---|
| `tsc --noEmit`（需先 `npx next typegen`，并加 `NODE_OPTIONS=--max-old-space-size=8192`，默认 2 GB 堆会 OOM） | 通过 |
| `eslint app components lib content scripts/check-adviser.ts` | 通过（修掉了两处 `react-hooks/set-state-in-effect`） |
| `npm run check:ui-css` | 通过 |
| `npm run check:deps` | 通过 |
| `node scripts/i18n/extract.mjs` | 新文案无缺失；`missing.json` 已重新生成 |
| Playwright 走 `?mock=1`（英文、简体中文） | 到第 4 步 → 选计划 B → 保存 → 撤销提示 → `/plan` 出现「Yours」行；浏览器控制台无报错 |

**没有做的**：`npm run check:adviser`（云端环境没有 `ANTHROPIC_API_KEY`），所以两个新提示词还没在真实模型上跑过。

## 七、建议接下来在本地做

1. 起服务后跑一遍真实检查，并顺手重录 Arjun 录像（录像里会多出 `plans`、`review` 两段，`?replay=arjun` 就不再借用 mock）：

```bash
npm run dev -- -p 3200
```

```bash
RECORD=public/adviser/arjun-recorded.json npm run check:adviser
```

   Windows PowerShell 下设置环境变量：`$env:RECORD="public/adviser/arjun-recorded.json"; npm run check:adviser`。

2. 如果 plans 阶段经常被 `lineCheck` 删掉步骤（表现为某份计划步骤少于 2 个、模型被要求重交），先看是哪类数字被拦，改 `lib/adviser/prompts.ts` 的 `plansPrompt`，不要放宽检查。
3. 如果 review 阶段超时（45 s），把 `DEADLINE_MS.review` 调到 50 s，或把段落上限从 4 降到 3。
4. 确认后再部署：`netlify deploy --build --alias check`，在 check 链接上走完整流程。

## 八、几个可商榷的决定

- **「existing profile button」** 我理解为服务页右侧的悬浮档案按钮；如果你指的是别的按钮，告诉我位置即可。
- **Kappy 只在第 4 步登台**：第 1–3 步仍是角落里的 Kappy（点击气泡链到本页，略显多余但无害）。如果想让它从第 1 步就跟着运行（打字时倾听、辩论时分身戴学士帽 / 拎公文包），`docs/agent/kappy.md` 的接线表已经写好对应的调用。
- **review 阶段的允许数字**包含浏览器回传的 `final` 和 `plans` JSON（和现有 audit 路由信任 `final` 的程度一致）；若要更严格，可以只用服务器重放结果 + 学生文本。
- `scripts/i18n/missing.json` 是生成文件，这次重新生成后差异较大（去掉了已翻译的顾问文案，另外两条含 `\r\n` 的垃圾条目会在 Windows 上翻回去），属正常。
