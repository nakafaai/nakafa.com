import type { GenericId } from "@confect/core";
import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import { connect } from "@repo/backend/confect/connectors/connection";
import {
  journal,
  TENANCY_NOW,
  tenancyFixture,
} from "@repo/backend/test/tenancy";
import { encodeJsonText } from "@repo/utilities/json";
import { Array as Arr, Effect } from "effect";

/** The fetch that the sync's client calls, stubbed once for the file. */
const fetcher = vi.fn<typeof fetch>();
vi.stubGlobal("fetch", fetcher);

const sync = refs.internal.connectors.sync;
const { disconnectOwn } = refs.public.connectors.connections;

const HOUR = 3_600_000;

/** One JSON answer of Google. */
const json = (status: number, body: object) =>
  new Response(encodeJsonText(body), {
    headers: { "content-type": "application/json" },
    status,
  });

/** Google answering a refresh with a token and the calendar with `events`. */
const google = (
  events: readonly object[],
  refresh = json(200, {
    access_token: "access",
    expires_in: 3599,
    scope: "",
  })
) => {
  fetcher.mockImplementation((input) =>
    Promise.resolve(
      String(input).startsWith("https://oauth2.googleapis.com/token")
        ? refresh.clone()
        : json(200, { items: events })
    )
  );
};

const meeting = {
  end: { dateTime: "2026-10-28T09:00:00Z" },
  id: "event-1",
  start: { dateTime: "2026-10-28T08:00:00Z" },
  summary: "Ujian Fisika",
};
const holiday = {
  end: { date: "2026-10-30" },
  id: "event-2",
  start: { date: "2026-10-29" },
  summary: "Libur",
};
const cancelled = { ...meeting, id: "event-3", status: "cancelled" };

/** A personal connection of the student to a connector, stored as `connect` stores it, due now. */
const connectionOf = (
  fixture: Effect.Success<typeof tenancyFixture>,
  connector: "calendar" | "drive"
) =>
  fixture.run(
    Effect.gen(function* () {
      const user = yield* (yield* DatabaseReader)
        .table("tenantPeople")
        .get(fixture.people.student.personId);
      if (user.account.state !== "claimed") {
        return yield* Effect.die("The student holds an account.");
      }
      const userId = user.account.userId;
      const connectionId = yield* connect(
        { id: userId, kind: "user" },
        { kind: "personal", userId },
        {
          connector,
          googleSubject: "subject-1",
          refreshToken: "refresh-1",
          scopes: ["openid"],
        }
      );
      yield* (yield* DatabaseWriter)
        .table("connectorConnections")
        .patch(connectionId, { nextSyncAt: TENANCY_NOW });
      return connectionId;
    }).pipe(Effect.orDie)
  );

/** A stored row of a table, read inside the fixture. */
const rowOf = (connectionId: GenericId.GenericId<"connectorConnections">) =>
  Effect.flatMap(DatabaseReader, (reader) =>
    reader.table("connectorConnections").get(connectionId).pipe(Effect.orDie)
  );

/** Every mirrored event. */
const mirror = Effect.flatMap(DatabaseReader, (reader) =>
  reader.table("connectorEvents").index("by_creation_time").take(50)
);

describe("connectors/sync", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(TENANCY_NOW);
    fetcher.mockReset();
    vi.stubEnv("GOOGLE_CONNECTORS", "calendar,drive");
    vi.stubEnv("GOOGLE_CONNECTOR_CLIENT_ID", "client");
    vi.stubEnv("GOOGLE_CONNECTOR_CLIENT_SECRET", "secret");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it.effect(
    "mirrors the coming events with sealed titles, reads a changed calendar sooner and a quiet one later, and drops the mirror on disconnect",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const connectionId = yield* connectionOf(fixture, "calendar");
        google([meeting, holiday, cancelled]);
        yield* fixture.internal.action(sync.run, { connectionId });
        const events = yield* fixture.run(mirror);
        expect(
          Arr.map(events, (event) => [event.eventId, event.allDay])
        ).toEqual([
          ["event-1", false],
          ["event-2", true],
        ]);
        expect(encodeJsonText(events)).not.toContain("Ujian");
        const [url, init] = fetcher.mock.calls[1] ?? [];
        expect(String(url)).toContain("singleEvents=true");
        expect(new Headers(init?.headers).get("authorization")).toBe(
          "Bearer access"
        );
        expect((yield* fixture.run(rowOf(connectionId))).nextSyncAt).toBe(
          TENANCY_NOW + HOUR / 2
        );
        yield* fixture.internal.action(sync.run, { connectionId });
        expect((yield* fixture.run(rowOf(connectionId))).nextSyncAt).toBe(
          TENANCY_NOW + 3 * HOUR
        );
        yield* fixture.as("student").mutation(disconnectOwn, { connectionId });
        expect(yield* fixture.run(mirror)).toEqual([]);
        expect(
          yield* fixture.internal.query(sync.target, { connectionId })
        ).toBeNull();
        expect(
          yield* fixture.internal.mutation(sync.storeEvents, {
            connectionId,
            events: [],
          })
        ).toBeNull();
      })
  );

  it.effect(
    "moves a connection whose token Google refuses to reconnect, and keeps one Google failed on otherwise",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const connectionId = yield* connectionOf(fixture, "calendar");
        google([], json(500, { error: "server_error" }));
        yield* fixture.internal.action(sync.run, { connectionId });
        expect((yield* fixture.run(rowOf(connectionId))).status).toBe("active");
        google([], json(400, { error: "invalid_grant" }));
        yield* fixture.internal.action(sync.run, { connectionId });
        const row = yield* fixture.run(rowOf(connectionId));
        expect(row).toMatchObject({ nextSyncAt: null, status: "reconnect" });
        expect(
          Arr.filter(yield* fixture.run(journal), (entry) =>
            encodeJsonText(entry).includes("connection.reconnect")
          )
        ).toHaveLength(1);
        yield* fixture.internal.mutation(sync.reconnect, { connectionId });
        expect(
          yield* fixture.internal.query(sync.target, { connectionId })
        ).toBeNull();
      })
  );

  it.effect(
    "reads nothing for a connector that keeps no copy, one turned off, or a connection without its token",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const drive = yield* connectionOf(fixture, "drive");
        yield* fixture.internal.action(sync.run, { connectionId: drive });
        const calendar = yield* connectionOf(fixture, "calendar");
        vi.stubEnv("GOOGLE_CONNECTORS", "drive");
        yield* fixture.internal.action(sync.run, { connectionId: calendar });
        expect(fetcher).not.toHaveBeenCalled();
        yield* fixture.run(
          Effect.gen(function* () {
            const secret = yield* (yield* DatabaseReader)
              .table("connectorSecrets")
              .index("by_connectionId", (query) =>
                query.eq("connectionId", calendar)
              )
              .first();
            if (secret._tag === "Some") {
              yield* (yield* DatabaseWriter)
                .table("connectorSecrets")
                .delete(secret.value._id);
            }
          }).pipe(Effect.orDie)
        );
        expect(
          yield* fixture.internal.query(sync.target, { connectionId: calendar })
        ).toBeNull();
      })
  );

  it.effect(
    "takes the due connections, at most five of one owner and the school's apart, leases each, and skips one with no due time",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const due = yield* Effect.forEach(Arr.range(1, 7), () =>
          connectionOf(fixture, "calendar")
        );
        const school = yield* fixture.run(
          Effect.gen(function* () {
            const connectionId = yield* connect(
              { id: fixture.people.admin.personId, kind: "person" },
              { kind: "tenant", tenantId: fixture.tenants.nf },
              {
                connector: "classroom",
                googleSubject: "subject-school",
                refreshToken: "refresh-school",
                scopes: ["openid"],
              }
            );
            yield* (yield* DatabaseWriter)
              .table("connectorConnections")
              .patch(connectionId, { nextSyncAt: TENANCY_NOW });
            return connectionId;
          }).pipe(Effect.orDie)
        );
        const idle = yield* connectionOf(fixture, "drive");
        yield* fixture.run(
          Effect.flatMap(DatabaseWriter, (writer) =>
            writer
              .table("connectorConnections")
              .patch(idle, { nextSyncAt: null })
          ).pipe(Effect.orDie)
        );
        expect(yield* fixture.internal.mutation(sync.sweep, {})).toEqual({
          scheduled: 6,
        });
        const leased = yield* fixture.run(
          Effect.forEach(due, (connectionId) => rowOf(connectionId))
        );
        expect(
          Arr.filter(leased, (row) => row.nextSyncAt === TENANCY_NOW + HOUR / 4)
        ).toHaveLength(5);
        expect((yield* fixture.run(rowOf(school))).nextSyncAt).toBe(
          TENANCY_NOW + HOUR / 4
        );
        expect((yield* fixture.run(rowOf(idle))).nextSyncAt).toBeNull();
      })
  );
});
