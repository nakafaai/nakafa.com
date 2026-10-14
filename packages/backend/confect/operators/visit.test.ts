import { beforeEach, describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import {
  grantsOf,
  operatorAccount,
  personOf,
} from "@repo/backend/test/operators";
import {
  journal,
  slugOf,
  suspend,
  TENANCY_NOW,
  tenancyFixture,
} from "@repo/backend/test/tenancy";
import { Array as Arr, Effect } from "effect";

const nf = slugOf("nf");
const requestVisit = refs.public.operators.visits.request;
const approve = refs.public.operators.visits.approve;
const decline = refs.public.operators.visits.decline;
const endVisit = refs.public.operators.visits.end;
const viewer = refs.public.tenancy.viewer.get;
const createPerson = refs.public.tenancy.people.create;

/** Fake timers make every change time the test sets, so each state shows it. */
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(TENANCY_NOW);
});

describe("operators/visit end", () => {
  it.effect(
    "ends a visit the operator leaves: its grant and Person end, and access stops at once",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const staff = yield* operatorAccount(fixture, "leaves");
        const visit = yield* staff.client.mutation(requestVisit, {
          minutes: 60,
          note: "Pulang",
          reason: "support",
          tenantId: fixture.tenants.nf,
        });
        yield* fixture.as("admin").mutation(approve, {
          slug: nf,
          visitId: visit.id,
        });
        const person = yield* personOf(fixture, staff.userId);
        const ended = yield* staff.client.mutation(endVisit, {
          slug: nf,
          visitId: visit.id,
        });
        expect(ended.state).toEqual({
          at: TENANCY_NOW,
          reason: "left",
          status: "ended",
        });
        expect(yield* grantsOf(fixture, person._id)).toEqual([]);
        expect(yield* fixture.run(journal)).toMatchObject([
          { change: { type: "visit.requested" } },
          { change: { type: "person.created" } },
          { change: { method: "operator", type: "person.claimed" } },
          { change: { type: "grant.created" } },
          { change: { type: "visit.approved" } },
          {
            actor: { id: person._id, kind: "person" },
            change: { reason: "left", type: "grant.ended" },
            subject: { id: person._id, kind: "person" },
          },
          {
            actor: { id: person._id, kind: "person" },
            change: { type: "person.suspended" },
            subject: { id: person._id, kind: "person" },
          },
          {
            actor: { id: person._id, kind: "person" },
            change: { reason: "left", type: "visit.ended" },
            subject: { id: visit.id, kind: "visit" },
          },
        ]);
        const denial = yield* staff.client
          .query(viewer, { slug: nf })
          .pipe(Effect.flip);
        expect(denial).toMatchObject({ _tag: "NotMember" });
      })
  );

  it.effect(
    "lets the school end a visit while the school is suspended, and journals the Owner or Admin who ended it",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const staff = yield* operatorAccount(fixture, "ended");
        const visit = yield* staff.client.mutation(requestVisit, {
          minutes: 60,
          note: "Dihentikan",
          reason: "incident",
          tenantId: fixture.tenants.nf,
        });
        yield* fixture.as("admin").mutation(approve, {
          slug: nf,
          visitId: visit.id,
        });
        yield* fixture.run(suspend(fixture.tenants.nf));
        const ended = yield* fixture.as("admin").mutation(endVisit, {
          slug: nf,
          visitId: visit.id,
        });
        expect(ended.state).toMatchObject({
          reason: "revoked",
          status: "ended",
        });
        expect(Arr.takeRight(yield* fixture.run(journal), 1)).toMatchObject([
          {
            actor: { id: fixture.people.admin.personId, kind: "person" },
            change: { reason: "revoked", type: "visit.ended" },
            subject: { id: visit.id, kind: "visit" },
          },
        ]);
      })
  );

  it.effect("returns an ended visit as it is when it is ended again", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const staff = yield* operatorAccount(fixture, "again");
      const visit = yield* staff.client.mutation(requestVisit, {
        minutes: 60,
        note: "Lagi",
        reason: "support",
        tenantId: fixture.tenants.nf,
      });
      yield* fixture.as("admin").mutation(approve, {
        slug: nf,
        visitId: visit.id,
      });
      const first = yield* staff.client.mutation(endVisit, {
        slug: nf,
        visitId: visit.id,
      });
      const before = (yield* fixture.run(journal)).length;
      // The operator's Person is suspended now, so the school's Admin ends it again.
      const second = yield* fixture.as("admin").mutation(endVisit, {
        slug: nf,
        visitId: visit.id,
      });
      expect(second).toEqual(first);
      expect((yield* fixture.run(journal)).length).toBe(before);
    })
  );

  it.effect("refuses to end a visit the school never approved", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const staff = yield* operatorAccount(fixture, "unapproved");
      const visit = yield* staff.client.mutation(requestVisit, {
        minutes: 60,
        note: "Belum",
        reason: "support",
        tenantId: fixture.tenants.nf,
      });
      const denial = yield* fixture
        .as("admin")
        .mutation(endVisit, {
          slug: nf,
          visitId: visit.id,
        })
        .pipe(Effect.flip);
      expect(denial).toMatchObject({ _tag: "VisitNotApproved" });
    })
  );

  it.effect(
    "lets the operator read the school only between approval and end, and never write it",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const staff = yield* operatorAccount(fixture, "reader");
        const visit = yield* staff.client.mutation(requestVisit, {
          minutes: 60,
          note: "Membaca",
          reason: "support",
          tenantId: fixture.tenants.nf,
        });
        const before = yield* staff.client
          .query(viewer, { slug: nf })
          .pipe(Effect.flip);
        yield* fixture.as("admin").mutation(approve, {
          slug: nf,
          visitId: visit.id,
        });
        const during = yield* staff.client.query(viewer, { slug: nf });
        expect(during.can).toEqual(
          expect.arrayContaining(["audit.view", "person.view", "tenant.view"])
        );
        const refused = yield* staff.client
          .mutation(createPerson, { name: "Siswa Baru", slug: nf })
          .pipe(Effect.flip);
        expect(refused).toMatchObject({
          _tag: "AccessDenied",
          reason: "role",
        });
        yield* staff.client.mutation(endVisit, { slug: nf, visitId: visit.id });
        const after = yield* staff.client
          .query(viewer, { slug: nf })
          .pipe(Effect.flip);
        expect([before._tag, after._tag]).toEqual(["NotMember", "NotMember"]);
      })
  );
});

describe("operators/visit admit", () => {
  it.effect("reactivates the operator's own Person for its next visit", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const staff = yield* operatorAccount(fixture, "returns");
      const first = yield* staff.client.mutation(requestVisit, {
        minutes: 60,
        note: "Pertama",
        reason: "support",
        tenantId: fixture.tenants.nf,
      });
      yield* fixture.as("admin").mutation(approve, {
        slug: nf,
        visitId: first.id,
      });
      const earlier = yield* personOf(fixture, staff.userId);
      yield* staff.client.mutation(endVisit, { slug: nf, visitId: first.id });
      const second = yield* staff.client.mutation(requestVisit, {
        minutes: 30,
        note: "Kedua",
        reason: "incident",
        tenantId: fixture.tenants.nf,
      });
      yield* fixture.as("admin").mutation(approve, {
        slug: nf,
        visitId: second.id,
      });
      const later = yield* personOf(fixture, staff.userId);
      expect(later).toMatchObject({ _id: earlier._id, status: "active" });
      expect(yield* fixture.run(journal)).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            change: { type: "person.reactivated" },
            subject: { id: earlier._id, kind: "person" },
          }),
        ])
      );
    })
  );
});

describe("operators/visit decline", () => {
  it.effect(
    "declines a requested visit, journals it, and lets the operator ask again",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const staff = yield* operatorAccount(fixture, "declined");
        const visit = yield* staff.client.mutation(requestVisit, {
          minutes: 60,
          note: "Ditolak",
          reason: "support",
          tenantId: fixture.tenants.nf,
        });
        const declined = yield* fixture.as("admin").mutation(decline, {
          slug: nf,
          visitId: visit.id,
        });
        expect(declined.state).toEqual({ at: TENANCY_NOW, status: "declined" });
        expect(yield* fixture.run(journal)).toMatchObject([
          { change: { type: "visit.requested" } },
          {
            actor: { id: fixture.people.admin.personId, kind: "person" },
            change: { type: "visit.declined" },
            subject: { id: visit.id, kind: "visit" },
          },
        ]);
        const again = yield* fixture
          .as("admin")
          .mutation(decline, {
            slug: nf,
            visitId: visit.id,
          })
          .pipe(Effect.flip);
        expect(again).toMatchObject({ _tag: "VisitNotPending" });
        const next = yield* staff.client.mutation(requestVisit, {
          minutes: 60,
          note: "Lagi",
          reason: "support",
          tenantId: fixture.tenants.nf,
        });
        expect(next.state).toEqual({ status: "pending" });
      })
  );
});
