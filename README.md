# Kaplan 360++

Team ReFly.X's entry to Kaplan Singapore's AI For Impact 2026 hackathon. Live site: https://kaplan360pp-v201.netlify.app

Kaplan 360 is where Kaplan students study. Kaplan 360++ is the patch for what comes after graduation: a job, a master's or a gap, each checked against official pages.

## Who it's for

Diploma and degree students at Singapore's private education institutions (PEIs). In 2024, 141,700 students started at PEIs, up 4%. Diplomas made up 25% of that intake and bachelor's degrees 12% ([SkillsFuture SG, "2024 Private Education Sector Overview"](https://isomer-user-content.by.gov.sg/41/4f26526a-a750-4dee-82d5-00bec4ef0e11/2024%20Private%20Education%20Sector%20Overview.pdf), PEI Annual Returns as of 31 Dec 2024).

## Here by default, not by design

A study of nine former full-time PEI undergraduates found that students were "pushed" to PEIs: by their parents' expectations, by a degree seen as the key to a job, by public universities out of reach, and by overseas study that cost too much ([Dhaliwal, 2022](https://napier-repository.worktribe.com/output/3050956), p. 117). Majors were rarely discussed. Information came from ads, friends and sales staff.

What we saw on top of that:

- Agents promise "easy to apply", "a springboard", "fast".
- Social feeds are crowded with agency posts, resold notes, resit tutoring, ghostwriting and paid "planning".

What the Ministry of Manpower (MOM) says:

- A Student's Pass doesn't allow work without a work pass: "Student’s Pass holders need a work pass in order to work" ([MOM, 2 August 2021](https://www.mom.gov.sg/newsroom/parliament-questions-and-replies/2021/0802-written-answer-by-minister-for-manpower-on-foreigners-on-student-pass-doing-part-time-work)).
- Employers look past qualifications: "Academic qualifications were not the main determinant in hiring for 79.6% of vacancies in 2025" ([MOM, Job Vacancies 2025](https://www.mom.gov.sg/newsroom/press-releases/2026/0320-job-vacancies-report-2025)).

## What Kaplan 360++ does: three moves

- **Break it down.** After graduation there are three roads: Work · Study · Gap. Each is laid out with the official rules that apply to it.
- **Bring it together.** Start from the job. Career Compass shows the hot roles in Singapore's industries, how your degree's modules match each role's skills, the skill you're missing, and the master's programmes (top-ranked schools included) that teach it.
- **Lay it out.** Your plan draws a map of your roads and a month-by-month timeline: tests, applications, internships and Kaplan activities. Download it as a PDF or a calendar file.

## A student's path

Home (`/`) → Insights (`/move`) → Your profile (`/profile`) → Career Compass (`/careers`) → an industry (`/careers/industries/…`) → a role (`/careers/roles/…`) → Programme finder (`/results`, when a master's fills the gap) → Your plan (`/plan`).

Every page can be tried with the worked example, Arjun: a UCD finance top-up student at Kaplan on a Student's Pass.

## How we keep it honest

- **Receipts.** Every number comes with the sentence it was read from on the official page. Our own counts are labelled "our count".
- **Ranked by match**, never partner-first.
- **No admission probabilities.** `npm run check:rai` scans the site's text and every Claude-drafted line for admission-chance wording before a deploy.
- **Answers stay in the browser.** No accounts, cookies or tracking. The one exception: "Fill in the form for me" sends the sentence you type, and it isn't stored.
- **How AI is used.** Claude (Anthropic):
  - reads official university, employer and government pages, picks out fees, requirements, intakes, scholarships and deadlines, and checks each figure word for word against its sentence; a figure whose sentence isn't on the page is dropped (`scripts/pipeline`, `scripts/benefits`, `scripts/plan`, `scripts/topups`);
  - maps each Kaplan degree's modules to Skills Framework skills, beside rule-based links (`scripts/careers/build-careers-data.mjs`);
  - tags master's programmes with Skills Framework skills from their module lists and learning outcomes (`data/raw/master-skills.json`);
  - reads the sentence you type into "Fill in the form for me" into form fields you confirm (`lib/profile-ai.ts`);
  - on the AI adviser (`/adviser`, `lib/adviser`, `docs/agent/debate-blueprint.md`), argues master's first against work first with the site's own lookups, decides, has a second model audit every figure against the official quotes, then drafts three plans and, as Kappy, reads and highlights them; the student chooses the plan, never the model (`docs/agent/roadmap.md`).

  It doesn't estimate admission chances, rank students or write statistics.
- **Respecting sources.** robots.txt honoured, requests paced, quotes short and linked, licensed data attributed (see "Responsible AI and data use" below).

## Known limits

- The thesis sample is nine people, interviewed online in 2020. It had no Chinese participants.
- Growth is receipted for 2024 only.
- The agent and social-media observations are the team's own, without counts.

## What's next

- A Kaplan activities filter: career guidance, career fairs, UCD societies.
- Help with CV wording.
- Email updates.

## Sources

- Dhaliwal, D. S. (2022). *Factors Influencing Students' Choice to Enter Private Education Institute Undergraduate Full-Time Programmes in Singapore*. DBA thesis, Edinburgh Napier University. https://napier-repository.worktribe.com/output/3050956
- SkillsFuture Singapore. *2024 Private Education Sector Overview* (PEI Annual Returns as of 31 Dec 2024). https://isomer-user-content.by.gov.sg/41/4f26526a-a750-4dee-82d5-00bec4ef0e11/2024%20Private%20Education%20Sector%20Overview.pdf
- Ministry of Manpower. "Foreigners on Student's Pass doing part-time work", written answer to a parliamentary question, 2 August 2021. https://www.mom.gov.sg/newsroom/parliament-questions-and-replies/2021/0802-written-answer-by-minister-for-manpower-on-foreigners-on-student-pass-doing-part-time-work
- Ministry of Manpower. "Job Vacancies 2025: Labour demand gradually shifting to growth areas as firms adjust hiring plans", press release, 20 March 2026. https://www.mom.gov.sg/newsroom/press-releases/2026/0320-job-vacancies-report-2025

Every other figure on the site carries its own receipt (`lib/home/receipts.ts`).

---

The rest of this file is the technical reference: setup, deployment, pages, data pipeline and Responsible AI details.

## 第一次在电脑上运行

需要先装好 Node.js（建议 22 或更新版本，https://nodejs.org ）。然后在 VS Code 里打开这个文件夹，按 `` Ctrl+` `` 打开终端，依次输入：

```bash
npm install      # 第一次运行时安装依赖，之后不用再装
npm run dev      # 启动本地网站
```

然后用浏览器打开 http://localhost:3000 。改动代码后网页会自动刷新。按 `Ctrl+C` 停止。

其他命令：

```bash
npm run build    # 打包正式版本，检查有没有错误
npm run lint     # 检查代码写法
```

## 部署到 Netlify

网址：https://kaplan360pp-v201.netlify.app （项目 `kaplan360pp-v201`，团队 ofelix-bot，Personal 方案）。Netlify 上设了两个公开变量 `NEXT_PUBLIC_SUPABASE_URL` 和 `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`。网站运行时只有一处调用 AI：第 1 步的“帮我填表”（`app/api/profile`，Claude Haiku）把学生输入的一句话读成表单字段，只发送这句话、不保存也不记日志，学生确认后才写入浏览器。它需要在 Netlify 上另设机密变量 `ANTHROPIC_API_KEY`（可选 `ANTHROPIC_WORKSPACE_ID`）；没设时这个输入框会提示“暂时不可用”，其余功能不受影响。团队的 AI Features（Netlify 的 AI Gateway）已关闭，和这一处无关。项目的访问保护（Netlify 登录）已关掉，评委不用登录；"Powered by Netlify" 浮标也已关掉；全站 `noindex`。

```bash
netlify deploy --build --alias check   # 草稿：https://check--kaplan360pp-v201.netlify.app ，不花部署额度
netlify deploy --build --prod          # 正式：每次 15 credits
```

- 一定要用 `--build`：先 `netlify build` 再 `deploy --no-build` 会把原始 `.next` 传上去，页面没有样式和图片。
- `npm run dev` 开着时会锁住 `.next`，构建报 "Failed publishing static content"。先停掉 dev，或者把网站文件（`app components lib public data/raw/kaplan-*.json data/raw/careers.json` 和根目录的配置文件、`.netlify/state.json`）复制到别的文件夹，`npm ci` 后在那里部署。
- 不要加 `proxy.ts`（middleware）：Netlify 的 Next.js 插件在 Windows 上打包它会失败。
- 顶栏和布局里不要用 `usePathname()` 这类读网址的 hook：没预渲染的网址在 Netlify 上会变成 500。

## Pages

| Page | Route | Notes |
| --- | --- | --- |
| Home: hero and the "Why Kaplan 360++" bento | `/` | |
| Insights: Look, Check, the Work · Study · Gap roads, Decide, receipts | `/move` | `/insights` redirects here |
| Your profile: degree, English, internships, work, certificates | `/profile` | The old Start planning steps (`/profile/academics`, `/profile/preferences`) are gone |
| Career Compass (nav label "Compass"): pick a Kaplan degree, see the Singapore industries it leads to | `/careers` | `/careers/industries` and `/careers/roles` open this page |
| Industry: its hot roles, matched to your degree | `/careers/industries/[industry]` | |
| Role: key skills, your match, the missing skill, gap actions, master's that cover it | `/careers/roles/[role]` | The old `/careers/[slug]` pages redirect to their role page |
| Programme finder | `/results` | |
| Your plan: timeline, with the Map tab (formerly "Next steps") | `/plan` | `/next-steps` redirects to `/plan?view=map`; the plan chosen on the AI adviser shows as the student's own rows |
| AI adviser: two advisers argue, a judge decides, a second AI audits, three plans to choose from, read by Kappy | `/adviser` | `?mock=1` demo data, `?replay=arjun` a recorded run (`docs/agent/roadmap.md`) |
| Kappy, the adviser's pixel mascot: every state on a stage | `/kappy` | The corner Kappy on every page links to `/adviser` |
| Outcomes | `/outcomes` | |
| Benefits | `/benefits` | |
| Routes: diploma to degree | `/pathway` | |
| Where you stand | `/where-you-stand` | |
| Declaration: how the site is built, disclaimer, your answers | `/declaration` | |
| About us | `/about` | |

所有规划答案和收藏只存在浏览器里。`/results` 一次下载全部项目的静态数据（`/data/programmes`，压缩后约 200–300KB），在浏览器里匹配，答案不发送到任何地方。

## 文件夹说明

```
app/            网站的各个页面（每个文件夹就是一个网址）
  layout.tsx    所有页面共用的顶栏和底栏
  page.tsx      首页
  globals.css   全站样式（颜色、字体、浅色和深色模式）
lib/types.ts    数据格式的定义：学生资料、课程
data/           课程数据（目前为空，只放来自官网的数据）
.env.example    API Key 模板；复制成 .env.local 再填，.env.local 不会被上传
```

## 规则

- 课程数据只来自大学官网，每条都带官网链接和最后核对日期；官网没写的值留空，不猜。
- 不显示录取概率，不说"你能/不能被录取"。
- API Key 只放在 `.env.local` 或 Netlify 的环境变量里，不写进代码。
- 学生填写的规划答案只存在浏览器里（`lib/plan-storage.ts`），不发到服务器，不用 Cookie。"Remember my answers on this device" 开启时存 localStorage，90 天未使用自动删除；关闭时存 sessionStorage，关掉浏览器即清除。页面上有 "Clear my answers" 一键清空。网站不放分析或跟踪工具；以后如果要加，须先补同意选项。

## Homepage plan

Agreed on 2026-10-18 for the Kaplan (Singapore) **AI For Impact 2026** hackathon (live coding 2–3 November 2026). Audience: Kaplan judges.

**Brand and visual language**
- Borrows Accenture's design language (a logo symbol built into the slogan, very large type, one accent colour, generous white space, horizontal card carousels). Accenture's purple, its ">" glyph and the Graphik typeface are not used.
- Slogan **"Plan ahead."**: the intro (about 3.6s) opens on the official Kaplan logo. Its arc drops and lands as a white ribbon with an unlit bulb at its end; "PLAN" turns amber while "KA" fades and slides away, and its letters close up to the slogan's tracking; "PLAN" stays in place as the slogan's first word (the logo's own letterforms, cap height matched to the heading type) and "ahead." joins. Amber then flows along the ribbon, lighting Diploma and Degree as it passes, closes a 360° ring and lights the bulb (Master's). Plays on every page load; reduced motion shows the final frame with a short fade.
- The intro takes the official logo apart (decided 2026-10-18, worth confirming with the organisers). The header logo stays unaltered, and the footer says the intro is hackathon concept work, not an official Kaplan brand asset.
- Kaplan indigo `#240F6E`, white, amber accent. Archivo (one variable family, chosen 2026-10-19): headings and headline figures at 125% width (Archivo Expanded), body at normal width; Noto Sans SC (Chinese). Light and dark modes.
- Header: logo, Outcomes / Careers / Benefits / Plan my path, "Start planning". Transparent over the hero, solid after scrolling; full-screen menu on mobile.

**Sections**
1. **Hero**: slogan and trajectory.
2. **① Graduate outcomes**: headline is Kaplan Singapore's secured employment rate, 77.3% (PEI GES 2024/25), against the private-degree average (78.9%) and public universities (88.9%), with a three-survey trend, a definition note and response rates; starting salaries are secondary (Kaplan S$3,400, private S$3,500, public S$4,500); a salary dot plot by survey year (private, public university, polytechnic); secured and full-time permanent employment bars; "no official data" for private diplomas; Ireland, Australia and the UK, each with its measurement window. Phase 1: all Singapore groups plus UK, Australia and Ireland; phase 2: other regions.
3. **② In-demand careers**: 8 cards (Data Analyst/Scientist, AI/ML Engineer, Cybersecurity Analyst, Financial Analyst/FinTech, Digital Marketing Manager, Supply Chain & Logistics Manager, Software Engineer, Registered Nurse). Each shows the Singapore median salary (MOM), 3 key requirements (SkillsFuture Skills Framework), "N programmes can help" and the top 3 master's programmes, with Kaplan partner universities (Aston, Birmingham City, Monash, Murdoch, Northumbria, UCD, Portsmouth) tagged "Kaplan partner" and never put first for it, in neutral wording. The pipeline gains 4 fields: IT/CS, cybersecurity, supply chain, nursing.
4. **③ Benefits you can claim**: a count of open fee waivers, the next 3 deadlines and a preference picker (field, country, intake, budget) computed in the browser with nothing collected. Events are hand-checked against official pages and hidden after their deadline. "New this cycle" means first seen for the 2027 intake by the pipeline. Claude drafts a "claim / know / prepare" checklist from verified data only.
5. **④ Start**: diploma and degree entry cards.

**Data and compliance**
- Reuse the v1 pipeline and its 380 programmes, re-checking dates, and extend from there.
- Raw data: `data/raw/*.json`, each record with `source`/`sourceUrl`, `retrievedAt` and `verbatimQuote`. `npm run export:raw` writes `exports/kaplan360-raw-data.xlsx`.
- Pages show neutral summaries with a source link and date: no school logos, no marketing claims, no admission chances, nothing out of date. Empty states explain what is missing instead of hiding a section.
- No "AI-generated" labels in the page body. The footer has one specific disclosure; the full Responsible AI statement goes in this README and the pitch deck.

**Engineering**
- English UI first, structured so other languages can be added later.
- Deploy on Netlify, `noindex`, link shared with judges only. Claude runs only in the local data scripts (own Anthropic key); the site makes no AI calls, so Netlify AI Gateway is not used.
- Order: hero + ① → collect ② and ③ data and extend the pipeline → ② and ③ UI. Deploy after each stage.

### Database (Supabase)

Postgres on Supabase; schema in `supabase/migrations/`. The site reads with the publishable key (read-only RLS); the pipeline writes with the secret key. Raw job postings and the Degree Enrolment Day deck (private `source-documents` bucket) are service-role only.

```bash
npm run data:qs       # QS WUR 2027 → data/raw/qs-wur-2027.json
npm run data:roster   # Kaggle roster + QS + Kaplan partners → data/raw/institutions.json
npm run data:kaplan   # Kaplan Singapore programmes → data/raw/kaplan-programmes.json
npm run db:push       # apply migrations (needs SUPABASE_DB_URL)
npm run data:load     # upsert data/raw/*.json into Supabase, upload private documents
```

Sources kept out of git (`data/sources/`): the Kaggle CSVs (licence "© Original Authors") and the Degree Enrolment Day deck (contains bank details and staff contacts, which are not transcribed).

### Programme data pipeline

Master's programmes from official university pages (`scripts/pipeline/`, adapted from the v1 demo's code; no v1 data reused). Sources are listed in `scripts/pipeline/sources.ts` by institution id.

```bash
npm run pipeline:discover -- --only=aston-university   # sitemaps / course listings → candidate URLs
npm run pipeline:fetch -- --only=aston-university --limit=10   # polite fetch into data/pipeline/cache
npm run pipeline:extract   # rules: name, degree, discipline, entry requirement, IELTS, duration, intake, fee
npm run pipeline:ai        # Claude Haiku fills what the rules missed; every quote checked against the page
npm run pipeline:english   # university-wide English requirement pages (table parsers, no AI)
npm run pipeline:build     # → data/raw/programmes.json + data/pipeline/report.md
npm run data:load          # → Supabase
```

- Sources: tier-1 configs started from the v1 demo's origins and URL patterns (each re-verified by discovery) and were otherwise built from each site's sitemaps and course lists (`npm run pipeline:probe`, `scripts/pipeline/links.ts`). Catalogues that load by script are saved as explicit lists in `scripts/pipeline/lists/` with their source and date (UCD). Lists that page by script are clicked through in the browser (`listingNext`).
- Fetching: robots.txt and Crawl-delay honoured, one request at a time per host (≥ 2.5 s apart), each "next page" click paced the same way. Sites that reject scripted clients (`browser: true`) are fetched through a real, visible Edge window (`scripts/pipeline/browser.ts`) with its own user agent; no fingerprint spoofing, CAPTCHA solving or proxy rotation. Pages that stay blocked go to a manual queue.
- robots.txt groups for AI assistants (Claude-User, ChatGPT-User, Perplexity-User): until 2026-10-19 a site that disallowed them was skipped even when our own token was allowed. From 2026-10-19, at the project owner's decision, only the rules for our own token (and `*`) decide; the AI-assistant groups are still read and counted in the probe report.
- Coverage: `data/pipeline/report.md` ends with every tier-1 institution and its status (collected, skipped with the reason, or not configured yet).
- Claude sees only the page lines relevant to the missing fields. A fee is kept only when a page line holds the figure under an international/overseas label within 12 lines; the stored quote is the page's own label and figure lines, and the fee basis (full course / first year / per year) comes from the page's wording. Other fields need a verbatim quote that contains the value. Rejected values are logged and dropped.
- Cost: Haiku 5.5 at $0.10 / $0.50 per million tokens ≈ US$0.0008 per programme.
- Other tests (rules, from the cached pages, no AI): TOEFL iBT, PTE Academic and Duolingo minimum scores, and whether the GRE / GMAT is required, optional or not required (with a minimum when stated), each with its quote (`lib/pipeline/requirements.ts`). Claude fills a TOEFL score only when the rules found none.
- Coverage targets: tier 1 = Kaplan partners, Singapore / UK / Australia / Ireland, and the QS 2027 top 500 (564 institutions). Phase 1 adds the US, Canada, New Zealand and Hong Kong and the rest of the UK, Australia, Ireland and Singapore; origins are in `scripts/pipeline/lists/phase1-origins.json`, each checked to load before use.

### Results data

- `lib/data/results.ts` builds the `/data/programmes` file: programmes with university, QS rank, fee, tests, intake months (parsed from the page's wording) and the minimum UK class named in the requirement.
- Fees in S$: MAS end-of-month exchange rates (`npm run data:fx` → `data/raw/fx-mas.json`, from eservices.mas.gov.sg), shown as approximate. A fee stated per year is used as is; a full-course fee is divided by the years; a fee with no stated period on a course of 12 months or less is taken as that year's fee; anything else is "can't compare" and never filtered out by the budget.
- Comparisons (`components/results/compare.ts`) put the student's answer next to the published minimum only: meets / below / check the wording. A class is compared only with a requirement stated as a class, and only for UK- or Irish-awarded Kaplan degrees; GPA / WAM systems are never converted.
- University-wide English minimums: where a programme page states no score, the university's own graduate English page (`scripts/pipeline/lists/university-english.json`, read by `english-university.ts`) supplies it, and the card says "(university-wide minimum)".

### Smart insights on /results

- **What-if mode** (`components/results/WhatIf.tsx`): change the English score, degree result or budget and see how many programmes' published minimums you'd meet (before → after), with the programmes that change. Marked "What-if mode"; the saved answers and the list never change. Rule-based, in the browser.
- **How should I prepare?** (each card, `components/results/Prepare.tsx`): the gaps between the student's answers and that programme's published requirements, then a "Before applying" list drafted at build time by Claude from the programme's own official quotes (`scripts/pipeline/prepare-ai.ts`, ≈ US$0.0002 a programme), always ending with the deadline, prerequisites and the official page. Steps are loaded per field (`/data/prepare/<field>`), so no answer leaves the browser. A step is dropped if it states a number the quotes don't, mentions the source, or uses admission wording.
- **Compare your shortlist** (`components/results/CompareTable.tsx`): two or three starred programmes side by side: university, QS rank, fee and S$ a year, length, start months, IELTS / TOEFL / GRE / GMAT, the student's checks and the official page.

### Careers data

- Pay: MOM Occupational Wage Tables 2025 (Occupational Wage Survey, June 2025; released 30 June 2026), Table 1, median monthly gross wage of full-time resident employees. Each career maps to SSOC 2024 occupations; the first gives the headline. Download `mrsd_2025Wages_table1.xlsx` from https://stats.mom.gov.sg/Pages/Occupational-Wages-Tables2025.aspx into `data/sources/mom/`, then `npm run data:mom` → `data/raw/careers.json`.
- Requirements: the Skills Framework Dataset (Q3 2026) from the Jobs-Skills Portal (https://jobsandskills.swda.gov.sg/frameworks/skills-frameworks; the old skillsfuture.gov.sg framework pages now return 404). `npm run data:skills:fetch` downloads it through the browser (the button works by script), `npm run data:skills` adds each career's framework job role and its skills to `data/raw/careers.json`. Skills are ranked by proficiency level weighted by how few job roles share the skill, so the first three are the most characteristic. The portal's terms bar reproducing its content without written permission, so only skill titles and proficiency levels are kept and shown, with attribution and a link (no descriptions, job role descriptions or work functions); permission to show more has been requested from SWDA.
- Openly licensed complement: O\*NET® 31.0 Database (USDOL/ETA, CC BY 4.0). Unzip `db_31_0_text.zip` from https://www.onetcenter.org/database.html into `data/sources/onet/`, then `npm run data:onet`: per career, the closest O\*NET-SOC occupations (US), their description (used as the career summary), skills with importance and level ratings, and "Hot Technology" software (office and email tools left out). Pages using it carry the licence's attribution for modified content: "This page includes information from the O\*NET 31.0 Database by the U.S. Department of Labor, Employment and Training Administration (USDOL/ETA). Used under the CC BY 4.0 license. O\*NET® is a trademark of USDOL/ETA. Kaplan 360++ has modified all or some of this information. USDOL/ETA has not approved, endorsed, or tested these modifications."
- Order: `npm run data:mom && npm run data:skills && npm run data:onet`, then `npm run data:load`.
- Employers: `scripts/careers/employers.ts` lists candidate employers per career (Fortune Global 500 2026, LinkedIn Top Companies Singapore 2026, employers named in Kaplan's graduate survey, Singapore's public healthcare clusters) and each one's own careers-site search. `npm run careers:fortune` saves the Fortune list (names and positions only); `npm run careers:openings` opens each search in the browser (robots.txt honoured: Citi, Goldman Sachs, Accenture and Maersk disallow their job search and are skipped), Claude lists the Singapore postings that fit the career, and a title counts only if it is on the page verbatim; `npm run careers:employers` adds list memberships → `data/raw/career-companies.json`. Pages show employer names and opening counts with the check date, never posting text or logos.
- Employers of Kaplan graduates: the 51 names on p. 13 of the Degree Enrolment Day deck (Kaplan's 2021/22 graduate survey, run by Nexus Link, not comparable with the PEI GES), matched to their English names, are shown in the Outcomes section.
- Not used: MyCareersFuture job postings. Its terms of use bar reproducing or creating derivative works from its content, so posting counts or skills tallied from it are not shown.

### Benefits data

- Sources: `scripts/benefits/sources.ts`, the official scholarship, deadline, country and event pages of Kaplan Singapore's seven partner universities (hubs, plus the award pages they link or the sitemap lists).
- `npm run benefits:collect`: Claude (Haiku) lists each page's scholarships, fee reductions, application-fee waivers, deadlines and events with verbatim quotes; an item is kept only if its title and every quote are on the page, every amount in its value is in its quote, and each date's day and month are in its quote. Runs add up (`--refresh` starts a university again) → `data/raw/benefits.json`.
- `npm run refresh`: the weekly refresh of what changes fastest. It snapshots `benefits.json` and `plan-dates.json` (`data/snapshots/<date>/`), reads the benefit pages again (`--refresh`), drafts checklists for new or changed records only, reads the planner's date pages again, then `scripts/changes/diff.ts` writes `data/raw/changes.json` ("What changed" on the homepage and /benefits). A change is reported only when the refreshed page confirms it: a title gone from a page that was read, an old date or value whose quote is gone while the new one is on the page, or a record not seen before (an award with its value or date; past dates are not reported). Records the model missed but whose title is still on the page are carried over unchanged. Then `npm run data:load` puts the refreshed benefits in Supabase.
- `npm run benefits:checklists`: at build time, Claude drafts a "claim it / know / prepare" checklist for each benefit from its quotes only; a bullet with a number not in the quotes, or a remark about the source, is dropped. At runtime the site calls a model in one place only: step 1's "Fill in the form for me" (`app/api/profile`).
- Sources now cover the 7 partners plus 20 tier-1 universities Singapore students often apply to (UK 12, Australia 5, Ireland 1, Singapore 1; SMU has no general master's scholarship page). Without a `follow` pattern, hub links naming a scholarship, bursary, award, discount or funding are read.
- Shown only when meant for a Singapore student on a taught master's (rules in `scripts/data/load-supabase.mjs`, about 100 of 273 hidden on 2026-10-19): not staff-only; not limited to other nationalities or groups (Claude's "no" counts only with the limiting words quoted, and those words must name a country, region or group; titles naming one, refugee and sanctuary awards and Commonwealth Master's Scholarships are hidden too); not research-degree-only (PGR, PhD); not undergraduate entry (ATAR, school leavers) or Australian regional awards; not a bare heading such as "Closing date".
- On the page, open or closed is worked out in the browser against today's date: past deadlines are hidden; awards for an intake or academic year that has passed are kept apart as "last cycle, for reference". Staff-only discounts are not shown; alumni discounts are, and are flagged when the visitor's saved Kaplan degree is awarded by that university.

### Responsible AI and data use

**No admission verdicts, checked by code.** `lib/rai.ts` lists wording the site never uses: admission chances or probabilities, "you will be admitted / you can't get in", guarantees, eligibility verdicts, safe / reach banding, judging the applicant. Claude-drafted text (benefit checklists, "Before applying" steps) is filtered against it at build time, and `npm run check:rai` scans the site's own text and all Claude-drafted data for it before a deploy (exit code 1 on a hit). Caveats ("not guaranteed", "check whether you are eligible") are allowed.

**Where AI is used.** Claude Haiku 5.5 (Anthropic), only in the data pipeline, never while a visitor browses:
1. Programme fields the rules could not read (international tuition, IELTS, duration, intakes, entry requirement).
2. Benefits on official university pages (scholarships, fee reductions, waivers, deadlines, events).
3. Deciding which job postings on an employer's careers page fit a career.
4. Drafting each benefit's "claim it / know / prepare" checklist.

**How its output is checked.** Every value must come with a verbatim quote, and the quote is matched against the page text. Values whose quote isn't on the page are dropped and logged; a fee counts only under an international label; dates need their day and month in the quote; job titles must appear on the page as written; checklist bullets may not state a number that isn't in the quotes. Each record keeps its quote, source URL and retrieval date, so any figure can be traced.

**What AI does not do.** It doesn't estimate admission chances, rank students, or write statistics. Salaries, employment rates and rankings come unchanged from MOM, the PEI Graduate Employment Survey, national surveys and QS.

**Respecting sources.** robots.txt (for our own crawler's token and `*`) and Crawl-delay are honoured; requests are paced; no fingerprint spoofing, CAPTCHA solving or proxies; our user agent is never disguised. Since 2026-10-19 robots.txt groups addressed only to AI assistants no longer exclude a site (before then Nottingham and ANU were skipped for this). Employers whose robots.txt disallows their job search are skipped (Citi, Goldman Sachs, Accenture, Maersk). MyCareersFuture is not used (its terms bar derivative works). Skills Framework content is limited to skill titles and levels with attribution while permission from SWDA is requested; O\*NET is used under CC BY 4.0 with its required attribution; QS ranks are shown unchanged with attribution. Employer logos ("Where Kaplan graduates work"): companies only, from Wikimedia Commons (`node scripts/data/fetch-employer-logos.mjs` → `public/logos/employers/`, licence and trademark flag per file in `data/raw/employer-logos.json`), each checked by eye, shown monochrome with a trademark / no-endorsement note; Singapore government agencies and companies without a suitable file are shown by name.

**Privacy.** No accounts, cookies, analytics or tracking. Start planning answers stay in the visitor's browser (localStorage for 90 days, or session only), with a one-click clear. The Degree Enrolment Day deck is kept in a private bucket; its bank details and staff contacts were never transcribed.

**Known limits.** Coverage is partial (105 of 148 tier-1 universities so far); some fees load only after choosing "international" on a page (Sydney, UTS) and are missing; Claude's extraction varies between runs, so runs are merged and dropped values logged; every page tells visitors to check the official page before applying.

### Outcomes data notes

- SkillsFuture Singapore and Workforce Singapore merged into the Skills and Workforce Development Agency (SWDA); old `ssg.gov.sg` links redirect to `swda.gov.sg`.
- From PEI GES 2024/2025 the headline rate is "Secured Employment"; "Currently Employed" is the series comparable with earlier years' "Employed".
- The HESA (UK) site returns a Cloudflare challenge to automated requests. It is not worked around, so the UK card waits for a manual check.
- Kaplan Higher Education Academy's own rows from the PEI GES (`data/raw/employment.json`, `sg-kaplan-*`) lead the Outcomes section: 77.3% secured employment in 2024/25 against the private-degree average (78.9%) and public universities (88.9%), with a three-survey trend on the comparable "employed" series and Kaplan's response rates. Kaplan is the emphasised series; comparisons are muted and directly labelled (no fourth hue: none passed the colour-blind checks against the existing three).
