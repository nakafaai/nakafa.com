import { beforeEach, describe, expect, it } from "@effect/vitest";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import {
  decodeFeedCursor,
  FeedCursorJson,
  feedPage,
} from "@repo/backend/confect/notifications/feed";
import {
  HELD_SCHOOL_LIMIT,
  type HeldSchool,
  heldSchools,
} from "@repo/backend/confect/notifications/held";
import {
  addPerson,
  claim,
  claimedPersons,
  type Fixture,
  insertRows,
  inviteAt,
  NOW,
  type PersonId,
  storedRows,
} from "@repo/backend/test/inbox";
import { journal, tenancyFixture } from "@repo/backend/test/tenancy";
import { Array as Arr, Effect, Schema } from "effect";

const ANA = "ana@harapan.example.test";
/** Rows per page, half of the 100-row list page of ADR 0016. */
const PAGE = 50;

/** Fake timers keep the clock where each test sets it. */
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});

/**
 * Inserts one row at `NOW` for each Person, so every row shares one creation time,
 * as the invitations of one moment would leave them. Each row takes its Person's school.
 */
const rowsAtOneTime = (fixture: Fixture, personIds: readonly PersonId[]) =>
  Effect.gen(function* () {
    const made = yield* inviteAt(
      fixture,
      "nf",
      fixture.invited,
      "satu@harapan.example.test"
    );
    const [entry] = yield* fixture.run(journal);
    if (entry === undefined) {
      return yield* Effect.die("The invite must have written a journal entry.");
    }
    yield* fixture.run(
      Effect.gen(function* () {
        const reader = yield* DatabaseReader;
        const writer = yield* DatabaseWriter;
        yield* Effect.forEach(
          personIds,
          (personId) =>
            Effect.gen(function* () {
              const person = yield* reader
                .table("tenantPeople")
                .get(personId)
                .pipe(Effect.orDie);
              return yield* writer.table("notifications").insert({
                changeType: "person.invited",
                createdAt: NOW,
                inviteId: made.id,
                journalEntryId: entry._id,
                recipientPersonId: personId,
                subject: { id: personId, kind: "person" },
                tenantId: person.tenantId,
              });
            }),
          { discard: true }
        );
      })
    );
  });

/** One page of the list, read the way the list reads it: decode the cursor, then the page. */
const pageOf = (
  fixture: Fixture,
  schools: readonly HeldSchool[],
  cursor: string | null
) =>
  Effect.gen(function* () {
    const position = yield* decodeFeedCursor(cursor);
    return yield* fixture.run(feedPage(schools, position, PAGE));
  });

describe("notifications/feed cursor", () => {
  it.effect(
    "refuses a cursor that names more rows at its time than the account can hold",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const ana = yield* fixture.account("ana", ANA, true);
        const anaNf = yield* addPerson(fixture, fixture.tenants.nf, "Ana");
        yield* claim(fixture, anaNf, ana.userId);
        yield* insertRows(fixture, anaNf, fixture.tenants.nf, 1);
        const [row] = yield* storedRows(fixture);
        if (row === undefined) {
          return yield* Effect.die("The insert must have written a row.");
        }
        // A real row ID, repeated past the bound: the cursor decodes, and only its length is wrong.
        const cursor = yield* Schema.encodeEffect(FeedCursorJson)({
          at: NOW,
          shown: Arr.replicate(row._id, HELD_SCHOOL_LIMIT + 1),
        }).pipe(Effect.orDie);
        const refused = yield* decodeFeedCursor(cursor).pipe(Effect.flip);
        expect(refused).toMatchObject({ _tag: "NotificationCursorInvalid" });
      })
  );

  it.effect(
    "pages a creation time that every held school shares, up to the most rows a cursor names",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const ana = yield* fixture.account("ana", ANA, true);
        const personIds = yield* claimedPersons(
          fixture,
          ana.userId,
          HELD_SCHOOL_LIMIT
        );
        yield* rowsAtOneTime(fixture, personIds);
        const schools = yield* fixture.run(heldSchools(ana.userId));
        const first = yield* pageOf(fixture, schools, null);
        const second = yield* pageOf(fixture, schools, first.continueCursor);
        expect(second.isDone).toBe(true);
        const shown = Arr.map(
          Arr.appendAll(first.page, second.page),
          (item) => item.id
        );
        expect(Arr.dedupe(shown)).toHaveLength(HELD_SCHOOL_LIMIT);
        // The cursor after the last row names every row at the time: the most a
        // cursor names, and the list still accepts it.
        const after = yield* pageOf(fixture, schools, second.continueCursor);
        expect(after).toMatchObject({ isDone: true, page: [] });
      })
  );
});
