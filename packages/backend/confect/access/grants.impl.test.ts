import { describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import { slugOf, tenancyFixture } from "@repo/backend/test/tenancy";
import { Array as Arr, Effect } from "effect";

const nf = slugOf("nf");
const { assign, list, revoke } = refs.public.access.grants;
const denied = (reason: "resource" | "role" | "condition") => ({
  _tag: "AccessDenied",
  code: "ACCESS_DENIED",
  reason,
});
const notMember = { _tag: "NotMember", code: "NOT_MEMBER" };
const rejected = (code: string) => ({ _tag: "GrantRejected", code });

describe("access/grants list", () => {
  it.effect(
    "shows a Person's grants to admins, unit admins of their unit, and themselves",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const views = yield* Effect.forEach(
          ["admin", "unitAdmin", "teacher"] as const,
          (account) =>
            fixture.as(account).query(list, {
              personId: fixture.people.teacher.personId,
              slug: nf,
            })
        );
        expect(views).toEqual(
          Arr.replicate(
            [
              {
                id: fixture.people.teacher.grantId,
                role: { key: "teacher", kind: "builtin" },
                scope: { kind: "unit", unitId: fixture.units.smp },
                term: { kind: "standing" },
              },
            ],
            3
          )
        );
      })
  );

  it.effect("refuses roles that do not cover the Person", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const denials = [
        yield* fixture
          .as("unitAdmin")
          .query(list, {
            personId: fixture.people.principal.personId,
            slug: nf,
          })
          .pipe(Effect.flip),
        yield* fixture
          .as("teacher")
          .query(list, { personId: fixture.people.student.personId, slug: nf })
          .pipe(Effect.flip),
      ];
      expect(denials).toMatchObject([denied("role"), denied("role")]);
    })
  );

  it.effect("denies another tenant by slug and by Person ID", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const denials = [
        yield* fixture
          .as("otherOwner")
          .query(list, { personId: fixture.people.teacher.personId, slug: nf })
          .pipe(Effect.flip),
        yield* fixture
          .as("admin")
          .query(list, {
            personId: fixture.people.otherOwner.personId,
            slug: nf,
          })
          .pipe(Effect.flip),
      ];
      expect(denials).toMatchObject([notMember, denied("resource")]);
    })
  );
});

describe("access/grants assign", () => {
  it.effect(
    "gives a role once, returns the same grant on retry, and records it under the Person",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const request = {
          personId: fixture.people.student.personId,
          role: "proctor",
          scope: { kind: "unit", unitId: fixture.units.smp },
          slug: nf,
        } as const;
        const owner = fixture.as("owner");
        const grantId = yield* owner.mutation(assign, request);
        expect(yield* owner.mutation(assign, request)).toBe(grantId);
        const entries = yield* fixture.run(
          Effect.flatMap(DatabaseReader, (reader) =>
            reader.table("journalEntries").index("by_creation_time").take(10)
          )
        );
        expect(entries).toMatchObject([
          {
            actor: { id: fixture.people.owner.personId, kind: "person" },
            change: {
              grant: grantId,
              role: { key: "proctor", kind: "builtin" },
              scope: request.scope,
              term: { kind: "standing" },
              type: "grant.created",
            },
            owner: { kind: "tenant", tenantId: fixture.tenants.nf },
            subject: { id: fixture.people.student.personId, kind: "person" },
          },
        ]);
      })
  );

  it.effect("lets a unit admin manage roles in their own unit only", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const unitAdmin = fixture.as("unitAdmin");
      const counselor = {
        personId: fixture.people.student.personId,
        role: "counselor",
        slug: nf,
      } as const;
      yield* unitAdmin.mutation(assign, {
        ...counselor,
        scope: { kind: "unit", unitId: fixture.units.smp },
      });
      const denials = [
        yield* unitAdmin
          .mutation(assign, {
            ...counselor,
            scope: { kind: "unit", unitId: fixture.units.sma },
          })
          .pipe(Effect.flip),
        yield* unitAdmin
          .mutation(assign, { ...counselor, scope: { kind: "tenant" } })
          .pipe(Effect.flip),
      ];
      expect(denials).toMatchObject([denied("role"), denied("role")]);
    })
  );

  it.effect("keeps Owner and Admin roles with Owners", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const promote = {
        personId: fixture.people.teacher.personId,
        role: "admin",
        scope: { kind: "tenant" },
        slug: nf,
      } as const;
      const denial = yield* fixture
        .as("admin")
        .mutation(assign, promote)
        .pipe(Effect.flip);
      expect(denial).toMatchObject(denied("role"));
      expect(yield* fixture.as("owner").mutation(assign, promote)).toBeTypeOf(
        "string"
      );
    })
  );

  it.effect("refuses an archived unit and a suspended tenant", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const staff = {
        personId: fixture.people.student.personId,
        role: "staff",
        slug: nf,
      } as const;
      const archived = yield* fixture
        .as("owner")
        .mutation(assign, {
          ...staff,
          scope: { kind: "unit", unitId: fixture.units.smk },
        })
        .pipe(Effect.flip);
      yield* fixture.run(
        Effect.flatMap(DatabaseWriter, (writer) =>
          writer
            .table("tenants")
            .patch(fixture.tenants.nf, { status: "suspended" })
        )
      );
      const suspended = yield* fixture
        .as("owner")
        .mutation(assign, {
          ...staff,
          scope: { kind: "unit", unitId: fixture.units.smp },
        })
        .pipe(Effect.flip);
      expect([archived, suspended]).toMatchObject([
        denied("condition"),
        denied("condition"),
      ]);
    })
  );

  it.effect("denies another tenant by slug, by Person ID, and by unit ID", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const request = {
        personId: fixture.people.student.personId,
        role: "teacher",
        scope: { kind: "tenant" },
        slug: nf,
      } as const;
      const owner = fixture.as("owner");
      const denials = [
        yield* fixture
          .as("otherOwner")
          .mutation(assign, request)
          .pipe(Effect.flip),
        yield* owner
          .mutation(assign, {
            ...request,
            personId: fixture.people.otherOwner.personId,
          })
          .pipe(Effect.flip),
        yield* owner
          .mutation(assign, {
            ...request,
            scope: { kind: "unit", unitId: fixture.units.sd },
          })
          .pipe(Effect.flip),
      ];
      expect(denials).toMatchObject([
        notMember,
        denied("resource"),
        denied("resource"),
      ]);
    })
  );

  it.effect("refuses roles the tenant's invariants forbid", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const owner = fixture.as("owner");
      const tenantWide = { kind: "tenant" } as const;
      const refusals = [
        yield* owner
          .mutation(assign, {
            personId: fixture.visitor,
            role: "teacher",
            scope: tenantWide,
            slug: nf,
          })
          .pipe(Effect.flip),
        yield* owner
          .mutation(assign, {
            personId: fixture.people.suspended.personId,
            role: "teacher",
            scope: tenantWide,
            slug: nf,
          })
          .pipe(Effect.flip),
        yield* owner
          .mutation(assign, {
            personId: fixture.people.student.personId,
            role: "integration",
            scope: tenantWide,
            slug: nf,
          })
          .pipe(Effect.flip),
        yield* owner
          .mutation(assign, {
            personId: fixture.people.student.personId,
            role: "owner",
            scope: { kind: "unit", unitId: fixture.units.smp },
            slug: nf,
          })
          .pipe(Effect.flip),
      ];
      expect(refusals).toMatchObject([
        rejected("PERSON_KIND"),
        rejected("PERSON_INACTIVE"),
        rejected("GRANT_ROLE"),
        rejected("GRANT_SCOPE"),
      ]);
    })
  );
});

describe("access/grants revoke", () => {
  it.effect("ends a grant once, records it, and treats a repeat as done", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const request = { grantId: fixture.people.teacher.grantId, slug: nf };
      const owner = fixture.as("owner");
      expect(yield* owner.mutation(revoke, request)).toBeNull();
      expect(yield* owner.mutation(revoke, request)).toBeNull();
      const { grant, entries } = yield* fixture.run(
        Effect.gen(function* () {
          const reader = yield* DatabaseReader;
          return {
            entries: yield* reader
              .table("journalEntries")
              .index("by_creation_time")
              .take(10),
            grant: yield* reader
              .table("tenantGrants")
              .get(fixture.people.teacher.grantId),
          };
        })
      );
      expect(grant.status).toBe("revoked");
      expect(entries).toMatchObject([
        {
          change: {
            grant: fixture.people.teacher.grantId,
            reason: "revoked",
            type: "grant.ended",
          },
          subject: { id: fixture.people.teacher.personId, kind: "person" },
        },
      ]);
    })
  );

  it.effect(
    "keeps the last signed-in Owner and the Owner role with Owners",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const ownerGrant = { grantId: fixture.people.owner.grantId, slug: nf };
        const denials = [
          yield* fixture
            .as("admin")
            .mutation(revoke, ownerGrant)
            .pipe(Effect.flip),
          yield* fixture
            .as("owner")
            .mutation(revoke, ownerGrant)
            .pipe(Effect.flip),
        ];
        expect(denials).toMatchObject([denied("role"), rejected("LAST_OWNER")]);
      })
  );

  it.effect(
    "ends a grant in an archived unit and refuses every revoke in a suspended tenant",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const archived = yield* fixture.run(
          Effect.flatMap(DatabaseWriter, (writer) =>
            writer.table("tenantGrants").insert({
              grantedBy: { kind: "system" },
              personId: fixture.people.student.personId,
              role: { key: "student", kind: "builtin" },
              scope: { kind: "unit", unitId: fixture.units.smk },
              status: "active",
              tenantId: fixture.tenants.nf,
              term: { kind: "standing" },
            })
          )
        );
        const owner = fixture.as("owner");
        expect(
          yield* owner.mutation(revoke, { grantId: archived, slug: nf })
        ).toBeNull();
        const ended = yield* fixture.run(
          Effect.flatMap(DatabaseReader, (reader) =>
            reader.table("tenantGrants").get(archived)
          )
        );
        yield* fixture.run(
          Effect.flatMap(DatabaseWriter, (writer) =>
            writer
              .table("tenants")
              .patch(fixture.tenants.nf, { status: "suspended" })
          )
        );
        const suspended = yield* owner
          .mutation(revoke, {
            grantId: fixture.people.teacher.grantId,
            slug: nf,
          })
          .pipe(Effect.flip);
        expect(ended.status).toBe("revoked");
        expect(suspended).toMatchObject(denied("condition"));
      })
  );

  it.effect("lets a holder see their grant but not end it", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const denial = yield* fixture
        .as("student")
        .mutation(revoke, { grantId: fixture.people.student.grantId, slug: nf })
        .pipe(Effect.flip);
      expect(denial).toMatchObject(denied("role"));
    })
  );

  it.effect("denies another tenant by slug and by grant ID", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const denials = [
        yield* fixture
          .as("otherOwner")
          .mutation(revoke, {
            grantId: fixture.people.teacher.grantId,
            slug: nf,
          })
          .pipe(Effect.flip),
        yield* fixture
          .as("owner")
          .mutation(revoke, {
            grantId: fixture.people.otherOwner.grantId,
            slug: nf,
          })
          .pipe(Effect.flip),
      ];
      expect(denials).toMatchObject([notMember, denied("resource")]);
    })
  );
});
