import { beforeEach, describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import { DatabaseWriter } from "@repo/backend/confect/_generated/services";
import { operatorAccount } from "@repo/backend/test/operators";
import {
  slugOf,
  TENANCY_NOW,
  tenancyFixture,
} from "@repo/backend/test/tenancy";
import { Effect } from "effect";

const grant = refs.internal.operators.staff.grant;
const revoke = refs.internal.operators.staff.revoke;
const request = refs.public.operators.visits.request;
const approve = refs.public.operators.visits.approve;
const viewer = refs.public.tenancy.viewer.get;
const nf = slugOf("nf");

/** Fake timers make every change time the test sets, so each row shows it. */
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(TENANCY_NOW);
});

describe("operators/staff grant", () => {
  it.effect(
    "grants operator access once, and returns the active row again unchanged",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const account = yield* fixture.account(
          "grantee",
          "grantee@nakafa.example.test",
          true
        );
        const first = yield* fixture.internal.mutation(grant, {
          userId: account.userId,
        });
        vi.setSystemTime(TENANCY_NOW + 1000);
        const again = yield* fixture.internal.mutation(grant, {
          userId: account.userId,
        });
        expect(first).toMatchObject({
          changedAt: TENANCY_NOW,
          grantedAt: TENANCY_NOW,
          status: "active",
          userId: account.userId,
        });
        expect(again).toEqual(first);
      })
  );

  it.effect("grants a revoked account again and moves both change times", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const staff = yield* operatorAccount(fixture, "returning");
      yield* fixture.internal.mutation(revoke, { userId: staff.userId });
      vi.setSystemTime(TENANCY_NOW + 1000);
      const regranted = yield* fixture.internal.mutation(grant, {
        userId: staff.userId,
      });
      expect(regranted).toMatchObject({
        changedAt: TENANCY_NOW + 1000,
        grantedAt: TENANCY_NOW + 1000,
        status: "active",
      });
    })
  );

  it.effect("refuses an account ID that names no account", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const account = yield* fixture.account(
        "removed",
        "removed@nakafa.example.test",
        true
      );
      yield* fixture.run(
        Effect.flatMap(DatabaseWriter, (writer) =>
          writer.table("users").delete(account.userId)
        )
      );
      const denial = yield* fixture.internal
        .mutation(grant, { userId: account.userId })
        .pipe(Effect.flip);
      expect(denial).toMatchObject({
        _tag: "AccountNotFound",
        code: "ACCOUNT_NOT_FOUND",
      });
    })
  );
});

describe("operators/staff revoke", () => {
  it.effect("refuses a revoked operator every operator command", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const staff = yield* operatorAccount(fixture, "leaving");
      const revoked = yield* fixture.internal.mutation(revoke, {
        userId: staff.userId,
      });
      expect(revoked).toMatchObject({
        changedAt: TENANCY_NOW,
        status: "revoked",
      });
      const denial = yield* staff.client
        .mutation(request, {
          minutes: 60,
          note: "Kunjungan",
          reason: "support",
          tenantId: fixture.tenants.nf,
        })
        .pipe(Effect.flip);
      expect(denial).toMatchObject({
        _tag: "NotOperator",
        code: "NOT_OPERATOR",
      });
    })
  );

  it.effect(
    "refuses a revoked operator inside a school at once, before its visit's term ends",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const staff = yield* operatorAccount(fixture, "inside");
        const visit = yield* staff.client.mutation(request, {
          minutes: 60,
          note: "Di dalam sekolah",
          reason: "support",
          tenantId: fixture.tenants.nf,
        });
        yield* fixture.as("admin").mutation(approve, {
          slug: nf,
          visitId: visit.id,
        });
        yield* fixture.internal.mutation(revoke, { userId: staff.userId });
        const denial = yield* staff.client
          .query(viewer, { slug: nf })
          .pipe(Effect.flip);
        expect(denial).toMatchObject({ _tag: "NotMember", code: "NOT_MEMBER" });
      })
  );

  it.effect("returns a revoked row as it is when it is revoked again", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const staff = yield* operatorAccount(fixture, "twice");
      const first = yield* fixture.internal.mutation(revoke, {
        userId: staff.userId,
      });
      vi.setSystemTime(TENANCY_NOW + 5000);
      const again = yield* fixture.internal.mutation(revoke, {
        userId: staff.userId,
      });
      expect(again).toEqual(first);
    })
  );

  it.effect("refuses to revoke an account that was never an operator", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const learner = yield* fixture.account(
        "learner",
        "learner@nakafa.example.test",
        true
      );
      const denial = yield* fixture.internal
        .mutation(revoke, { userId: learner.userId })
        .pipe(Effect.flip);
      expect(denial).toMatchObject({ _tag: "NotOperator" });
    })
  );

  it.effect(
    "keeps a learner with the onboarding role teacher out of operator access",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const learner = yield* fixture.account(
          "onboarded",
          "onboarded@nakafa.example.test",
          true
        );
        yield* fixture.run(
          Effect.flatMap(DatabaseWriter, (writer) =>
            writer.table("users").patch(learner.userId, { role: "teacher" })
          )
        );
        const denial = yield* learner.client
          .mutation(request, {
            minutes: 60,
            note: "Kunjungan",
            reason: "support",
            tenantId: fixture.tenants.nf,
          })
          .pipe(Effect.flip);
        expect(denial).toMatchObject({ _tag: "NotOperator" });
      })
  );
});
