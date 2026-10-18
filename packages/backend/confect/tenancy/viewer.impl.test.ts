import { describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import { DatabaseWriter } from "@repo/backend/confect/_generated/services";
import { schoolMascot } from "@repo/backend/confect/tenancy/mascot";
import { MASCOT } from "@repo/backend/test/mascot";
import { slugOf, tenancyFixture } from "@repo/backend/test/tenancy";
import { Array as Arr, Effect, Order, Struct } from "effect";

const nf = slugOf("nf");
const viewer = refs.public.tenancy.viewer.get;

/** The units of a view where the caller may take the exam edit action. */
const examEditable = <Unit extends { readonly can: readonly string[] }>(
  units: readonly Unit[]
) => Arr.filter(units, (unit) => Arr.contains(unit.can, "exam.edit"));

describe("tenancy/viewer", () => {
  it.effect(
    "returns the Owner's tenant with its settings, its units with theirs, grants, and every tenant capability",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const view = yield* fixture.as("owner").query(viewer, { slug: nf });
        expect(view.tenant).toEqual({
          country: "ID",
          currency: "IDR",
          id: fixture.tenants.nf,
          kind: "foundation",
          mascot: schoolMascot("nf"),
          name: "Yayasan Nakafa",
          policies: { emailDomains: [], nina: false, studentThreads: false },
          slug: "nf",
          status: "active",
        });
        expect(view.person).toEqual({
          id: fixture.people.owner.personId,
          kind: "member",
          name: "Owner",
        });
        expect(Arr.map(view.units, Struct.omit(["can"]))).toEqual([
          {
            contentLanguage: "id",
            id: fixture.units.sma,
            level: "sma",
            name: "SMA Nakafa",
            status: "active",
            timeZone: "Asia/Jakarta",
          },
          {
            contentLanguage: "id",
            id: fixture.units.smp,
            level: "smp",
            name: "SMP Nakafa",
            status: "active",
            timeZone: "Asia/Jakarta",
          },
          {
            contentLanguage: "id",
            id: fixture.units.smk,
            level: "smk",
            name: "SMK Nakafa",
            status: "archived",
            timeZone: "Asia/Jakarta",
          },
        ]);
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
          "document.edit",
          "exam.edit",
          "exam.view",
          "grant.manage",
          "integration.manage",
          "integration.view",
          "invite.view",
          "owner.manage",
          "person.manage",
          "person.view",
          "tenant.manage",
          "tenant.view",
          "visit.approve",
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

  it.effect(
    "lets the Owner edit exams in each active unit, and in no archived unit",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const view = yield* fixture.as("owner").query(viewer, { slug: nf });
        expect(Arr.map(examEditable(view.units), (unit) => unit.id)).toEqual([
          fixture.units.sma,
          fixture.units.smp,
        ]);
      })
  );

  it.effect("lets a unit teacher edit exams in their own unit only", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const view = yield* fixture.as("teacher").query(viewer, { slug: nf });
      expect(Arr.map(examEditable(view.units), (unit) => unit.id)).toEqual([
        fixture.units.smp,
      ]);
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
        "exam.view",
        "integration.view",
        "invite.view",
        "person.view",
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

  it.effect(
    "gives the viewer the account's name and animal, and its username once it has one",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        yield* fixture.run(
          Effect.flatMap(DatabaseWriter, (writer) =>
            writer
              .table("users")
              .patch(fixture.users.owner.userId, { username: "owner-harapan" })
          )
        );
        const view = yield* fixture.as("owner").query(viewer, { slug: nf });
        expect(view.account).toEqual({
          mascot: MASCOT,
          name: "User owner",
          username: "owner-harapan",
        });
      })
  );

  it.effect(
    "shows the account's photo only while the account chooses the photo",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const owner = fixture.as("owner");
        const photo = "https://example.test/owner.png";
        yield* fixture.run(
          Effect.flatMap(DatabaseWriter, (writer) =>
            writer.table("users").patch(fixture.users.owner.userId, {
              image: photo,
              picture: "photo",
            })
          )
        );
        const shown = yield* owner.query(viewer, { slug: nf });
        yield* fixture.run(
          Effect.flatMap(DatabaseWriter, (writer) =>
            writer
              .table("users")
              .patch(fixture.users.owner.userId, { picture: "animal" })
          )
        );
        const hidden = yield* owner.query(viewer, { slug: nf });
        expect(shown.account).toEqual({
          image: photo,
          mascot: MASCOT,
          name: "User owner",
        });
        expect(hidden.account).toEqual({ mascot: MASCOT, name: "User owner" });
      })
  );
});
