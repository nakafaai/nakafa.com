import type { GenericId } from "@confect/core";
import { beforeEach, describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import { WEBHOOK_LIMIT } from "@repo/backend/confect/integrations/hook";
import { openSecret } from "@repo/backend/confect/integrations/webhook";
import { cursorOf } from "@repo/backend/confect/journal/store";
import { createTenantKey } from "@repo/backend/confect/vault/keys";
import {
  journal,
  slugOf,
  TENANCY_NOW,
  tenancyFixture,
} from "@repo/backend/test/tenancy";
import { Array as Arr, Effect, Option } from "effect";

const nf = slugOf("nf");
const other = slugOf("other");
const clients = refs.public.integrations.clients;
const { change, create, deliveries, list, resend, revoke, rotate } =
  refs.public.integrations.webhooks;
const firstPage = { paginationOpts: { cursor: null, numItems: 10 } };
const RECEIVER = "https://93.184.216.34/hook";

type Fixture = Effect.Success<typeof tenancyFixture>;

/** Fake timers keep every scheduled delivery from starting before the test looks at it. */
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(TENANCY_NOW);
});

/** A client of the school that reads units, and its webhook. */
const seeded = Effect.fn("test.webhooks.seeded")(function* (fixture: Fixture) {
  yield* fixture.run(createTenantKey(fixture.tenants.nf));
  const client = yield* fixture.as("admin").mutation(clients.create, {
    actions: ["unit.view"],
    name: "Sinkron Harapan",
    scope: { kind: "tenant" },
    slug: nf,
  });
  const webhook = yield* fixture.as("admin").mutation(create, {
    changes: ["unit.created"],
    clientId: client.id,
    slug: nf,
    url: RECEIVER,
  });
  return { clientId: client.id, webhook };
});

/** One stored webhook, read inside the fixture. */
const stored = (webhookId: GenericId.GenericId<"integrationWebhooks">) =>
  Effect.flatMap(DatabaseReader, (reader) =>
    reader.table("integrationWebhooks").get(webhookId).pipe(Effect.orDie)
  );

/** Writes one attempt of a webhook directly, as a run does. */
const attempted = (
  fixture: Fixture,
  webhookId: GenericId.GenericId<"integrationWebhooks">,
  entryId: GenericId.GenericId<"journalEntries">
) =>
  fixture.run(
    Effect.flatMap(DatabaseWriter, (writer) =>
      writer.table("integrationDeliveries").insert({
        attempt: 1,
        change: "unit.created",
        dueAt: TENANCY_NOW,
        entryId,
        state: {
          at: TENANCY_NOW,
          code: 500,
          ms: 12,
          reason: "status",
          status: "failed",
        },
        tenantId: fixture.tenants.nf,
        webhookId,
      })
    )
  );

/** The newest journal entry, the subject of an attempt a test writes. */
const lastEntry = (fixture: Fixture) =>
  fixture
    .run(journal)
    .pipe(Effect.map((entries) => Option.getOrThrow(Arr.last(entries))._id));

describe("integrations/webhooks create", () => {
  it.effect(
    "seals the secret, shows it once, starts a cursor, and journals IDs only",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const { clientId, webhook } = yield* seeded(fixture);

        const row = yield* fixture.run(stored(webhook.id));
        expect(row.status).toBe("active");
        expect(row.secret).toBeInstanceOf(ArrayBuffer);
        const opened = yield* fixture.run(
          Effect.gen(function* () {
            const sealed = Option.getOrThrow(Option.fromNullOr(row.secret));
            return yield* openSecret(row, sealed);
          })
        );
        expect(opened).toBe(webhook.secret);

        const cursor = yield* fixture.run(
          cursorOf(webhook.id, fixture.tenants.nf, null)
        );
        expect(Option.getOrThrow(cursor)).toMatchObject({
          changeType: null,
          handled: [],
          pending: false,
        });
        const entries = yield* fixture.run(journal);
        expect(Option.getOrThrow(Arr.last(entries)).change).toEqual({
          client: clientId,
          type: "integration.webhook.created",
          webhook: webhook.id,
        });
      })
  );

  it.effect(
    "refuses a change the client's action list does not open, and writes nothing",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const { clientId } = yield* seeded(fixture);

        const refused = yield* fixture
          .as("admin")
          .mutation(create, {
            changes: ["grade.released"],
            clientId,
            slug: nf,
            url: RECEIVER,
          })
          .pipe(Effect.flip);

        expect(refused).toMatchObject({ _tag: "ActionClosed" });
        const listed = yield* fixture
          .as("admin")
          .query(list, { ...firstPage, slug: nf });
        expect(listed.page).toHaveLength(1);
      })
  );

  it.effect("refuses more webhooks than one client may hold", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const { clientId } = yield* seeded(fixture);
      const add = fixture.as("admin").mutation(create, {
        changes: ["unit.created"],
        clientId,
        slug: nf,
        url: RECEIVER,
      });
      yield* Effect.forEach(Arr.range(2, WEBHOOK_LIMIT), () => add, {
        discard: true,
      });

      expect(yield* Effect.flip(add)).toMatchObject({ _tag: "WebhookLimit" });
    })
  );

  it.effect("refuses a member who may not manage integrations", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const { clientId } = yield* seeded(fixture);

      const refused = yield* fixture
        .as("teacher")
        .mutation(create, {
          changes: ["unit.created"],
          clientId,
          slug: nf,
          url: RECEIVER,
        })
        .pipe(Effect.flip);

      expect(refused).toMatchObject({ _tag: "AccessDenied", reason: "role" });
    })
  );
});

describe("integrations/webhooks list", () => {
  it.effect(
    "lists the school's webhooks with their client's name and no secret",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const { clientId, webhook } = yield* seeded(fixture);

        const listed = yield* fixture
          .as("admin")
          .query(list, { ...firstPage, slug: nf });

        expect(listed.page).toEqual([
          expect.objectContaining({
            changes: ["unit.created"],
            clientId,
            clientName: "Sinkron Harapan",
            id: webhook.id,
            status: "active",
            url: RECEIVER,
          }),
        ]);
        expect(listed.page[0]).not.toHaveProperty("secret");
      })
  );
});

describe("integrations/webhooks change", () => {
  it.effect("changes the receiver and the changes of an active webhook", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const { clientId, webhook } = yield* seeded(fixture);
      const url = "https://93.184.216.35/hook";

      yield* fixture.as("admin").mutation(change, {
        changes: ["unit.created"],
        clientId,
        slug: nf,
        url,
        webhookId: webhook.id,
      });

      const row = yield* fixture.run(stored(webhook.id));
      expect(row.url).toBe(url);
    })
  );

  it.effect("refuses a change list the client does not open", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const { clientId, webhook } = yield* seeded(fixture);

      const refused = yield* fixture
        .as("admin")
        .mutation(change, {
          changes: ["grade.released"],
          clientId,
          slug: nf,
          url: RECEIVER,
          webhookId: webhook.id,
        })
        .pipe(Effect.flip);

      expect(refused).toMatchObject({ _tag: "ActionClosed" });
    })
  );

  it.effect("refuses an ended webhook", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const { clientId, webhook } = yield* seeded(fixture);
      const names = { clientId, slug: nf, webhookId: webhook.id };
      yield* fixture.as("admin").mutation(revoke, names);

      const refused = yield* fixture
        .as("admin")
        .mutation(change, {
          ...names,
          changes: ["unit.created"],
          url: RECEIVER,
        })
        .pipe(Effect.flip);

      expect(refused).toMatchObject({ reason: "condition" });
    })
  );
});

describe("integrations/webhooks rotate", () => {
  it.effect(
    "draws a new secret, shown once, that the old one no longer opens",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const { clientId, webhook } = yield* seeded(fixture);

        const rotated = yield* fixture
          .as("admin")
          .mutation(rotate, { clientId, slug: nf, webhookId: webhook.id });

        expect(rotated.id).toBe(webhook.id);
        expect(rotated.secret).not.toBe(webhook.secret);
        const row = yield* fixture.run(stored(webhook.id));
        const opened = yield* fixture.run(
          openSecret(row, Option.getOrThrow(Option.fromNullOr(row.secret)))
        );
        expect(opened).toBe(rotated.secret);
      })
  );
});

describe("integrations/webhooks revoke", () => {
  it.effect(
    "ends a webhook with its secret and cursor, and a retry succeeds",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const { clientId, webhook } = yield* seeded(fixture);
        const names = { clientId, slug: nf, webhookId: webhook.id };

        yield* fixture.as("admin").mutation(revoke, names);
        yield* fixture.as("admin").mutation(revoke, names);

        const row = yield* fixture.run(stored(webhook.id));
        expect(row).toMatchObject({ secret: null, status: "revoked" });
        const cursor = yield* fixture.run(
          cursorOf(webhook.id, fixture.tenants.nf, null)
        );
        expect(Option.isNone(cursor)).toBe(true);
        const entries = yield* fixture.run(journal);
        expect(
          Arr.filter(
            entries,
            (entry) => entry.change.type === "integration.webhook.revoked"
          )
        ).toHaveLength(1);
      })
  );

  it.effect(
    "ends with its client: revoking the client ends every webhook",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const { clientId, webhook } = yield* seeded(fixture);

        yield* fixture
          .as("admin")
          .mutation(clients.revoke, { clientId, slug: nf });

        const row = yield* fixture.run(stored(webhook.id));
        expect(row).toMatchObject({ secret: null, status: "revoked" });
      })
  );
});

describe("integrations/webhooks deliveries", () => {
  it.effect("lists the attempts of one webhook, newest first", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const { clientId, webhook } = yield* seeded(fixture);
      const entryId = yield* lastEntry(fixture);
      const first = yield* attempted(fixture, webhook.id, entryId);
      const second = yield* attempted(fixture, webhook.id, entryId);

      const log = yield* fixture.as("admin").query(deliveries, {
        ...firstPage,
        clientId,
        slug: nf,
        webhookId: webhook.id,
      });

      expect(Arr.map(log.page, (row) => row.id)).toEqual([second, first]);
      expect(log.page[0]).toMatchObject({
        attempt: 1,
        change: "unit.created",
        entryId,
        state: { code: 500, reason: "status", status: "failed" },
      });
    })
  );

  it.effect("refuses a webhook of another client", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const { webhook } = yield* seeded(fixture);
      const another = yield* fixture.as("admin").mutation(clients.create, {
        actions: ["unit.view"],
        name: "Lain",
        scope: { kind: "tenant" },
        slug: nf,
      });

      const refused = yield* fixture
        .as("admin")
        .query(deliveries, {
          ...firstPage,
          clientId: another.id,
          slug: nf,
          webhookId: webhook.id,
        })
        .pipe(Effect.flip);

      expect(refused).toMatchObject({
        _tag: "AccessDenied",
        reason: "resource",
      });
    })
  );
});

describe("integrations/webhooks resend", () => {
  it.effect("writes one more attempt of the same change, due at once", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const { clientId, webhook } = yield* seeded(fixture);
      const entryId = yield* lastEntry(fixture);
      const deliveryId = yield* attempted(fixture, webhook.id, entryId);

      yield* fixture.as("admin").mutation(resend, {
        clientId,
        deliveryId,
        slug: nf,
        webhookId: webhook.id,
      });

      const log = yield* fixture.as("admin").query(deliveries, {
        ...firstPage,
        clientId,
        slug: nf,
        webhookId: webhook.id,
      });
      expect(log.page[0]).toMatchObject({
        attempt: 2,
        entryId,
        state: { status: "due" },
      });
    })
  );

  it.effect("refuses an attempt of an ended webhook", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const { clientId, webhook } = yield* seeded(fixture);
      const entryId = yield* lastEntry(fixture);
      const deliveryId = yield* attempted(fixture, webhook.id, entryId);
      const names = { clientId, slug: nf, webhookId: webhook.id };
      yield* fixture.as("admin").mutation(revoke, names);

      const refused = yield* fixture
        .as("admin")
        .mutation(resend, { ...names, deliveryId })
        .pipe(Effect.flip);

      expect(refused).toMatchObject({ reason: "resource" });
    })
  );
});

describe("the school boundary", () => {
  it.effect("refuses a client of another school", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const { clientId } = yield* seeded(fixture);

      const refused = yield* fixture
        .as("otherOwner")
        .mutation(create, {
          changes: ["unit.created"],
          clientId,
          slug: other,
          url: RECEIVER,
        })
        .pipe(Effect.flip);

      expect(refused).toMatchObject({
        _tag: "AccessDenied",
        reason: "resource",
      });
    })
  );
});
