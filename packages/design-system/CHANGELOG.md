# @repo/design-system

## 1.1.0

### Minor Changes

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

### Patch Changes

- [#668](https://github.com/nakafaai/nakafa.com/pull/668) [`bb9a7f8`](https://github.com/nakafaai/nakafa.com/commit/bb9a7f845e47eec2ab3bf8b1153a1baea5b86cc5) Thanks [@nabilfatih](https://github.com/nabilfatih)! - Give the math lab number fields one border. The steppers in the unit circle,
  right triangle, and function machine labs let the group own the shared border
  and draw only their inner dividers, so the decrement and increment buttons stop
  painting a second border that crossed the group's corner radius.
- Updated dependencies [[`7b066d6`](https://github.com/nakafaai/nakafa.com/commit/7b066d6be9f01dd87a0680c11a4235ef0423c632)]:
  - @repo/analytics@0.1.2

## 1.0.1

### Patch Changes

- Updated dependencies [[`aa96d01`](https://github.com/nakafaai/nakafa.com/commit/aa96d01b64e07adefef78fd7ad1bf7a3ec560777), [`09b9e89`](https://github.com/nakafaai/nakafa.com/commit/09b9e891f869f0226f04613fb437471514a777a3)]:
  - @repo/analytics@0.1.1

## 1.0.0

### Major Changes

- [`c6b51e6`](https://github.com/nakafaai/nakafa.com/commit/c6b51e60d3dd96fd3d148035d19f3c2304145ab7) Thanks [@nabilfatih](https://github.com/nabilfatih)! - Migrate contents to use effect, adding extensive testing, adding cache for building contents, improving performance and type safety

### Minor Changes

- [`e746ef6`](https://github.com/nakafaai/nakafa.com/commit/e746ef6441de79a219289eafef653492b6172685) Thanks [@nabilfatih](https://github.com/nabilfatih)! - Migrate lucide react to hugeicons

- [`e9c4947`](https://github.com/nakafaai/nakafa.com/commit/e9c4947c95d674cb42a21c34544c0939d1bd804d) Thanks [@nabilfatih](https://github.com/nabilfatih)! - add email package with welcome template and components

- [`8743029`](https://github.com/nakafaai/nakafa.com/commit/87430293f82dd666543ea9722289ed68d318aefa) Thanks [@nabilfatih](https://github.com/nabilfatih)! - New set of try out snbt, use semantic html, fix tailwind css lint

- [`aa179b9`](https://github.com/nakafaai/nakafa.com/commit/aa179b9e3a196cc6117d997246a150e1561b7442) Thanks [@nabilfatih](https://github.com/nabilfatih)! - Add exercise tracking, get results, timer

### Patch Changes

- Updated dependencies [[`c6b51e6`](https://github.com/nakafaai/nakafa.com/commit/c6b51e60d3dd96fd3d148035d19f3c2304145ab7), [`e746ef6`](https://github.com/nakafaai/nakafa.com/commit/e746ef6441de79a219289eafef653492b6172685), [`e9c4947`](https://github.com/nakafaai/nakafa.com/commit/e9c4947c95d674cb42a21c34544c0939d1bd804d), [`aa179b9`](https://github.com/nakafaai/nakafa.com/commit/aa179b9e3a196cc6117d997246a150e1561b7442)]:
  - @repo/internationalization@1.0.0
  - @repo/analytics@0.1.0

## 0.3.0

### Minor Changes

- [`1832a10`](https://github.com/nakafaai/nakafa.com/commit/1832a10d49ebcaa5b88e5fa96a71974e80915b1b) Thanks [@nabilfatih](https://github.com/nabilfatih)! - New try out exercise snbt, imporving DX, bump version, fix some styling, and trae rules

### Patch Changes

- Updated dependencies [[`1832a10`](https://github.com/nakafaai/nakafa.com/commit/1832a10d49ebcaa5b88e5fa96a71974e80915b1b)]:
  - @repo/internationalization@0.3.0

## 0.2.0

### Minor Changes

- [`c50d754`](https://github.com/nakafaai/nakafa.com/commit/c50d75406a756286ee038066c541752c8d9d10c5) Thanks [@nabilfatih](https://github.com/nabilfatih)! - Migrate to use interface instead of type

### Patch Changes

- Updated dependencies [[`c50d754`](https://github.com/nakafaai/nakafa.com/commit/c50d75406a756286ee038066c541752c8d9d10c5)]:
  - @repo/internationalization@0.2.0

## 0.1.0

### Minor Changes

- [`f44d967`](https://github.com/nakafaai/nakafa.com/commit/f44d9675518b9d81302382ab8e51a4c44d5f5dc1) Thanks [@nabilfatih](https://github.com/nabilfatih)! - Upgrade nextjs 16.1, update polar sdk to latest, introducing class materials features, adding schema to class and implementation to add materials

### Patch Changes

- Updated dependencies [[`f44d967`](https://github.com/nakafaai/nakafa.com/commit/f44d9675518b9d81302382ab8e51a4c44d5f5dc1)]:
  - @repo/internationalization@0.1.0

## 0.0.3

### Patch Changes

- [`ddb5d7b`](https://github.com/nakafaai/nakafa.com/commit/ddb5d7bb1d92e9b2463bf5171ea75331311c6989) Thanks [@nabilfatih](https://github.com/nabilfatih)! - Exclude changeset

- Updated dependencies [[`ddb5d7b`](https://github.com/nakafaai/nakafa.com/commit/ddb5d7bb1d92e9b2463bf5171ea75331311c6989)]:
  - @repo/internationalization@0.0.3

## 0.0.2

### Patch Changes

- [`2d694d8`](https://github.com/nakafaai/nakafa.com/commit/2d694d81af7285defab038f2518f2f5279dfafab) Thanks [@nabilfatih](https://github.com/nabilfatih)! - Avoid vercel build for changeset merge

- [`03373ce`](https://github.com/nakafaai/nakafa.com/commit/03373ceada6429e75e94a81b2d655f6e20f999f2) Thanks [@nabilfatih](https://github.com/nabilfatih)! - Update release workflow

- Updated dependencies [[`2d694d8`](https://github.com/nakafaai/nakafa.com/commit/2d694d81af7285defab038f2518f2f5279dfafab), [`03373ce`](https://github.com/nakafaai/nakafa.com/commit/03373ceada6429e75e94a81b2d655f6e20f999f2)]:
  - @repo/internationalization@0.0.2

## 0.0.1

### Patch Changes

- 3a66784: Implement changeset to nakafa monorepo
- Updated dependencies [3a66784]
  - @repo/internationalization@0.0.1
