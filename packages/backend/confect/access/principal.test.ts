import { describe, expect, it } from "@effect/vitest";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import { ClientPrincipal } from "@repo/backend/confect/access/principal";
import { clientPrincipal } from "@repo/backend/test/integrations";
import { tenancyFixture } from "@repo/backend/test/tenancy";
import { Effect, Schema } from "effect";

describe("access/principal", () => {
  it.effect(
    "refuses a client paired with the tenant of another school, and keeps its own",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const outcome = yield* fixture.run(
          Effect.gen(function* () {
            const ours = yield* clientPrincipal(fixture.tenants.nf, {
              actions: ["person.view"],
              scope: { kind: "tenant" },
              status: "active",
            });
            const other = yield* (yield* DatabaseReader)
              .table("tenants")
              .get(fixture.tenants.other)
              .pipe(Effect.orDie);
            const refused = yield* Schema.decodeEffect(ClientPrincipal)({
              client: ours.client,
              tenant: other,
            }).pipe(Effect.flip);
            return { kept: ours.tenant._id, refused: refused.message };
          })
        );
        expect(outcome.kept).toBe(fixture.tenants.nf);
        expect(outcome.refused).toContain(
          "A client decides only for the school it belongs to."
        );
      })
  );
});
