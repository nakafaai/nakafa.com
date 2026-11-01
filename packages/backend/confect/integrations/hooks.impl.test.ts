import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import { DatabaseWriter } from "@repo/backend/confect/_generated/services";
import { DELIVERY_RETENTION } from "@repo/backend/confect/integrations/hook";
import {
  attempts,
  cursorRow,
  firstAttempt,
  jobsOf,
  nf,
  RECEIVER,
  seeded,
  stateOf,
  unitChange,
} from "@repo/backend/test/hooks";
import { TENANCY_NOW, tenancyFixture } from "@repo/backend/test/tenancy";
import { Array as Arr, Duration, Effect, Option } from "effect";

/** The fetch that delivery calls, stubbed once for the file. */
const fetcher = vi.fn<typeof fetch>();
vi.stubGlobal("fetch", fetcher);

const webhooks = refs.public.integrations.webhooks;
const { deliver, prepare, prune, run, settle, sweep } =
  refs.internal.integrations.hooks;

/** Fake timers keep every scheduled run from starting before the test looks at it. */
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(TENANCY_NOW);
});

afterEach(() => {
  fetcher.mockReset();
});

describe("integrations/hooks run", () => {
  it.effect(
    "writes one first attempt for a carried change and only moves past the rest",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const { webhookId } = yield* seeded(fixture);
        const carried = yield* unitChange(fixture, "unit.created");
        yield* unitChange(fixture, "unit.archived");

        yield* fixture.internal.mutation(run, { webhookId });
        yield* fixture.internal.mutation(run, { webhookId });

        const rows = yield* attempts(fixture, webhookId);
        expect(rows).toHaveLength(1);
        expect(rows[0]).toMatchObject({
          attempt: 1,
          change: "unit.created",
          entryId: carried,
          state: { status: "due" },
        });
        const cursor = yield* cursorRow(fixture, webhookId);
        expect(cursor?.pending).toBe(false);
        expect(yield* jobsOf(fixture, ":deliver")).toHaveLength(1);
      })
  );

  it.effect("schedules the next run while entries are left unread", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const { webhookId } = yield* seeded(fixture);
      yield* Effect.forEach(
        Arr.range(1, 51),
        () => unitChange(fixture, "unit.created"),
        { discard: true }
      );

      yield* fixture.internal.mutation(run, { webhookId });

      // The page of 50 begins with the three changes that set the webhook up, which it does not carry.
      expect(yield* attempts(fixture, webhookId)).toHaveLength(47);
      const cursor = yield* cursorRow(fixture, webhookId);
      expect(cursor?.pending).toBe(true);
      expect(yield* jobsOf(fixture, ":run")).toHaveLength(1);
    })
  );

  it.effect("does nothing for a webhook that has ended", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const { clientId, webhookId } = yield* seeded(fixture);
      yield* unitChange(fixture, "unit.created");
      yield* fixture
        .as("admin")
        .mutation(webhooks.revoke, { clientId, slug: nf, webhookId });

      yield* fixture.internal.mutation(run, { webhookId });

      expect(yield* attempts(fixture, webhookId)).toEqual([]);
    })
  );
});

describe("integrations/hooks sweep", () => {
  it.effect("starts a run only for a webhook with unread changes", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const { webhookId } = yield* seeded(fixture);

      // The first run reads the changes that set the webhook up.
      vi.advanceTimersByTime(Duration.toMillis(Duration.seconds(6)));
      yield* fixture.internal.mutation(run, { webhookId });
      yield* fixture.internal.mutation(sweep, { cursor: null });
      expect(yield* jobsOf(fixture, ":run")).toEqual([]);

      yield* unitChange(fixture, "unit.created");
      yield* fixture.internal.mutation(sweep, { cursor: null });
      expect(yield* jobsOf(fixture, ":run")).toHaveLength(1);

      yield* fixture.internal.mutation(run, { webhookId });
      vi.advanceTimersByTime(Duration.toMillis(Duration.seconds(6)));
      yield* fixture.internal.mutation(run, { webhookId });
      yield* fixture.internal.mutation(sweep, { cursor: null });
      expect(yield* jobsOf(fixture, ":run")).toHaveLength(1);
    })
  );

  it.effect("sends again an attempt whose scheduled delivery was lost", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const { webhookId } = yield* seeded(fixture);
      yield* firstAttempt(fixture, webhookId);
      expect(yield* jobsOf(fixture, ":deliver")).toHaveLength(1);

      vi.advanceTimersByTime(Duration.toMillis(Duration.minutes(6)));
      yield* fixture.internal.mutation(sweep, { cursor: null });

      expect(yield* jobsOf(fixture, ":deliver")).toHaveLength(2);
    })
  );

  it.effect("skips a webhook whose cursor is gone", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const { webhookId } = yield* seeded(fixture);
      const cursor = yield* cursorRow(fixture, webhookId);
      yield* fixture.run(
        Effect.flatMap(DatabaseWriter, (writer) =>
          writer
            .table("journalCursors")
            .delete(Option.getOrThrow(Option.fromNullOr(cursor))._id)
            .pipe(Effect.orDie)
        )
      );
      yield* unitChange(fixture, "unit.created");

      yield* fixture.internal.mutation(sweep, { cursor: null });

      expect(yield* jobsOf(fixture, ":run")).toEqual([]);
    })
  );

  it.effect("continues past a full page in a sweep of its own", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const { clientId } = yield* seeded(fixture);
      yield* fixture.run(
        Effect.flatMap(DatabaseWriter, (writer) =>
          Effect.forEach(
            Arr.range(1, 100),
            () =>
              writer
                .table("integrationWebhooks")
                .insert({
                  changes: ["unit.created"],
                  clientId,
                  revokedAt: null,
                  rotatedAt: TENANCY_NOW,
                  secret: new ArrayBuffer(8),
                  status: "active",
                  tenantId: fixture.tenants.nf,
                  url: RECEIVER,
                })
                .pipe(Effect.orDie),
            { discard: true }
          )
        )
      );

      yield* fixture.internal.mutation(sweep, { cursor: null });

      expect(yield* jobsOf(fixture, ":sweep")).toHaveLength(1);
    })
  );
});

describe("integrations/hooks prepare", () => {
  it.effect("reads the event and the secret of an attempt that is due", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const { webhookId } = yield* seeded(fixture);
      const deliveryId = yield* firstAttempt(fixture, webhookId);

      const prepared = yield* fixture.internal.query(prepare, { deliveryId });

      expect(prepared).toMatchObject({
        attempt: 1,
        outcome: "send",
        type: "unit.created",
        url: RECEIVER,
      });
    })
  );

  it.effect("drops an attempt of a webhook that has ended", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const { clientId, webhookId } = yield* seeded(fixture);
      const deliveryId = yield* firstAttempt(fixture, webhookId);
      yield* fixture
        .as("admin")
        .mutation(webhooks.revoke, { clientId, slug: nf, webhookId });

      expect(yield* fixture.internal.query(prepare, { deliveryId })).toEqual({
        outcome: "drop",
        reason: "revoked",
      });
    })
  );

  it.effect(
    "drops an attempt once the client may no longer read its subject",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const { clientId, webhookId } = yield* seeded(fixture);
        const deliveryId = yield* firstAttempt(fixture, webhookId);
        yield* fixture.run(
          Effect.flatMap(DatabaseWriter, (writer) =>
            writer
              .table("integrationClients")
              .patch(clientId, { actions: ["person.view"] })
              .pipe(Effect.orDie)
          )
        );

        expect(yield* fixture.internal.query(prepare, { deliveryId })).toEqual({
          outcome: "drop",
          reason: "access",
        });
      })
  );

  it.effect("sends nothing for an attempt that is settled", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const { webhookId } = yield* seeded(fixture);
      const deliveryId = yield* firstAttempt(fixture, webhookId);
      yield* fixture.internal.mutation(settle, {
        deliveryId,
        outcome: { code: 200, ms: 5, status: "delivered" },
      });

      expect(yield* fixture.internal.query(prepare, { deliveryId })).toEqual({
        outcome: "settled",
      });
    })
  );
});

describe("integrations/hooks deliver", () => {
  it.effect("posts the event of a change and settles it delivered", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const { webhookId } = yield* seeded(fixture);
      const deliveryId = yield* firstAttempt(fixture, webhookId);
      fetcher.mockResolvedValue(new Response(null, { status: 200 }));

      yield* fixture.internal.action(deliver, { deliveryId });

      expect(yield* stateOf(fixture, deliveryId)).toMatchObject({
        code: 200,
        status: "delivered",
      });
      const [, init] = fetcher.mock.calls[0] ?? [];
      expect(String(init?.body)).toContain('"type":"unit.created"');
      expect(String(init?.body)).toContain('"kind":"unit"');
    })
  );

  it.effect("schedules the next attempt after a failure", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const { webhookId } = yield* seeded(fixture);
      const deliveryId = yield* firstAttempt(fixture, webhookId);
      fetcher.mockResolvedValue(new Response(null, { status: 500 }));

      yield* fixture.internal.action(deliver, { deliveryId });

      const rows = yield* attempts(fixture, webhookId);
      expect(Arr.map(rows, (row) => row.attempt)).toEqual([1, 2]);
      expect(rows[0]?.state).toMatchObject({
        code: 500,
        reason: "status",
        status: "failed",
      });
      expect(rows[1]).toMatchObject({
        entryId: rows[0]?.entryId,
        state: { status: "due" },
      });
    })
  );

  it.effect("drops an attempt it may not send, with no request", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const { clientId, webhookId } = yield* seeded(fixture);
      const deliveryId = yield* firstAttempt(fixture, webhookId);
      yield* fixture
        .as("admin")
        .mutation(webhooks.revoke, { clientId, slug: nf, webhookId });

      yield* fixture.internal.action(deliver, { deliveryId });

      expect(yield* stateOf(fixture, deliveryId)).toMatchObject({
        reason: "revoked",
        status: "dropped",
      });
      expect(fetcher).not.toHaveBeenCalled();
    })
  );

  it.effect("does nothing for an attempt that is settled", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const { webhookId } = yield* seeded(fixture);
      const deliveryId = yield* firstAttempt(fixture, webhookId);
      yield* fixture.internal.mutation(settle, {
        deliveryId,
        outcome: { code: 200, ms: 5, status: "delivered" },
      });

      yield* fixture.internal.action(deliver, { deliveryId });

      expect(fetcher).not.toHaveBeenCalled();
    })
  );
});

describe("integrations/hooks settle", () => {
  it.effect("keeps the first outcome of an attempt", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const { webhookId } = yield* seeded(fixture);
      const deliveryId = yield* firstAttempt(fixture, webhookId);
      const failed = {
        code: 500,
        ms: 5,
        reason: "status",
        status: "failed",
      } as const;

      yield* fixture.internal.mutation(settle, {
        deliveryId,
        outcome: { code: 200, ms: 5, status: "delivered" },
      });
      yield* fixture.internal.mutation(settle, { deliveryId, outcome: failed });

      expect(yield* stateOf(fixture, deliveryId)).toMatchObject({
        status: "delivered",
      });
      expect(yield* attempts(fixture, webhookId)).toHaveLength(1);
    })
  );

  it.effect("stops after the eighth attempt", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const { webhookId } = yield* seeded(fixture);
      const deliveryId = yield* firstAttempt(fixture, webhookId);
      yield* fixture.run(
        Effect.flatMap(DatabaseWriter, (writer) =>
          writer
            .table("integrationDeliveries")
            .patch(deliveryId, { attempt: 8 })
            .pipe(Effect.orDie)
        )
      );

      yield* fixture.internal.mutation(settle, {
        deliveryId,
        outcome: { code: 500, ms: 5, reason: "status", status: "failed" },
      });

      expect(yield* attempts(fixture, webhookId)).toHaveLength(1);
    })
  );
});

describe("integrations/hooks prune", () => {
  it.effect("deletes only the attempts past the log's retention", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const { webhookId } = yield* seeded(fixture);
      yield* firstAttempt(fixture, webhookId);

      yield* fixture.internal.mutation(prune, {});
      expect(yield* attempts(fixture, webhookId)).toHaveLength(1);

      vi.advanceTimersByTime(
        Duration.toMillis(Duration.sum(DELIVERY_RETENTION, Duration.days(1)))
      );
      yield* fixture.internal.mutation(prune, {});
      expect(yield* attempts(fixture, webhookId)).toEqual([]);
    })
  );

  it.effect("continues past a full page in a prune of its own", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const { webhookId } = yield* seeded(fixture);
      const entryId = yield* unitChange(fixture, "unit.created");
      yield* fixture.run(
        Effect.flatMap(DatabaseWriter, (writer) =>
          Effect.forEach(
            Arr.range(1, 500),
            () =>
              writer
                .table("integrationDeliveries")
                .insert({
                  attempt: 1,
                  change: "unit.created",
                  dueAt: TENANCY_NOW,
                  entryId,
                  state: { status: "due" },
                  tenantId: fixture.tenants.nf,
                  webhookId,
                })
                .pipe(Effect.orDie),
            { discard: true }
          )
        )
      );
      vi.advanceTimersByTime(
        Duration.toMillis(Duration.sum(DELIVERY_RETENTION, Duration.days(1)))
      );

      yield* fixture.internal.mutation(prune, {});

      expect(yield* jobsOf(fixture, ":prune")).toHaveLength(1);
    })
  );
});
