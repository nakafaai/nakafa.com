# Anti-Patterns: AI Document Quality

Common failures when AI generates professional documents. Organized by failure type, each with a bad example and the fix. Use alongside `writing.md` quality bars.

## Content Emptiness

| # | Pattern | Bad | Fix |
|---|---------|-----|-----|
| 1 | Adjective pile-up, no numbers | "Achieved significant growth across key metrics" | State the number: "Revenue grew 34% YoY to $12M" |
| 2 | Opening-paragraph filler | "In today's rapidly evolving landscape..." | Delete the opener. Start with the first real claim. |
| 3 | Restating the heading as a sentence | Heading "Revenue Growth", body "Our revenue growth has been notable" | Body must add information the heading does not carry |
| 4 | Vague time references | "Recently launched", "in the near future" | Pin to a date or quarter: "Launched Q1 2026" |
| 5 | Synonyms masking repetition | Three paragraphs saying "we are growing" in different words | One claim, one proof, move on |

## Metric Fabrication

| # | Pattern | Bad | Fix |
|---|---------|-----|-----|
| 6 | Round numbers implying precision | "Exactly 10,000 users" when the source says "around 10K" | Match the source's precision: "approximately 10,000" |
| 7 | Fake decimal precision | "Market share: 23.7%" with no cited source | Either cite the source or round to "roughly 24%" |
| 8 | Metric-narrative disconnect | Chart shows flat revenue, text says "strong momentum" | Text must match what the chart shows |
| 9 | Invented comparison baselines | "3x faster than alternatives" with no benchmark | Name the alternative and the benchmark method, or remove |
| 10 | Mixing time periods | YoY growth next to QoQ growth as if comparable | Label every comparison window explicitly |

## Structure Mimicry

| # | Pattern | Bad | Fix |
|---|---------|-----|-----|
| 11 | Resume bullet without result | "Managed a cross-functional team" | Action + Scope + Result: "Led 8-person team to ship v2.0, reducing churn 15%" |
| 12 | Template slots filled with filler | Skills section listing "Communication, Teamwork, Problem-solving" | Name the specific skill and where it was applied, or cut the section |
| 13 | Equity report without variant perception | "Company is well-positioned for growth" | State what the market gets wrong and why your thesis differs |
| 14 | One-pager without a clear ask | Three sections of context, no "what we need from you" | The ask belongs above the fold, not implied |
| 15 | Slide title as label, not assertion | "Q3 Results" | Assertion-evidence: "Q3 revenue beat guidance by 12%" |

## Visual Excess

| # | Pattern | Bad | Fix |
|---|---------|-----|-----|
| 16 | More than 3 brand-color accents per page | Four different colored highlights on the same page | One accent color for emphasis; use weight or size for hierarchy |
| 17 | Chart with no insight title | Chart titled "Revenue by Quarter" | Title states the insight: "Revenue accelerated after Q2 price change" |
| 18 | Decorative chart that restates the text | Bar chart showing the same three numbers the paragraph just listed | If the text already communicates it, the chart must add a dimension (comparison, trend, distribution) |
| 19 | Icon or emoji as section marker | Sections led by decorative icons with no semantic value | Use typographic hierarchy (size, weight, spacing) instead |

## Source Gaps

| # | Pattern | Bad | Fix |
|---|---------|-----|-----|
| 20 | Unverified version numbers | "Compatible with v4.2" when latest is v5.1 | Check the official source before citing any version |
| 21 | "Latest" without a date | "Uses the latest framework" | "Uses Next.js 15 (as of 2026-04)" |
| 22 | Competitor comparison without market data | "Leading solution in the market" | Cite the ranking source, or use "one of the established solutions" |
| 23 | Assumed availability | "Available on all major platforms" | List the actual platforms verified |

## Tone Contamination

| # | Pattern | Bad | Fix |
|---|---------|-----|-----|
| 24 | Chinese AI corporate speak | "赋能企业数字化转型", "打造一站式解决方案" | Say what it does: "帮公司把纸质流程搬到线上" |
| 25 | English AI corporate speak | "Leverage our platform to unlock synergies" | "Use the platform to share data between teams" |
| 26 | Caption restates the flow diagram | "六类来源 → 六道过滤 → 配比设计 → 训练分片，四步串联" | Cap 给出图意以外的判断："来源决定知识边界，过滤决定干净程度，配比决定能力侧重" |
| 27 | AI tone cliches (CN dashes and connectors) | "本质上是模型在做预测——这意味着..." / 大量破折号 | 删元评论框架，直接说结论。破折号换冒号或句号。自检: `grep -nE '本质是\|这意味着\|值得注意的是\|不仅.*而且\|[——–]'` |
| 28 | Sans font stack missing CJK fallback | `font-family: Inter` 用在含中文的 th / h3 | CJK 回退到系统 sans (PingFang) 跟 serif 主调冲突。任何可能渲染 CJK 的元素用 `var(--serif)` |
| 29 | Caption restates the slide title | Title: "ORM vs PRM 对比" / Cap: "ORM 跟 PRM 的对比" | Cap 必须给出标题之外的信息：取舍判据、适用场景、或讲到这里要带出的下一步。同义重写浪费了 cap 的注意力位 |

## Landing Page

The main `landing-page.html` template does not ship a price card or language switcher by default. Rules #30 and #31 below apply when you add either component (Kami's own `styles.css` L67-151 has a working `.lang-switch` reference).

| # | Pattern | Bad | Fix |
|---|---------|-----|-----|
| 30 | Currency glyph shrunk and raised | `.price-currency { font-size: 0.5em; vertical-align: super }` floats `$` above the digit and breaks baseline | `font-size: 0.74em; line-height: 1; transform: translateY(0.015em)` keeps `$` and the digit on a shared baseline |
| 31 | Language menu clips descenders | `.lang-menu a { line-height: 1 }` cuts the bottom of 'g' / 'y' / 'p' | `min-height: 32px; padding: 6px 10px; line-height: 1.35` plus an invisible `::before` bridge so the cursor can travel from trigger to menu without dismissal |
| 32 | Sitemap lists locales without hreflang | `<url><loc>example.com/zh/</loc></url>` standing alone | Add `<xhtml:link rel="alternate" hreflang>` for every shipped locale plus `hreflang="x-default"` inside the same `<url>` entry |
| 33 | Mixed CJK and Latin digits drift on baseline | `Mac/22/$19` shows digits at different heights because the serif falls back to oldstyle nums | `font-variant-numeric: lining-nums tabular-nums` on every node that displays numbers |
| 34 | Hardcoded business data in the template | `<meta name="description" content="Acme is a $9 cleaner">` checked into the template file | Keep `{{PLACEHOLDER}}` slots so the user fills them at copy time. Templates ship with no real product data |
| 35 | Multilingual site without `og:locale:alternate` | Single `og:locale` and no alternates listed | Self-reference the current page locale and list the others on `og:locale:alternate` so social previews pick the right thumbnail per region |
| 36 | Stale product category | Hero still uses an old single-tool label after the product became a broader utility | Rewrite title, meta, hero, FAQ, JSON-LD, `llms.txt`, and `llms-full.txt` around the current category before adding feature bullets |
| 37 | Generated locale pages without drift check | `template.html` and `i18n/*.json` generate committed pages, but no `--check` catches stale output | Add a check mode that fails on missing keys and generated-output drift before release or package work |
| 38 | FAQ and `llms-full.txt` diverge | FAQ says one install path or price, AI-facing docs say another | Treat FAQ, JSON-LD, `llms.txt`, and `llms-full.txt` as one public fact set and update them together |
| 39 | Screenshot gallery uses private local assets | `<img src="/Users/me/project/shot.png">` or `../other-repo/shots/app.webp` | Copy the image into the site repo or use a stable public URL; packaged templates must not depend on sibling checkouts |
| 40 | Locale copy updated in only one place | One locale changes price, version, or install path while other locale pages still show the old facts | Search all locale pages plus structured data for the old value and update every matching surface |

## Image Slots

| # | Pattern | Bad | Fix |
|---|---------|-----|-----|
| 41 | Image generated before slot | A polished 16:9 concept image is forced into a 3:2 feature panel and loses its focal point | Decide the slot first, then crop, pad, or generate to that ratio |
| 42 | Real screenshot redrawn as fake UI | A product screenshot is AI-redesigned and no longer matches the shipped app | Preserve real screenshots; use programmatic padding or split panels before redrawing |
| 43 | Mixed screenshot ratios in one group | Three gallery panels jump between tall, wide, and square crops | Normalize the frame and padding; keep the screenshot content intact inside it |
| 44 | Missing product image filled with atmosphere | A product page uses abstract texture because no screenshot was provided | Mark the material gap or omit the panel; do not substitute unrelated imagery |

## Slides

| # | Pattern | Bad | Fix |
|---|---------|-----|-----|
| 45 | Ghost deck fails | Reading only slide titles produces a pile of topics, not an argument | Rewrite titles and order before touching layout |
| 46 | Multiple evidence shapes on one slide | One slide contains a chart, screenshot, code block, and quote | Pick the primary proof, then split the rest into adjacent slides or appendix |
| 47 | Visual brief leaks into audience copy | Caption says "21:9 ultra-wide screenshot with quiet background" | Keep image prompts and crop notes in the slot map; captions state the insight |
| 48 | Template inventory without a template | Default Kami deck gets a fake layout-mapping phase | Only inventory a real user-provided PPTX or brand template |
