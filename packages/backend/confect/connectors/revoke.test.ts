import type { GenericId } from "@confect/core";
import { afterEach, describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import {
  connect,
  markReconnect,
} from "@repo/backend/confect/connectors/connection";
import { systemActor } from "@repo/backend/confect/tenancy/actor";
import { createTenantKey } from "@repo/backend/confect/vault/keys";
import { slugOf, tenancyFixture } from "@repo/backend/test/tenancy";
import { Effect, Option } from "effect";

/** The fetch that the revoke calls, stubbed once for the file. */
const fetcher = vi.fn<typeof fetch>();
vi.stubGlobal("fetch", fetcher);

const nf = slugOf("nf");
const { disconnectSchool } = refs.public.connectors.connections;
const { revocable, revoke } = refs.internal.connectors.sync;
const REVOKE_ENDPOINT = "https://oauth2.googleapis.com/revoke";

type Fixture = Effect.Success<typeof tenancyFixture>;

afterEach(() => {
  fetcher.mockReset();
});

/** A Drive connection of the school to the Google account `subject`, holding `refreshToken`. */
const schoolDrive = (fixture: Fixture, subject: string, refreshToken: string) =>
  fixture.run(
    connect(
      systemActor,
      { kind: "tenant", tenantId: fixture.tenants.nf },
      {
        connector: "drive",
        googleSubject: subject,
        refreshToken,
        scopes: ["drive.file"],
      }
    )
  );

/** Whether a connection still holds a sealed token. */
const holdsSecret = (
  connectionId: GenericId.GenericId<"connectorConnections">
) =>
  Effect.flatMap(DatabaseReader, (reader) =>
    reader
      .table("connectorSecrets")
      .index("by_connectionId", (query) =>
        query.eq("connectionId", connectionId)
      )
      .first()
      .pipe(Effect.map(Option.isSome), Effect.orDie)
  );

/** The body that the revoke posted to Google, read from its one call. */
const postedToken = () => {
  const [url, init] = fetcher.mock.calls[0] ?? [];
  return { body: String(init?.body), url: String(url) };
};

describe("connectors/revoke", () => {
  it.effect(
    "revokes the grant at Google when the last connection of its account ends, then destroys the token",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        yield* fixture.run(createTenantKey(fixture.tenants.nf));
        const connectionId = yield* schoolDrive(fixture, "sub-1", "token-1");
        fetcher.mockImplementation(() =>
          Promise.resolve(new Response(null, { status: 200 }))
        );
        yield* fixture
          .as("admin")
          .mutation(disconnectSchool, { connectionId, slug: nf });
        // The token waits sealed for the revoke, which the disconnect scheduled.
        expect(yield* fixture.internal.query(revocable, { connectionId })).toBe(
          "token-1"
        );
        yield* fixture.internal.action(revoke, { connectionId });
        expect(postedToken()).toEqual({
          body: "token=token-1",
          url: REVOKE_ENDPOINT,
        });
        expect(yield* fixture.run(holdsSecret(connectionId))).toBe(false);
        expect(
          yield* fixture.internal.query(revocable, { connectionId })
        ).toBeNull();
      })
  );

  it.effect(
    "keeps the grant while another connection of the same Google account stays active, and destroys the token at once",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        yield* fixture.run(createTenantKey(fixture.tenants.nf));
        const first = yield* schoolDrive(fixture, "sub-2", "token-a");
        const second = yield* fixture.run(
          connect(
            systemActor,
            { kind: "tenant", tenantId: fixture.tenants.nf },
            {
              connector: "calendar",
              googleSubject: "sub-2",
              refreshToken: "token-b",
              scopes: ["calendar.readonly"],
            }
          )
        );
        yield* fixture
          .as("admin")
          .mutation(disconnectSchool, { connectionId: first, slug: nf });
        expect(yield* fixture.run(holdsSecret(first))).toBe(false);
        expect(
          yield* fixture.internal.query(revocable, { connectionId: first })
        ).toBeNull();
        expect(yield* fixture.run(holdsSecret(second))).toBe(true);
        // An active connection has no revoke waiting, and a revoke run for it calls nobody.
        expect(
          yield* fixture.internal.query(revocable, { connectionId: second })
        ).toBeNull();
        yield* fixture.internal.action(revoke, { connectionId: second });
        expect(fetcher).not.toHaveBeenCalled();
      })
  );

  it.effect(
    "revokes for a connection that waits to reconnect when no active connection of its account is left",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        yield* fixture.run(createTenantKey(fixture.tenants.nf));
        const connectionId = yield* schoolDrive(fixture, "sub-4", "token-4");
        yield* fixture.run(
          Effect.flatMap(
            Effect.flatMap(DatabaseReader, (reader) =>
              reader
                .table("connectorConnections")
                .get(connectionId)
                .pipe(Effect.orDie)
            ),
            markReconnect
          )
        );
        fetcher.mockImplementation(() =>
          Promise.resolve(new Response(null, { status: 200 }))
        );
        yield* fixture
          .as("admin")
          .mutation(disconnectSchool, { connectionId, slug: nf });
        expect(yield* fixture.internal.query(revocable, { connectionId })).toBe(
          "token-4"
        );
      })
  );

  it.effect(
    "destroys the token even when Google keeps refusing the revoke",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        yield* fixture.run(createTenantKey(fixture.tenants.nf));
        const connectionId = yield* schoolDrive(fixture, "sub-3", "token-3");
        fetcher.mockImplementation(() =>
          Promise.resolve(new Response(null, { status: 503 }))
        );
        yield* fixture
          .as("admin")
          .mutation(disconnectSchool, { connectionId, slug: nf });
        yield* fixture.internal.action(revoke, { connectionId });
        // The first try and its three retries; the revoke the disconnect scheduled may run beside this one.
        expect(fetcher.mock.calls.length).toBeGreaterThanOrEqual(4);
        expect(yield* fixture.run(holdsSecret(connectionId))).toBe(false);
      }),
    30_000
  );
});
