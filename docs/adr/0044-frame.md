# ADR 0044: One Page Frame Owns Header, Body, Footer And The Right Edge

## Status

Accepted on 9 November 2026.

## Context

The owner's layout rule is one sentence: every page reads header, body and an optional footer, a pane opens at the right edge of the screen and never inside the body, the body is never wider than the header, and try-out, exam sitting, School and consumer pages share one experience. The code decided each part of that sentence per page family. Measured on main `c056dfb99b`, `apps/www/src/components/shared` held:

| Part | Modules |
| --- | --- |
| Width | `content/width.ts` (the one width source), `content/frame.tsx` (`PageFrame`, `LayoutContent`) |
| Page box | `material/frame.tsx` (`LayoutMaterial`, a flex `div`), `material/content.tsx` (`LayoutMaterialContent`) |
| Header row | `breadcrumb/frame.tsx` (`BreadcrumbHeaderFrame`), the row of `tenant/header.tsx` (`SchoolHeader`, a second sticky row with its own trigger), and `content/header.tsx` (`HeaderContent`, a title that called itself a header) |
| Body | `LayoutContent`, `table/frame.tsx` (`TablePageBody`) |
| Footer | `content/footer.tsx` (`FooterContent`) |
| Right edge | `panes.tsx` with `panes/side.tsx` (a fixed pane that narrows `main`), and `outline/panel.tsx` (a right sidebar that pads its own provider) |
| Failure | `failure.tsx` (`DataFailure`) and `state/failure.tsx` (`LoadFailure`) |

Every route composed four to six of these by hand (`LayoutMaterial > SidebarRightProvider > LayoutMaterialContent > header, LayoutContent, FooterContent`), School pages composed a different four, and the player, the try-out shell, the Quran and Nina each passed their own `contentClassName` into the shared row. The defects the owner kept finding, a body wider than its header and a pane inside the body, came from those seams.

Three interfaces were designed in parallel (design it twice): the smallest surface (one `Page` family and one hook), the most flexible (slots that wrap the existing modules), and the most common caller first (measured: 39 list bodies, 13 content routes, 6 list-and-pane pages, one canvas). The flexible design kept every module and added a layer, so it failed the deletion test. The smallest design hid the header's zones behind a tuple prop and needed a boolean-free way to say "canvas". The common-caller design named the rare shapes as explicit parts. This record takes the common-caller shape with the smallest design's root.

## Decision

D1. `apps/www/src/components/shared/page/` owns the frame of every page of the app and of School. A route fills slots and decides nothing about layout: no width, gutter, sticky offset or pane position is written outside this folder.

| Slot | Part | Replaces |
| --- | --- | --- |
| Root | `Page` (`width`: `page`, the default, up to 7xl, or `column`, 3xl) | `PageFrame`, `LayoutMaterial`, `LayoutMaterialContent` |
| Header | `PageHeader`, with `PageActions` (the end zone), `PageCenter` (a centred zone, the player's timer) and `PageHeaderLabel` | `BreadcrumbHeaderFrame`, the row of `SchoolHeader`, every `contentClassName` |
| Body | `PageBody` (flow), `PageList` (one full-height card), `PageCanvas` (edge to edge, the exam editor) | `LayoutContent`, `TablePageBody` |
| Footer | `PageFooter`, with `rule` for the line under a lesson | `FooterContent` |
| Right edge | `PagePane` (a detail opened by a press), `PageOutline` (the reading outline) | `PanesDetail`, `SidebarRightPanel` |

D2. The width has one source, `page/width.ts`. `Page` sets `--page-width` once, and the header row, the tab row, the body and the footer read it through `pageRowVariants`, so the body cannot be wider than the header. `scripts/check/frame.ts` rejects a page width written by hand anywhere else.

D3. `PageHeader` is the one header row: sticky, one control high from the first paint, the phone's sidebar trigger first (through `SidebarScopeStart`, which both shells now provide), a heading for assistive technology from `title`, then the page's path, an optional centre and the actions. The row lays itself out from what it holds: a path and actions share a flex row; a `PageCenter` turns it into three equal zones so the centre stays centred. Domain paths stay with their domains (`BreadcrumbHeaderPath` for the public app, `SchoolPath` for a school), and each compose `PageHeader`.

D4. Everything at the right edge stands from the window's top to its bottom, and `main` narrows beside it by `--pane-width`, so header, body and footer narrow together and stay one frame. A pane is never a child of the body's box. Below its breakpoint a pane is a bottom sheet. A detail pane exists only while something is open; only the exam editor's teacher panel and the finished try-out's panel are always on.

D5. A failed read has one module, `state/failure.tsx`: `LoadFailure` where nothing is on screen yet, `DataFailure` beside content that stays.

D6. Delivery is one stack with no compatibility path. The first change lands the root, header, body, footer, width and failure and migrates every route to them, deleting the modules they replace. The second moves the right edge (`panes.tsx`, `panes/*`, `pane.tsx`, `outline/panel.tsx`) into the folder, where the detail is `PagePane` and the reading outline `PageOutline`, both at the right edge from the window's top to its bottom with the page narrowed beside them. A forum thread already opens at the right edge. The exam editor stays the one canvas, edge to edge with its own header and toolbar as a design tool's canvas is (`data-canvas`), so its teacher panel stays a column of that canvas.

D7. `e2e/support/frame.ts` measures the rule from what is drawn: header and body edges at 320 to 1920 px, and every right-edge surface flush with the window's right, top and bottom, with the header ending where the pane begins, at 390 px and on a desktop.

D8. A reading page, a lesson or an article, names itself once, in the title block that opens its body (`ContentTitle` in `components/content/title.tsx`: one visible `h1`, then the byline). Its header (`ContentHeader`) holds the path to its parent and the reading controls and draws no heading, so the path ends at the parent: Home, Articles, Politics over an article; Home, the curriculum down to the card over a lesson, or Home alone when it was opened from no curriculum. A list (`BreadcrumbHeader`) keeps its path ending at itself with a heading for assistive technology, because its body is the list. The Quran is the one exception, by the owner's word: a surah names itself in its header (`QuranSurahHeader`, Home, Quran, the surah), and its verses start under it. The owner rejected the article header that put its title only in the path (9 November): a reader compares an article with a lesson and sees two designs. `e2e/content/titles.browser.ts` refuses a lesson or an article whose path names it or whose title is not seen under its header, at 390 and 1440 px, and names the surah as its exception with its own test.

## Consequences

Positive: a page is a few lines of slots; the width rule and the pane rule each live in one module; try-out, the player, School and the reading pages draw the same header row; about a dozen modules go.

Negative: every route changes once, in the same stack, so open pull requests that touch these files merge `main` and rename. A page still chooses between two widths; that is the one layout decision left to a route, because it says what the page is (a reading column or a working surface).
