import { describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import { DatabaseWriter } from "@repo/backend/confect/_generated/services";
import { slugOf, tenancyFixture } from "@repo/backend/test/tenancy";
import { Array as Arr, Effect, Order } from "effect";

const nf = slugOf("nf");
const viewer = refs.public.tenancy.viewer.get;

describe("tenancy/viewer", () => {
  it.effect(
    "returns the Owner's tenant, active units, grants, and every tenant capability",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const view = yield* fixture.as("owner").query(viewer, { slug: nf });
        expect(view.tenant).toEqual({
          id: fixture.tenants.nf,
          kind: "foundation",
          name: "Yayasan Nakafa",
          slug: "nf",
          status: "active",
        });
        expect(view.person).toEqual({
          id: fixture.people.owner.personId,
          kind: "member",
          name: "Owner",
        });
        expect(
          Arr.sort(
            Arr.map(view.units, (unit) => unit.name),
            Order.String
          )
        ).toEqual(["SMA Nakafa", "SMP Nakafa"]);
        expect(view.grants).toEqual([
          {
            id: fixture.people.owner.grantId,
            role: { key: "owner", kind: "builtin" },
            scope: { kind: "tenant" },
            term: { kind: "standing" },
          },
        ]);
        expect(Arr.sort(view.can, Order.String)).toEqual([
          "audit.view",
          "grant.manage",
          "owner.manage",
          "tenant.manage",
          "tenant.view",
        ]);
      })
  );

  it.effect(
    "gives a unit teacher the shell through membership and nothing else",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const view = yield* fixture.as("teacher").query(viewer, { slug: nf });
        expect(view.can).toEqual(["tenant.view"]);
      })
  );

  it.effect("drops every write capability while the tenant is suspended", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      yield* fixture.run(
        Effect.flatMap(DatabaseWriter, (writer) =>
          writer
            .table("tenants")
            .patch(fixture.tenants.nf, { status: "suspended" })
        )
      );
      const view = yield* fixture.as("owner").query(viewer, { slug: nf });
      expect(Arr.sort(view.can, Order.String)).toEqual([
        "audit.view",
        "tenant.view",
      ]);
    })
  );

  it.effect(
    "denies another tenant's Owner, an account without a Person, a suspended Person, and an unknown tenant",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const denials = yield* Effect.forEach(
          ["otherOwner", "stranger", "suspended"] as const,
          (account) =>
            fixture.as(account).query(viewer, { slug: nf }).pipe(Effect.flip)
        );
        const unknown = yield* fixture
          .as("owner")
          .query(viewer, { slug: slugOf("missing") })
          .pipe(Effect.flip);
        expect(Arr.append(denials, unknown)).toMatchObject(
          Arr.replicate({ _tag: "NotMember", code: "NOT_MEMBER" }, 4)
        );
      })
  );

  it.effect("refuses an operator Person without an audited grant", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const denial = yield* fixture
        .as("visitor")
        .query(viewer, { slug: nf })
        .pipe(Effect.flip);
      expect(denial).toMatchObject({
        _tag: "AccessDenied",
        action: "tenant.view",
        code: "ACCESS_DENIED",
        reason: "role",
      });
    })
  );

  it.effect("requires a session", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const denial = yield* fixture.anonymous
        .query(viewer, { slug: nf })
        .pipe(Effect.flip);
      expect(denial).toMatchObject({
        _tag: "SessionRequired",
        code: "UNAUTHENTICATED",
      });
    })
  );
});
