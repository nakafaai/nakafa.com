import type { GenericId } from "@confect/core";
import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import { Id } from "@repo/backend/confect/_generated/id";
import refs from "@repo/backend/confect/_generated/refs";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import {
  DELIVERY_RETENTION,
  type WebhookChanges,
} from "@repo/backend/confect/integrations/hook";
import { readsSubject } from "@repo/backend/confect/integrations/subject";
import { cursorOf } from "@repo/backend/confect/journal/store";
import { systemActor } from "@repo/backend/confect/tenancy/actor";
import { unitAuthority } from "@repo/backend/confect/tenancy/authority";
import { createTenantKey } from "@repo/backend/confect/vault/keys";
import {
  scheduledJobs,
  slugOf,
  TENANCY_NOW,
  tenancyFixture,
} from "@repo/backend/test/tenancy";
import { Array as Arr, Duration, Effect, Option, Schema } from "effect";

/** The fetch that delivery calls, stubbed once for the file. */
const fetcher = vi.fn<typeof fetch>();
vi.stubGlobal("fetch", fetcher);

const nf = slugOf("nf");
const clients = refs.public.integrations.clients;
const webhooks = refs.public.integrations.webhooks;
const { deliver, prepare, prune, run, settle, sweep } =
  refs.internal.integrations.hooks;
const RECEIVER = "https://93.184.216.34/hook";
const goneGrade = Schema.decodeUnknownSync(Id("classGrades"))("1gone");
const goneLink = Schema.decodeUnknownSync(Id("guardianLinks"))("1gone");

type Fixture = Effect.Success<typeof tenancyFixture>;
type DeliveryId = GenericId.GenericId<"integrationDeliveries">;

/** Fake timers keep every scheduled run from starting before the test looks at it. */
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(TENANCY_NOW);
});

afterEach(() => {
  fetcher.mockReset();
});

/** A client that reads units and people, and its webhook of `changes`. */
const seeded = Effect.fn("test.hooks.seeded")(function* (
  fixture: Fixture,
  changes: typeof WebhookChanges.Type = ["unit.created"]
) {
  yield* fixture.run(createTenantKey(fixture.tenants.nf));
  const client = yield* fixture.as("admin").mutation(clients.create, {
    actions: ["person.view", "unit.view"],
    name: "Sinkron Harapan",
    scope: { kind: "tenant" },
    slug: nf,
  });
  const webhook = yield* fixture.as("admin").mutation(webhooks.create, {
    changes,
    clientId: client.id,
    slug: nf,
    url: RECEIVER,
  });
  return { clientId: client.id, webhookId: webhook.id };
});

/** Journals one change of the school's SMA unit, as the school's work does. */
const unitChange = (fixture: Fixture, type: "unit.archived" | "unit.created") =>
  fixture.run(
    Effect.gen(function* () {
      const unit = yield* (yield* DatabaseReader)
        .table("tenantUnits")
        .get(fixture.units.sma)
        .pipe(Effect.orDie);
      return yield* unitAuthority.record(systemActor, unit, { type });
    })
  );

/** The attempts of a webhook, oldest first. */
const attempts = (
  fixture: Fixture,
  webhookId: GenericId.GenericId<"integrationWebhooks">
) =>
  fixture.run(
    Effect.flatMap(DatabaseReader, (reader) =>
      reader
        .table("integrationDeliveries")
        .index("by_webhookId", (query) => query.eq("webhookId", webhookId))
        .take(50)
        .pipe(Effect.orDie)
    )
  );

/** One published change, run into its first attempt. */
const firstAttempt = Effect.fn("test.hooks.first")(function* (
  fixture: Fixture,
  webhookId: GenericId.GenericId<"integrationWebhooks">
) {
  yield* unitChange(fixture, "unit.created");
  yield* fixture.internal.mutation(run, { webhookId });
  const rows = yield* attempts(fixture, webhookId);
  return Option.getOrThrow(Arr.last(rows))._id;
});

/** Scheduled functions of one name, by the end of their path. */
const jobsOf = (fixture: Fixture, name: string) =>
  fixture
    .run(scheduledJobs)
    .pipe(
      Effect.map((jobs) =>
        Arr.filter(
          jobs,
          (job) =>
            job.name.startsWith("integrations/hooks") && job.name.endsWith(name)
        )
      )
    );

/** Reads one attempt's state. */
const stateOf = (fixture: Fixture, deliveryId: DeliveryId) =>
  fixture.run(
    Effect.flatMap(DatabaseReader, (reader) =>
      reader
        .table("integrationDeliveries")
        .get(deliveryId)
        .pipe(
          Effect.orDie,
          Effect.map((row) => row.state)
        )
    )
  );

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
        const cursor = yield* fixture.run(
          cursorOf(webhookId, fixture.tenants.nf, null)
        );
        expect(Option.getOrThrow(cursor).pending).toBe(false);
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

      expect(yield* attempts(fixture, webhookId)).toHaveLength(49);
      const cursor = yield* fixture.run(
        cursorOf(webhookId, fixture.tenants.nf, null)
      );
      expect(Option.getOrThrow(cursor).pending).toBe(true);
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
      const cursor = yield* fixture.run(
        cursorOf(webhookId, fixture.tenants.nf, null)
      );
      yield* fixture.run(
        Effect.flatMap(DatabaseWriter, (writer) =>
          writer
            .table("journalCursors")
            .delete(Option.getOrThrow(cursor)._id)
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

describe("readsSubject", () => {
  /** The client of a seeded webhook and its school, the principal of a delivery. */
  const principal = (
    fixture: Fixture,
    clientId: GenericId.GenericId<"integrationClients">
  ) =>
    fixture.run(
      Effect.gen(function* () {
        const reader = yield* DatabaseReader;
        const client = yield* reader
          .table("integrationClients")
          .get(clientId)
          .pipe(Effect.orDie);
        const tenant = yield* reader
          .table("tenants")
          .get(client.tenantId)
          .pipe(Effect.orDie);
        return { client, tenant };
      })
    );

  it.effect(
    "decides each kind that publishes through that kind's authority",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const { clientId } = yield* seeded(fixture);
        const read = yield* principal(fixture, clientId);
        const reads = (
          subject: Parameters<typeof readsSubject>[0]["subject"]
        ) => fixture.run(readsSubject({ subject }, read));

        expect(yield* reads({ id: fixture.units.sma, kind: "unit" })).toBe(
          true
        );
        expect(yield* reads({ id: fixture.people.admin.personId, kind: "person" })
        ).toBe(true);
      })
  );

  it.effect(
    "closes a subject that is gone, and a kind that publishes nothing",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const { clientId } = yield* seeded(fixture);
        const read = yield* principal(fixture, clientId);
        const reads = (
          subject: Parameters<typeof readsSubject>[0]["subject"]
        ) => fixture.run(readsSubject({ subject }, read));

        expect(yield* reads({ id: goneGrade, kind: "grade" })).toBe(false);
        expect(yield* reads({ id: goneLink, kind: "guardianLink" })).toBe(
          false
        );
        expect(yield* reads({ id: clientId, kind: "integration" })).toBe(false);
      })
  );
});
