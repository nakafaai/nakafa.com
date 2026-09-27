// This repo passes an explicit module map because convex-test's default
// module discovery does not work reliably in this workspace layout.
/// <reference types="vite/client" />

import { TestConfect } from "@confect/test";
import convexSchema from "@repo/backend/confect/_generated/convexSchema";
import schema from "@repo/backend/confect/_generated/schema";
export const convexModules = import.meta.glob([
  "../convex/**/*.ts",
  "!../convex/**/*.test.ts",
]);
export const Confect = TestConfect.TestConfect<typeof schema>();
export const confectLayer = TestConfect.layer(
  schema,
  convexSchema,
  convexModules
);
