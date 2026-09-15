# www

## 2.0.5

### Patch Changes

- [#662](https://github.com/nakafaai/nakafa.com/pull/662) [`7b066d6`](https://github.com/nakafaai/nakafa.com/commit/7b066d6be9f01dd87a0680c11a4235ef0423c632) Thanks [@nabilfatih](https://github.com/nabilfatih)! - Classify the traffic behind server exceptions. Server captures carried no user agent, so PostHog filed every one under automated traffic and hid real visitor faults during triage. `captureServerException` now accepts the requesting user agent and sends it as `$raw_user_agent`. The request-scoped capture seam reads the user agent once through `next/headers`, so every route handler, metadata, and scheduled capture classifies without extra plumbing; the Next.js request-error hook and the chat stream error reporter pass the user agent from their own request headers. The redacted exception payload stays unchanged.

- [#657](https://github.com/nakafaai/nakafa.com/pull/657) [`2ba4e84`](https://github.com/nakafaai/nakafa.com/commit/2ba4e84a7c557f22be317f95dddbde66bc4eed2a) Thanks [@nabilfatih](https://github.com/nabilfatih)! - Render the product in Inter and give every rendered content heading a scannable
  section rule. Inter replaces Geist Sans as the interface and reading face, the
  serif reading title becomes Inter, the lesson and article title and summary move
  to the start of the reading column at the larger display size, and lesson pages
  drop the summary under the title while articles keep theirs.
  
  Markdown and MDX headings render their words in the theme `primary` accent and
  draw the underline in the theme's validated chart mark, at Tailwind's own
  `decoration-2` and `underline-offset-4` values. A new `heading-rule` color role
  owns that pairing, so the words and the rule never repeat one color and the rule
  stays at least 3:1 against the page in all 31 concrete themes.

- [#652](https://github.com/nakafaai/nakafa.com/pull/652) [`25393e7`](https://github.com/nakafaai/nakafa.com/commit/25393e7a8a4257ddde8b4c12aef11de67b0eaa97) Thanks [@nabilfatih](https://github.com/nabilfatih)! - Resolve social images without rendering the application shell. Open Graph routes read release metadata through a render-free seam and answer unknown slugs with translated brand artwork, so crawler traffic no longer throws client-manifest errors. Lesson and article pages keep their exact readers and failure behavior.
- Updated dependencies [[`7b066d6`](https://github.com/nakafaai/nakafa.com/commit/7b066d6be9f01dd87a0680c11a4235ef0423c632), [`2ba4e84`](https://github.com/nakafaai/nakafa.com/commit/2ba4e84a7c557f22be317f95dddbde66bc4eed2a), [`bb9a7f8`](https://github.com/nakafaai/nakafa.com/commit/bb9a7f845e47eec2ab3bf8b1153a1baea5b86cc5)]:
  - @repo/analytics@0.1.2
  - @repo/design-system@1.1.0
  - @repo/backend@3.0.2
  - @repo/contents@2.0.2
  - @repo/ai@2.0.4

## 2.0.4

### Patch Changes

- [#640](https://github.com/nakafaai/nakafa.com/pull/640) [`daa73ac`](https://github.com/nakafaai/nakafa.com/commit/daa73ace9e482b79e0a472ee58098f27b8e6c273) Thanks [@nabilfatih](https://github.com/nabilfatih)! - Replace forced content cache deletion with stale-while-revalidate invalidation. A publication now marks the changed scope and the sitemap stale instead of deleting them, so a publish no longer becomes a blocking cache miss. Cached SEO metadata carries the family tag that invalidates it, which it previously lacked, and the content profile no longer force-expires every entry once a day, so an entry refreshes in the background after its revalidation interval instead of being regenerated in the foreground. The content freshness policy and the Next cache profile now live in one module.

## 2.0.3

### Patch Changes

- [#617](https://github.com/nakafaai/nakafa.com/pull/617) [`09b9e89`](https://github.com/nakafaai/nakafa.com/commit/09b9e891f869f0226f04613fb437471514a777a3) Thanks [@nabilfatih](https://github.com/nabilfatih)! - Deepen the browser analytics gate into a single transition table with SDK-derived types and explicit pageviews. The gate module owns baseline, grant admission, and baseline revocation atomically, so callers can never opt in without authorizing identity. The hand-written PostHog client mirror is replaced with types picked from the installed SDK, and automatic pageviews give way to explicit initial-plus-history capture: each view lands exactly once, after identity is known, with no duplicate on consent transitions. Undecided, declined, and DNT visitors stay counted through cookieless baseline capture with minimized URLs.
- Updated dependencies [[`aa96d01`](https://github.com/nakafaai/nakafa.com/commit/aa96d01b64e07adefef78fd7ad1bf7a3ec560777), [`09b9e89`](https://github.com/nakafaai/nakafa.com/commit/09b9e891f869f0226f04613fb437471514a777a3)]:
  - @repo/analytics@0.1.1
  - @repo/backend@3.0.1
  - @repo/design-system@1.0.1
  - @repo/contents@2.0.1
  - @repo/ai@2.0.3

## 2.0.2

### Patch Changes

- [#521](https://github.com/nakafaai/nakafa.com/pull/521) [`2a13e73`](https://github.com/nakafaai/nakafa.com/commit/2a13e73d0beabc62176300bfd918e2d4d1e15143) Thanks [@nabilfatih](https://github.com/nabilfatih)! - Replace the API and MCP Next.js proxy applications with frameworkless Vercel routing into the Convex-owned runtimes. Remove the orphaned private API and website MCP proxy surfaces, publish one canonical MCP endpoint, and rename the Aksara publication credential to match its owner.
- Updated dependencies [[`2a13e73`](https://github.com/nakafaai/nakafa.com/commit/2a13e73d0beabc62176300bfd918e2d4d1e15143)]:
  - @repo/backend@3.0.0
  - @repo/contents@2.0.0
  - @repo/next-config@2.0.0
  - @repo/ai@2.0.2
  - @repo/seo@1.0.1

## 2.0.1

### Patch Changes

- Updated dependencies []:
  - @repo/ai@2.0.1
  - @repo/contents@1.0.1
  - @repo/backend@2.0.1

## 2.0.0

### Major Changes

- [`c6b51e6`](https://github.com/nakafaai/nakafa.com/commit/c6b51e60d3dd96fd3d148035d19f3c2304145ab7) Thanks [@nabilfatih](https://github.com/nabilfatih)! - Migrate contents to use effect, adding extensive testing, adding cache for building contents, improving performance and type safety

### Minor Changes

- [`727a480`](https://github.com/nakafaai/nakafa.com/commit/727a480db92a0f95be982ce3a10b5b86e38b2b30) Thanks [@nabilfatih](https://github.com/nabilfatih)! - Add sticky and remove backdrop

- [`058989c`](https://github.com/nakafaai/nakafa.com/commit/058989cb329c018b58a3f1e15ba71d8433db0d9f) Thanks [@nabilfatih](https://github.com/nabilfatih)! - remove node options

- [`e9c4947`](https://github.com/nakafaai/nakafa.com/commit/e9c4947c95d674cb42a21c34544c0939d1bd804d) Thanks [@nabilfatih](https://github.com/nabilfatih)! - add email package with welcome template and components

- [`8743029`](https://github.com/nakafaai/nakafa.com/commit/87430293f82dd666543ea9722289ed68d318aefa) Thanks [@nabilfatih](https://github.com/nabilfatih)! - New set of try out snbt, use semantic html, fix tailwind css lint

- [`aa179b9`](https://github.com/nakafaai/nakafa.com/commit/aa179b9e3a196cc6117d997246a150e1561b7442) Thanks [@nabilfatih](https://github.com/nabilfatih)! - Add exercise tracking, get results, timer

- [`e6778d2`](https://github.com/nakafaai/nakafa.com/commit/e6778d2db6a60557ae222b2e1b975002339577e4) Thanks [@nabilfatih](https://github.com/nabilfatih)! - Add unit testing for utils functions, proper testing coverage, bump version, add new try out for snbt

### Patch Changes

- [`e746ef6`](https://github.com/nakafaai/nakafa.com/commit/e746ef6441de79a219289eafef653492b6172685) Thanks [@nabilfatih](https://github.com/nabilfatih)! - Migrate lucide react to hugeicons

- Updated dependencies [[`c6b51e6`](https://github.com/nakafaai/nakafa.com/commit/c6b51e60d3dd96fd3d148035d19f3c2304145ab7), [`e746ef6`](https://github.com/nakafaai/nakafa.com/commit/e746ef6441de79a219289eafef653492b6172685), [`e9c4947`](https://github.com/nakafaai/nakafa.com/commit/e9c4947c95d674cb42a21c34544c0939d1bd804d), [`8743029`](https://github.com/nakafaai/nakafa.com/commit/87430293f82dd666543ea9722289ed68d318aefa), [`aa179b9`](https://github.com/nakafaai/nakafa.com/commit/aa179b9e3a196cc6117d997246a150e1561b7442), [`e6778d2`](https://github.com/nakafaai/nakafa.com/commit/e6778d2db6a60557ae222b2e1b975002339577e4)]:
  - @repo/internationalization@1.0.0
  - @repo/design-system@1.0.0
  - @repo/next-config@1.0.0
  - @repo/contents@1.0.0
  - @repo/backend@2.0.0
  - @repo/seo@1.0.0
  - @repo/ai@2.0.0
  - @repo/analytics@0.1.0
  - @repo/utilities@0.2.0

## 1.3.0

### Minor Changes

- [`1832a10`](https://github.com/nakafaai/nakafa.com/commit/1832a10d49ebcaa5b88e5fa96a71974e80915b1b) Thanks [@nabilfatih](https://github.com/nabilfatih)! - New try out exercise snbt, imporving DX, bump version, fix some styling, and trae rules

### Patch Changes

- Updated dependencies [[`1832a10`](https://github.com/nakafaai/nakafa.com/commit/1832a10d49ebcaa5b88e5fa96a71974e80915b1b)]:
  - @repo/internationalization@0.3.0
  - @repo/design-system@0.3.0
  - @repo/next-config@0.2.0
  - @repo/contents@0.2.0
  - @repo/backend@1.3.0
  - @repo/seo@0.3.0
  - @repo/ai@1.2.0

## 1.2.0

### Minor Changes

- [`c50d754`](https://github.com/nakafaai/nakafa.com/commit/c50d75406a756286ee038066c541752c8d9d10c5) Thanks [@nabilfatih](https://github.com/nabilfatih)! - Migrate to use interface instead of type

- [`c50d754`](https://github.com/nakafaai/nakafa.com/commit/c50d75406a756286ee038066c541752c8d9d10c5) Thanks [@nabilfatih](https://github.com/nabilfatih)! - Implement materials group, create, edit, move up and down, and delete

### Patch Changes

- Updated dependencies [[`c50d754`](https://github.com/nakafaai/nakafa.com/commit/c50d75406a756286ee038066c541752c8d9d10c5), [`c50d754`](https://github.com/nakafaai/nakafa.com/commit/c50d75406a756286ee038066c541752c8d9d10c5)]:
  - @repo/internationalization@0.2.0
  - @repo/design-system@0.2.0
  - @repo/utilities@0.1.0
  - @repo/contents@0.1.0
  - @repo/security@0.1.0
  - @repo/backend@1.2.0
  - @repo/seo@0.2.0
  - @repo/ai@1.1.0

## 1.1.0

### Minor Changes

- [`f44d967`](https://github.com/nakafaai/nakafa.com/commit/f44d9675518b9d81302382ab8e51a4c44d5f5dc1) Thanks [@nabilfatih](https://github.com/nabilfatih)! - Upgrade nextjs 16.1, update polar sdk to latest, introducing class materials features, adding schema to class and implementation to add materials

- [`f44d967`](https://github.com/nakafaai/nakafa.com/commit/f44d9675518b9d81302382ab8e51a4c44d5f5dc1) Thanks [@nabilfatih](https://github.com/nabilfatih)! - Updating polar sdk to use standalone function instead using whole sdk to fix convex ran out of memory

- [`8466034`](https://github.com/nakafaai/nakafa.com/commit/84660348bf5dcfcf048db3f57d47a05cc18cd868) Thanks [@nabilfatih](https://github.com/nabilfatih)! - Convex now support betterAuth 1.4, all migrate to that

- [`03c0655`](https://github.com/nakafaai/nakafa.com/commit/03c0655ad44cc34d85855d431d754fc52cd474e3) Thanks [@nabilfatih](https://github.com/nabilfatih)! - Adjust the convex functions for betterAuth components to have their own queries.ts and mutations.ts

### Patch Changes

- Updated dependencies [[`f44d967`](https://github.com/nakafaai/nakafa.com/commit/f44d9675518b9d81302382ab8e51a4c44d5f5dc1), [`f44d967`](https://github.com/nakafaai/nakafa.com/commit/f44d9675518b9d81302382ab8e51a4c44d5f5dc1), [`8466034`](https://github.com/nakafaai/nakafa.com/commit/84660348bf5dcfcf048db3f57d47a05cc18cd868), [`03c0655`](https://github.com/nakafaai/nakafa.com/commit/03c0655ad44cc34d85855d431d754fc52cd474e3), [`e0fb41c`](https://github.com/nakafaai/nakafa.com/commit/e0fb41c54d67b4e09193ba6c7b843b20b8a8ed8b)]:
  - @repo/internationalization@0.1.0
  - @repo/design-system@0.1.0
  - @repo/next-config@0.1.0
  - @repo/backend@1.1.0
  - @repo/seo@0.1.0

## 1.0.0

### Major Changes

- [`9ad9ff7`](https://github.com/nakafaai/nakafa.com/commit/9ad9ff78d7ca1feb73117dd5f7e78bdcee435592) Thanks [@nabilfatih](https://github.com/nabilfatih)! - Removing datasets features, it was experimental features, probably will create a whole new products still under PT. Nakafa Tekno Kreatif

### Patch Changes

- Updated dependencies [[`9ad9ff7`](https://github.com/nakafaai/nakafa.com/commit/9ad9ff78d7ca1feb73117dd5f7e78bdcee435592), [`9ad9ff7`](https://github.com/nakafaai/nakafa.com/commit/9ad9ff78d7ca1feb73117dd5f7e78bdcee435592)]:
  - @repo/backend@1.0.0
  - @repo/ai@1.0.0

## 0.0.1

### Patch Changes

- [`566441b`](https://github.com/nakafaai/nakafa.com/commit/566441bdb1aa1c2df7607bb89adc3c81abed5330) Thanks [@nabilfatih](https://github.com/nabilfatih)! - Add versioning
