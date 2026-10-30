import { beforeEach, describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import { TENANCY_NOW, tenancyFixture } from "@repo/backend/test/tenancy";
import { Array as Arr, Effect } from "effect";

const HOUR = 3_600_000;

describe("connectors/events", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(TENANCY_NOW);
  });

  it.effect(
    "reads an account's events of a window, the one still running included, each title opened",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const { connectionId, userId } = yield* fixture.run(
          Effect.gen(function* () {
            const person = yield* (yield* DatabaseReader)
              .table("tenantPeople")
              .get(fixture.people.student.personId);
            if (person.account.state !== "claimed") {
              return yield* Effect.die("The student holds an account.");
            }
            const owner = person.account.userId;
            const id = yield* (yield* DatabaseWriter)
              .table("connectorConnections")
              .insert({
                connector: "calendar",
                googleAccountKey: null,
                lastSyncedAt: null,
                nextSyncAt: null,
                owner: { kind: "personal", userId: owner },
                scopes: ["openid"],
                status: "active",
              });
            return { connectionId: id, userId: owner };
          }).pipe(Effect.orDie)
        );
        const upcoming = (from: number, until: number) =>
          fixture.internal.query(refs.internal.connectors.events.upcoming, {
            from,
            until,
            userId,
          });
        expect(yield* upcoming(TENANCY_NOW, TENANCY_NOW + 24 * HOUR)).toEqual(
          []
        );
        yield* fixture.internal.mutation(
          refs.internal.connectors.sync.storeEvents,
          {
            connectionId,
            events: [
              {
                allDay: false,
                end: TENANCY_NOW + HOUR,
                eventId: "running",
                start: TENANCY_NOW - HOUR,
                title: "Pelajaran",
              },
              {
                allDay: false,
                end: TENANCY_NOW - HOUR / 2,
                eventId: "ended",
                start: TENANCY_NOW - HOUR,
                title: "Selesai",
              },
              {
                allDay: false,
                end: TENANCY_NOW + 3 * HOUR,
                eventId: "next",
                start: TENANCY_NOW + 2 * HOUR,
                title: "Ujian",
              },
            ],
          }
        );
        expect(
          Arr.map(
            yield* upcoming(TENANCY_NOW, TENANCY_NOW + 24 * HOUR),
            (event) => event.title
          )
        ).toEqual(["Pelajaran", "Ujian"]);
      })
  );
});
