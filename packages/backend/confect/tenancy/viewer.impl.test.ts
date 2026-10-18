import { describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import { DatabaseWriter } from "@repo/backend/confect/_generated/services";
import { schoolMascot } from "@repo/backend/confect/tenancy/mascot";
import { NEW_TENANT_POLICIES } from "@repo/backend/confect/tenancy/policy";
import { SCHOOL_LIMIT } from "@repo/backend/confect/tenancy/schema";
import { storageUrl, storeFile } from "@repo/backend/test/logo";
import { MASCOT } from "@repo/backend/test/mascot";
import {
  slugOf,
  TENANCY_NOW,
  tenancyFixture,
} from "@repo/backend/test/tenancy";
import { Array as Arr, Effect, Order } from "effect";

const nf = slugOf("nf");
const viewer = refs.public.tenancy.viewer.get;
const schools = refs.public.tenancy.viewer.schools;

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
          mascot: schoolMascot(fixture.tenants.nf),
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
        expect(view.units).toEqual([
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

describe("tenancy/viewer schools", () => {
  it.effect(
    "lists the schools the caller is an active member of, each with its name, its address, and its mark",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const list = yield* fixture.as("owner").query(schools, {});
        expect(list).toEqual([
          {
            mark: { mascot: schoolMascot(fixture.tenants.nf) },
            name: "Yayasan Nakafa",
            slug: "nf",
          },
        ]);
      })
  );

  it.effect("lists the newest membership first", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      yield* fixture.run(
        Effect.flatMap(DatabaseWriter, (writer) =>
          writer.table("tenantPeople").insert({
            account: {
              claimedAt: TENANCY_NOW,
              method: "invite",
              state: "claimed",
              userId: fixture.users.owner.userId,
            },
            kind: "member",
            name: "Owner",
            status: "active",
            tenantId: fixture.tenants.other,
          })
        )
      );
      const list = yield* fixture.as("owner").query(schools, {});
      expect(Arr.map(list, (school) => school.slug)).toEqual(["other", "nf"]);
    })
  );

  it.effect(
    "lists only the caller's own active member Persons, never another account's, a suspended one, or an operator one",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const otherOwner = yield* fixture.as("otherOwner").query(schools, {});
        const suspended = yield* fixture.as("suspended").query(schools, {});
        const visitor = yield* fixture.as("visitor").query(schools, {});
        const stranger = yield* fixture.as("stranger").query(schools, {});
        expect(Arr.map(otherOwner, (school) => school.slug)).toEqual(["other"]);
        expect([suspended, visitor, stranger]).toEqual([[], [], []]);
      })
  );

  it.effect(
    "caps the list at the school limit, and keeps the newest memberships",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        yield* fixture.run(
          Effect.forEach(
            Arr.makeBy(SCHOOL_LIMIT, (index) => index),
            (index) =>
              Effect.gen(function* () {
                const writer = yield* DatabaseWriter;
                const tenantId = yield* writer.table("tenants").insert({
                  country: "ID",
                  currency: "IDR",
                  kind: "school",
                  name: `Sekolah ${index}`,
                  policies: NEW_TENANT_POLICIES,
                  slug: slugOf(`sekolah-${index}`),
                  status: "active",
                });
                yield* writer.table("tenantPeople").insert({
                  account: {
                    claimedAt: TENANCY_NOW,
                    method: "invite",
                    state: "claimed",
                    userId: fixture.users.owner.userId,
                  },
                  kind: "member",
                  name: "Owner",
                  status: "active",
                  tenantId,
                });
              }),
            { discard: true }
          )
        );
        const list = yield* fixture.as("owner").query(schools, {});
        expect(list).toHaveLength(SCHOOL_LIMIT);
        expect(Arr.map(list, (school) => school.slug)).not.toContain("nf");
      })
  );

  it.effect(
    "gives the mark of a school with a logo the address of the logo",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const file = yield* storeFile(
          fixture.convex,
          new Blob([new Uint8Array(8)], { type: "image/png" })
        );
        yield* fixture.run(
          Effect.flatMap(DatabaseWriter, (writer) =>
            writer.table("tenants").patch(fixture.tenants.nf, { logo: file })
          )
        );
        const list = yield* fixture.as("owner").query(schools, {});
        expect(list).toEqual([
          {
            mark: {
              logo: yield* storageUrl(fixture.convex, file),
              mascot: schoolMascot(fixture.tenants.nf),
            },
            name: "Yayasan Nakafa",
            slug: "nf",
          },
        ]);
      })
  );

  it.effect("requires a session", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const denial = yield* fixture.anonymous
        .query(schools, {})
        .pipe(Effect.flip);
      expect(denial).toMatchObject({
        _tag: "SessionRequired",
        code: "UNAUTHENTICATED",
      });
    })
  );
});
