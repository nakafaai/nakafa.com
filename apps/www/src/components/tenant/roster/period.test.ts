import { describe, expect, it } from "@effect/vitest";
import { Id } from "@repo/backend/confect/_generated/id";
import { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Effect, Schema } from "effect";
import { activePeriodOf } from "@/components/tenant/roster/period";

const client = vi.hoisted(() => ({ query: vi.fn() }));

vi.mock("@/lib/convex/client", () => ({
  readConvexClient: () => client,
}));

const slug = Schema.decodeSync(TenantSlug)("harapan");
const unitId = Schema.decodeUnknownSync(Id("tenantUnits"))("smp");

describe("activePeriodOf", () => {
  it.effect("reads the unit's active period when an action needs it", () =>
    Effect.gen(function* () {
      client.query.mockResolvedValueOnce("genap");
      expect(yield* activePeriodOf(slug, unitId)).toBe("genap");
      expect(client.query).toHaveBeenCalledWith(expect.anything(), {
        slug,
        unitId,
      });
    })
  );

  it.effect("refuses an action for a unit with no active period", () =>
    Effect.gen(function* () {
      client.query.mockResolvedValueOnce(null);
      expect(yield* Effect.flip(activePeriodOf(slug, unitId))).toMatchObject({
        _tag: "RosterPeriodMissing",
      });
    })
  );
});
