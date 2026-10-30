import { beforeEach, describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import { DatabaseWriter } from "@repo/backend/confect/_generated/services";
import { NEW_TENANT_POLICIES } from "@repo/backend/confect/tenancy/policy";
import {
  grantsOf,
  operatorAccount,
  personOf,
} from "@repo/backend/test/operators";
import {
  journal,
  slugOf,
  suspend,
  actedAt,
  TENANCY_NOW,
  tenancyFixture,
} from "@repo/backend/test/tenancy";
import { Array as Arr, Effect } from "effect";

const nf = slugOf("nf");
const other = slugOf("other");
const requestVisit = refs.public.operators.visits.request;
const listVisits = refs.public.operators.visits.list;
const approve = refs.public.operators.visits.approve;
const revoke = refs.internal.operators.staff.revoke;

const HOUR_MS = 60 * 60 * 1000;

/** Fake timers keep every scheduled end from running before the test asks for it. */
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(TENANCY_NOW);
});

describe("operators/visits request", () => {
  it.effect(
    "records a requested visit under the operator, and keeps its note out of the journal",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const staff = yield* operatorAccount(fixture, "requester");
        vi.setSystemTime(actedAt());
        const visit = yield* staff.client.mutation(requestVisit, {
          minutes: 60,
          note: "Pendampingan kurikulum semester ini",
          reason: "support",
          tenantId: fixture.tenants.nf,
        });
        expect(visit).toMatchObject({
          minutes: 60,
          note: "Pendampingan kurikulum semester ini",
          reason: "support",
          requestedAt: actedAt(),
          state: { status: "pending" },
        });
        const entries = yield* fixture.run(journal);
        expect(entries).toMatchObject([
          {
            actor: { kind: "operator" },
            change: { minutes: 60, reason: "support", type: "visit.requested" },
            subject: { id: visit.id, kind: "visit" },
          },
        ]);
        // The journal holds reason codes and lengths only, so the note is absent.
        expect(Arr.map(entries, (entry) => entry.change)).toEqual([
          { minutes: 60, reason: "support", type: "visit.requested" },
        ]);
      })
  );

  it.effect(
    "refuses a second open visit to the same school, while one is requested and while one is approved",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const staff = yield* operatorAccount(fixture, "repeat");
        const first = yield* staff.client.mutation(requestVisit, {
          minutes: 60,
          note: "Pertama",
          reason: "onboarding",
          tenantId: fixture.tenants.nf,
        });
        const pending = yield* staff.client
          .mutation(requestVisit, {
            minutes: 60,
            note: "Kedua",
            reason: "incident",
            tenantId: fixture.tenants.nf,
          })
          .pipe(Effect.flip);
        yield* fixture.as("admin").mutation(approve, {
          slug: nf,
          visitId: first.id,
        });
        const approved = yield* staff.client
          .mutation(requestVisit, {
            minutes: 60,
            note: "Ketiga",
            reason: "incident",
            tenantId: fixture.tenants.nf,
          })
          .pipe(Effect.flip);
        expect([pending._tag, approved._tag]).toEqual([
          "VisitOpen",
          "VisitOpen",
        ]);
      })
  );

  it.effect("refuses a request to a suspended school", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const staff = yield* operatorAccount(fixture, "late");
      yield* fixture.run(suspend(fixture.tenants.nf));
      const denial = yield* staff.client
        .mutation(requestVisit, {
          minutes: 60,
          note: "Terlambat",
          reason: "support",
          tenantId: fixture.tenants.nf,
        })
        .pipe(Effect.flip);
      expect(denial).toMatchObject({
        _tag: "TenantSuspended",
        code: "TENANT_SUSPENDED",
      });
    })
  );

  it.effect("refuses a request to a school that does not exist", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const staff = yield* operatorAccount(fixture, "lost");
      const gone = yield* fixture.run(
        Effect.gen(function* () {
          const writer = yield* DatabaseWriter;
          const tenantId = yield* writer.table("tenants").insert({
            country: "ID",
            currency: "IDR",
            kind: "school",
            name: "Sekolah Hilang",
            policies: NEW_TENANT_POLICIES,
            slug: slugOf("hilang"),
            status: "active",
          });
          yield* writer.table("tenants").delete(tenantId);
          return tenantId;
        })
      );
      const denial = yield* staff.client
        .mutation(requestVisit, {
          minutes: 60,
          note: "Tidak ada",
          reason: "support",
          tenantId: gone,
        })
        .pipe(Effect.flip);
      expect(denial).toMatchObject({ _tag: "TenantNotFound" });
    })
  );
});

describe("operators/visits approve", () => {
  it.effect(
    "admits the operator, gives a temporary Auditor grant for the visit's length, and journals each step",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const staff = yield* operatorAccount(fixture, "admitted");
        const visit = yield* staff.client.mutation(requestVisit, {
          minutes: 60,
          note: "Kunjungan",
          reason: "support",
          tenantId: fixture.tenants.nf,
        });
        vi.setSystemTime(actedAt());
        const approved = yield* fixture.as("admin").mutation(approve, {
          slug: nf,
          visitId: visit.id,
        });
        expect(approved.state).toEqual({
          at: actedAt(),
          expiresAt: actedAt() + HOUR_MS,
          status: "approved",
        });
        const person = yield* personOf(fixture, staff.userId);
        expect(person).toMatchObject({
          account: {
            claimedAt: actedAt(),
            method: "operator",
            state: "claimed",
            userId: staff.userId,
          },
          kind: "operator",
          name: "Operator Nakafa",
          status: "active",
        });
        expect(yield* grantsOf(fixture, person._id)).toMatchObject([
          {
            role: { key: "auditor", kind: "builtin" },
            scope: { kind: "tenant" },
            term: { expiresAt: actedAt() + HOUR_MS, kind: "temporary" },
          },
        ]);
        expect(yield* fixture.run(journal)).toMatchObject([
          { change: { type: "visit.requested" } },
          {
            actor: { id: fixture.people.admin.personId, kind: "person" },
            change: { type: "person.created" },
            subject: { id: person._id, kind: "person" },
          },
          {
            actor: { id: fixture.people.admin.personId, kind: "person" },
            change: { method: "operator", type: "person.claimed" },
            subject: { id: person._id, kind: "person" },
          },
          {
            change: {
              term: { expiresAt: actedAt() + HOUR_MS, kind: "temporary" },
              type: "grant.created",
            },
            subject: { id: person._id, kind: "person" },
          },
          {
            actor: { id: fixture.people.admin.personId, kind: "person" },
            change: { type: "visit.approved" },
            subject: { id: visit.id, kind: "visit" },
          },
        ]);
      })
  );

  it.effect("lets the school's Owner approve a request as well", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const staff = yield* operatorAccount(fixture, "owned");
      const visit = yield* staff.client.mutation(requestVisit, {
        minutes: 30,
        note: "Owner",
        reason: "incident",
        tenantId: fixture.tenants.nf,
      });
      const approved = yield* fixture.as("owner").mutation(approve, {
        slug: nf,
        visitId: visit.id,
      });
      expect(approved.state).toMatchObject({ status: "approved" });
    })
  );

  it.effect("refuses a unit Admin, whose role covers one school only", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const staff = yield* operatorAccount(fixture, "unit");
      const visit = yield* staff.client.mutation(requestVisit, {
        minutes: 60,
        note: "Unit",
        reason: "support",
        tenantId: fixture.tenants.nf,
      });
      const denial = yield* fixture
        .as("unitAdmin")
        .mutation(approve, {
          slug: nf,
          visitId: visit.id,
        })
        .pipe(Effect.flip);
      expect(denial).toMatchObject({ _tag: "AccessDenied", reason: "role" });
    })
  );

  it.effect(
    "refuses an Owner of another school, who may not decide this visit",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const staff = yield* operatorAccount(fixture, "foreign");
        const visit = yield* staff.client.mutation(requestVisit, {
          minutes: 60,
          note: "Asing",
          reason: "support",
          tenantId: fixture.tenants.nf,
        });
        const denial = yield* fixture
          .as("otherOwner")
          .mutation(approve, {
            slug: other,
            visitId: visit.id,
          })
          .pipe(Effect.flip);
        expect(denial).toMatchObject({
          _tag: "AccessDenied",
          reason: "resource",
        });
      })
  );

  it.effect("refuses an approval in a suspended school", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const staff = yield* operatorAccount(fixture, "paused");
      const visit = yield* staff.client.mutation(requestVisit, {
        minutes: 60,
        note: "Ditangguhkan",
        reason: "support",
        tenantId: fixture.tenants.nf,
      });
      yield* fixture.run(suspend(fixture.tenants.nf));
      const denial = yield* fixture
        .as("admin")
        .mutation(approve, {
          slug: nf,
          visitId: visit.id,
        })
        .pipe(Effect.flip);
      expect(denial).toMatchObject({
        _tag: "AccessDenied",
        reason: "condition",
      });
    })
  );

  it.effect(
    "refuses an approval once the operator's account is being deleted",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const staff = yield* operatorAccount(fixture, "deleting");
        const visit = yield* staff.client.mutation(requestVisit, {
          minutes: 60,
          note: "Akun sedang dihapus",
          reason: "support",
          tenantId: fixture.tenants.nf,
        });
        yield* fixture.run(
          Effect.flatMap(DatabaseWriter, (writer) =>
            writer.table("users").patch(staff.userId, {
              deletionPreparedAt: TENANCY_NOW,
            })
          )
        );
        const denial = yield* fixture
          .as("admin")
          .mutation(approve, { slug: nf, visitId: visit.id })
          .pipe(Effect.flip);
        expect(denial).toMatchObject({ _tag: "NotOperator" });
      })
  );

  it.effect("refuses an approval once the operator's access was revoked", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const staff = yield* operatorAccount(fixture, "withdrawn");
      const visit = yield* staff.client.mutation(requestVisit, {
        minutes: 60,
        note: "Dicabut",
        reason: "support",
        tenantId: fixture.tenants.nf,
      });
      yield* fixture.internal.mutation(revoke, { userId: staff.userId });
      const denial = yield* fixture
        .as("admin")
        .mutation(approve, {
          slug: nf,
          visitId: visit.id,
        })
        .pipe(Effect.flip);
      expect(denial).toMatchObject({ _tag: "NotOperator" });
    })
  );

  it.effect(
    "refuses an operator who already holds a Person of another kind in the school",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const staff = yield* operatorAccount(fixture, "teaching");
        yield* fixture.run(
          Effect.flatMap(DatabaseWriter, (writer) =>
            writer.table("tenantPeople").insert({
              account: {
                claimedAt: TENANCY_NOW,
                method: "invite",
                state: "claimed",
                userId: staff.userId,
              },
              kind: "member",
              name: "Guru Juga",
              status: "active",
              tenantId: fixture.tenants.nf,
            })
          )
        );
        const visit = yield* staff.client.mutation(requestVisit, {
          minutes: 60,
          note: "Ganda",
          reason: "support",
          tenantId: fixture.tenants.nf,
        });
        const denial = yield* fixture
          .as("admin")
          .mutation(approve, {
            slug: nf,
            visitId: visit.id,
          })
          .pipe(Effect.flip);
        expect(denial).toMatchObject({
          _tag: "OperatorHasPerson",
          code: "OPERATOR_HAS_PERSON",
        });
      })
  );

  it.effect(
    "refuses to approve a visit twice, and a visit that does not exist",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const staff = yield* operatorAccount(fixture, "twice");
        const visit = yield* staff.client.mutation(requestVisit, {
          minutes: 60,
          note: "Dua kali",
          reason: "support",
          tenantId: fixture.tenants.nf,
        });
        yield* fixture.as("admin").mutation(approve, {
          slug: nf,
          visitId: visit.id,
        });
        const again = yield* fixture
          .as("admin")
          .mutation(approve, {
            slug: nf,
            visitId: visit.id,
          })
          .pipe(Effect.flip);
        expect(again).toMatchObject({ _tag: "VisitNotPending" });
        yield* fixture.run(
          Effect.flatMap(DatabaseWriter, (writer) =>
            writer.table("tenantVisits").delete(visit.id)
          )
        );
        const missing = yield* fixture
          .as("admin")
          .mutation(approve, {
            slug: nf,
            visitId: visit.id,
          })
          .pipe(Effect.flip);
        expect(missing).toMatchObject({
          _tag: "AccessDenied",
          reason: "resource",
        });
      })
  );
});

describe("operators/visits list", () => {
  it.effect(
    "lists only the school's requests that are still pending, to its Admin",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const waiting = yield* operatorAccount(fixture, "waiting");
        const answered = yield* operatorAccount(fixture, "answered");
        const open = yield* waiting.client.mutation(requestVisit, {
          minutes: 60,
          note: "Menunggu",
          reason: "support",
          tenantId: fixture.tenants.nf,
        });
        const approved = yield* answered.client.mutation(requestVisit, {
          minutes: 60,
          note: "Sudah",
          reason: "support",
          tenantId: fixture.tenants.nf,
        });
        yield* fixture.as("admin").mutation(approve, {
          slug: nf,
          visitId: approved.id,
        });
        const page = yield* fixture.as("admin").query(listVisits, {
          paginationOpts: { cursor: null, numItems: 10 },
          slug: nf,
        });
        expect(Arr.map(page.page, (visit) => visit.id)).toEqual([open.id]);
        const denial = yield* fixture
          .as("auditor")
          .query(listVisits, {
            paginationOpts: { cursor: null, numItems: 10 },
            slug: nf,
          })
          .pipe(Effect.flip);
        expect(denial).toMatchObject({ _tag: "AccessDenied", reason: "role" });
      })
  );
});
