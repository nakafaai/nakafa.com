import { describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import { Confect, confectLayer } from "@repo/backend/confect/test.setup";
import { Effect } from "effect";

describe("billing/migration.impl", () => {
  it.effect("runs one empty page through the registered function", () =>
    Effect.gen(function* () {
      const t = yield* Confect;
      const page = yield* t.mutation(
        refs.internal.billing.migration.copyPolarSubscriptionsPage,
        { cursor: null, numItems: 10 }
      );
      expect(page).toEqual({
        continueCursor: page.continueCursor,
        copied: 0,
        isDone: true,
        skipped: 0,
      });
    }).pipe(Effect.provide(confectLayer))
  );
});
