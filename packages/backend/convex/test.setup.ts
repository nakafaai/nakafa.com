// This repo passes an explicit module map because convex-test's default
// module discovery does not work reliably in this workspace layout.
/// <reference types="vite/client" />

export const convexModules = import.meta.glob(["./**/*.ts", "!./**/*.test.ts"]);
