import { api } from "@repo/backend/convex/_generated/api";
import { createConvexTestWithBetterAuth } from "@repo/backend/convex/test.helpers";
import {
  activateTryoutStartSource,
  TRYOUT_START_COUNTRY,
  TRYOUT_START_EXAM,
  TRYOUT_START_TRACK,
} from "@repo/backend/test/tryout-source";
import { describe, expect, it } from "vitest";

const route = {
  countryKey: TRYOUT_START_COUNTRY,
  examKey: TRYOUT_START_EXAM,
  locale: "id" as const,
  trackKey: TRYOUT_START_TRACK,
};

describe("tryouts/queries/sets", () => {
  it("requires an active signed try-out publication", async () => {
    const t = createConvexTestWithBetterAuth();

    await expect(
      t.query(api.tryouts.queries.sets.list, {
        ...route,
        paginationOpts: { cursor: null, numItems: 10 },
        sort: { direction: "asc", field: "order" },
      })
    ).rejects.toMatchObject({ data: { code: "CONTENT_RELEASE_MISSING" } });
  });

  it.each([0, -1, 1.5])(
    "rejects the invalid signed page size %s",
    async (numItems) => {
      const t = createConvexTestWithBetterAuth();
      await t.mutation((ctx) => activateTryoutStartSource(ctx, "visible"));

      await expect(
        t.query(api.tryouts.queries.sets.list, {
          ...route,
          paginationOpts: { cursor: null, numItems },
          sort: { direction: "asc", field: "order" },
        })
      ).rejects.toThrow("The try-out set page size is invalid.");
    }
  );
});
