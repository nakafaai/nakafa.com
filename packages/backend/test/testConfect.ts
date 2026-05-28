/// <reference types="vite/client" />

import { TestConfect as TestConfect_ } from "@confect/test";
import confectSchema from "@repo/backend/confect/schema";

/**
 * Effect-native Confect test service for function, HTTP, and scheduler tests.
 *
 * References:
 * - https://confect.dev/guides/testing
 * - https://docs.convex.dev/testing/convex-test
 */
export const TestConfect = TestConfect_.TestConfect<typeof confectSchema>();

/**
 * Creates an isolated Convex test database loaded with generated Confect modules.
 */
export const layer = TestConfect_.layer(
  confectSchema,
  import.meta.glob("/convex/**/*.*s")
);
