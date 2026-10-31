import type { GenericId } from "@confect/core";
import refs from "@repo/backend/confect/_generated/refs";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import type { WebhookChanges } from "@repo/backend/confect/integrations/hook";
import { cursorOf } from "@repo/backend/confect/journal/store";
import { systemActor } from "@repo/backend/confect/tenancy/actor";
import { unitAuthority } from "@repo/backend/confect/tenancy/authority";
import { createTenantKey } from "@repo/backend/confect/vault/keys";
import {
  scheduledJobs,
  slugOf,
  type tenancyFixture,
} from "@repo/backend/test/tenancy";
import { Array as Arr, Effect, Option } from "effect";

export type Fixture = Effect.Success<typeof tenancyFixture>;
type DeliveryId = GenericId.GenericId<"integrationDeliveries">;

export const nf = slugOf("nf");
export const RECEIVER = "https://93.184.216.34/hook";

const clients = refs.public.integrations.clients;
const webhooks = refs.public.integrations.webhooks;
const { run } = refs.internal.integrations.hooks;

/** A client that reads units and people, and its webhook of `changes`. */
export const seeded = Effect.fn("test.hooks.seeded")(function* (
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
export const unitChange = (
  fixture: Fixture,
  type: "unit.archived" | "unit.created"
) =>
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
export const attempts = (
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
export const firstAttempt = Effect.fn("test.hooks.first")(function* (
  fixture: Fixture,
  webhookId: GenericId.GenericId<"integrationWebhooks">
) {
  yield* unitChange(fixture, "unit.created");
  yield* fixture.internal.mutation(run, { webhookId });
  const rows = yield* attempts(fixture, webhookId);
  return Option.getOrThrow(Arr.last(rows))._id;
});

/** Scheduled functions of one name, by the end of their path. */
export const jobsOf = (fixture: Fixture, name: string) =>
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

/** A webhook's journal cursor, which leaves the test's transaction as its plain row. */
export const cursorRow = (
  fixture: Fixture,
  webhookId: GenericId.GenericId<"integrationWebhooks">
) =>
  fixture.run(
    Effect.map(cursorOf(webhookId, fixture.tenants.nf, null), Option.getOrNull)
  );

/** Reads one attempt's state. */
export const stateOf = (fixture: Fixture, deliveryId: DeliveryId) =>
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
