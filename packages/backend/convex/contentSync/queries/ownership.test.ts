import { internal } from "@repo/backend/convex/_generated/api";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import {
  activateTryoutSnapshot,
  makeTryoutCatalogRow,
  makeTryoutPlacementRow,
} from "@repo/backend/test/tryout-snapshot";
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";

describe("contentSync/queries/ownership", () => {
  it("reports the active tryout publication owner", async () => {
    const t = convexTest(schema, convexModules);

    await expect(
      t.query(internal.contentSync.queries.ownership.read, {})
    ).resolves.toEqual({ tryoutsManaged: false });

    await t.mutation((ctx) =>
      activateTryoutSnapshot(ctx, {
        catalog: [
          makeTryoutCatalogRow("en").record.row,
          makeTryoutCatalogRow("id").record.row,
        ],
        placements: [
          makeTryoutPlacementRow("en").record.row,
          makeTryoutPlacementRow("id").record.row,
        ],
      })
    );

    await expect(
      t.query(internal.contentSync.queries.ownership.read, {})
    ).resolves.toEqual({ tryoutsManaged: true });
  });
});
