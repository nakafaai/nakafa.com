# @repo/backend

## 1.2.0

### Minor Changes

- [`c50d754`](https://github.com/nakafaai/nakafa.com/commit/c50d75406a756286ee038066c541752c8d9d10c5) Thanks [@nabilfatih](https://github.com/nabilfatih)! - Migrate to use interface instead of type

- [`c50d754`](https://github.com/nakafaai/nakafa.com/commit/c50d75406a756286ee038066c541752c8d9d10c5) Thanks [@nabilfatih](https://github.com/nabilfatih)! - Implement materials group, create, edit, move up and down, and delete

### Patch Changes

- Updated dependencies [[`c50d754`](https://github.com/nakafaai/nakafa.com/commit/c50d75406a756286ee038066c541752c8d9d10c5)]:
  - @repo/ai@1.1.0

## 1.1.0

### Minor Changes

- [`f44d967`](https://github.com/nakafaai/nakafa.com/commit/f44d9675518b9d81302382ab8e51a4c44d5f5dc1) Thanks [@nabilfatih](https://github.com/nabilfatih)! - Upgrade nextjs 16.1, update polar sdk to latest, introducing class materials features, adding schema to class and implementation to add materials

- [`f44d967`](https://github.com/nakafaai/nakafa.com/commit/f44d9675518b9d81302382ab8e51a4c44d5f5dc1) Thanks [@nabilfatih](https://github.com/nabilfatih)! - Updating polar sdk to use standalone function instead using whole sdk to fix convex ran out of memory

- [`8466034`](https://github.com/nakafaai/nakafa.com/commit/84660348bf5dcfcf048db3f57d47a05cc18cd868) Thanks [@nabilfatih](https://github.com/nabilfatih)! - Convex now support betterAuth 1.4, all migrate to that

- [`03c0655`](https://github.com/nakafaai/nakafa.com/commit/03c0655ad44cc34d85855d431d754fc52cd474e3) Thanks [@nabilfatih](https://github.com/nabilfatih)! - Adjust the convex functions for betterAuth components to have their own queries.ts and mutations.ts

- [`e0fb41c`](https://github.com/nakafaai/nakafa.com/commit/e0fb41c54d67b4e09193ba6c7b843b20b8a8ed8b) Thanks [@nabilfatih](https://github.com/nabilfatih)! - Implement validation without validate session for checking auth, resulting improvement on performance, query from 1s down to 200ms. mutation still use validation session tho to make it more secure

## 1.0.0

### Major Changes

- [`9ad9ff7`](https://github.com/nakafaai/nakafa.com/commit/9ad9ff78d7ca1feb73117dd5f7e78bdcee435592) Thanks [@nabilfatih](https://github.com/nabilfatih)! - Removing datasets features, it was experimental features, probably will create a whole new products still under PT. Nakafa Tekno Kreatif

- [`9ad9ff7`](https://github.com/nakafaai/nakafa.com/commit/9ad9ff78d7ca1feb73117dd5f7e78bdcee435592) Thanks [@nabilfatih](https://github.com/nabilfatih)! - Removing schoolId in customer, now track schoolId in subscription level

### Patch Changes

- Updated dependencies [[`9ad9ff7`](https://github.com/nakafaai/nakafa.com/commit/9ad9ff78d7ca1feb73117dd5f7e78bdcee435592)]:
  - @repo/ai@1.0.0

## 0.0.3

### Patch Changes

- [`ddb5d7b`](https://github.com/nakafaai/nakafa.com/commit/ddb5d7bb1d92e9b2463bf5171ea75331311c6989) Thanks [@nabilfatih](https://github.com/nabilfatih)! - Exclude changeset

- Updated dependencies [[`ddb5d7b`](https://github.com/nakafaai/nakafa.com/commit/ddb5d7bb1d92e9b2463bf5171ea75331311c6989)]:
  - @repo/ai@0.0.3

## 0.0.2

### Patch Changes

- [`2d694d8`](https://github.com/nakafaai/nakafa.com/commit/2d694d81af7285defab038f2518f2f5279dfafab) Thanks [@nabilfatih](https://github.com/nabilfatih)! - Avoid vercel build for changeset merge

- [`03373ce`](https://github.com/nakafaai/nakafa.com/commit/03373ceada6429e75e94a81b2d655f6e20f999f2) Thanks [@nabilfatih](https://github.com/nabilfatih)! - Update release workflow

- Updated dependencies [[`2d694d8`](https://github.com/nakafaai/nakafa.com/commit/2d694d81af7285defab038f2518f2f5279dfafab), [`03373ce`](https://github.com/nakafaai/nakafa.com/commit/03373ceada6429e75e94a81b2d655f6e20f999f2)]:
  - @repo/ai@0.0.2

## 0.0.1

### Patch Changes

- 3a66784: Implement changeset to nakafa monorepo
- Updated dependencies [3a66784]
  - @repo/ai@0.0.1
