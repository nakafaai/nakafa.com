import { beforeEach, describe, expect, it } from "@effect/vitest";
import { DatabaseWriter } from "@repo/backend/confect/_generated/services";
import {
  INBOX_PAGE_SIZE,
  noteInvite,
} from "@repo/backend/confect/notifications/inbox";
import { Email } from "@repo/backend/confect/tenancy/schema";
import {
  addPerson,
  consumeSchool,
  cursors,
  type Fixture,
  inviteAt,
  NOW,
  storedRows,
} from "@repo/backend/test/inbox";
import {
  invitePerson,
  journal,
  tenancyFixture,
} from "@repo/backend/test/tenancy";
import { Array as Arr, Effect, Schema } from "effect";

const GURU = "guru@harapan.example.test";
const LAIN = "lain@lain.example.test";

/** Fake timers keep every scheduled run from starting before the test looks at it. */
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});

/**
 * Moves every journal cursor's `since` forward, as a run that had read to that time
 * would leave it. convex-test never gives a row an earlier creation time than a row
 * already written, so a late entry cannot be inserted behind a real one: these tests
 * move the cursor past the time of the late entry, then insert that entry.
 */
const moveSince = (fixture: Fixture, since: number) =>
  Effect.gen(function* () {
    const found = yield* cursors(fixture);
    yield* fixture.run(
      Effect.flatMap(DatabaseWriter, (writer) =>
        Effect.forEach(
          found,
          (cursor) =>
            writer.table("journalCursors").patch(cursor._id, { since }),
          { discard: true }
        )
      )
    );
  });

/**
 * Invites a new Person to the school `nf` and writes the journal entry of that
 * invitation, as the invite mutation does. Returns the entry's ID.
 */
const invitedEntry = (fixture: Fixture, index: number) =>
  Effect.gen(function* () {
    const address = yield* Schema.decodeEffect(Email)(
      `orang${index}@harapan.example.test`
    );
    const { inviteId, personId } = yield* invitePerson(
      fixture.tenants.nf,
      address
    );
    return yield* (yield* DatabaseWriter).table("journalEntries").insert({
      actor: { kind: "system" },
      change: { invite: inviteId, type: "person.invited" },
      owner: { kind: "tenant", tenantId: fixture.tenants.nf },
      subject: { id: personId, kind: "person" },
    });
  });

describe("journal/cursor window", () => {
  it.effect(
    "reads an invitation that committed after a run passed its creation time, inside the window",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const early = yield* addPerson(fixture, fixture.tenants.nf, "Satu");
        const late = yield* addPerson(fixture, fixture.tenants.nf, "Dua");
        yield* inviteAt(fixture, "nf", early, GURU);
        yield* consumeSchool(fixture, fixture.tenants.nf);
        // A run has read to three seconds after the first invitation.
        yield* moveSince(fixture, NOW + 3000);
        // The late invitation was created one second after the first, and commits now.
        vi.setSystemTime(NOW + 1000);
        yield* inviteAt(fixture, "nf", late, LAIN);
        yield* consumeSchool(fixture, fixture.tenants.nf);
        expect(
          Arr.map(yield* storedRows(fixture), (row) => row.recipientPersonId)
        ).toEqual([early, late]);
      })
  );

  it.effect(
    "does not read an invitation created before the window behind its cursor",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const early = yield* addPerson(fixture, fixture.tenants.nf, "Satu");
        const old = yield* addPerson(fixture, fixture.tenants.nf, "Dua");
        yield* inviteAt(fixture, "nf", early, GURU);
        yield* consumeSchool(fixture, fixture.tenants.nf);
        // A run has read to ten seconds after the first invitation, so the window
        // starts five seconds after it, and the second invitation falls before that.
        yield* moveSince(fixture, NOW + 10_000);
        vi.setSystemTime(NOW + 1000);
        yield* inviteAt(fixture, "nf", old, LAIN);
        yield* consumeSchool(fixture, fixture.tenants.nf);
        expect(
          Arr.map(yield* storedRows(fixture), (row) => row.recipientPersonId)
        ).toEqual([early]);
      })
  );

  it.effect(
    "keeps in its handled list only the entries inside the window behind its position",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const first = yield* addPerson(fixture, fixture.tenants.nf, "Satu");
        const second = yield* addPerson(fixture, fixture.tenants.nf, "Dua");
        yield* inviteAt(fixture, "nf", first, GURU);
        yield* consumeSchool(fixture, fixture.tenants.nf);
        vi.setSystemTime(NOW + 10_000);
        yield* inviteAt(fixture, "nf", second, LAIN);
        yield* consumeSchool(fixture, fixture.tenants.nf);
        const [, latest] = yield* fixture.run(journal);
        expect(yield* cursors(fixture)).toMatchObject([
          {
            handled: [
              { createdAt: latest?._creationTime, entryId: latest?._id },
            ],
          },
        ]);
      })
  );

  it.effect(
    "fails with its typed error, and writes no row, when its window holds more than a page of handled entries",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        // One more invitation than a run may keep, all written inside one window.
        yield* fixture.run(
          Effect.gen(function* () {
            const first = yield* invitedEntry(fixture, 0);
            yield* noteInvite(fixture.tenants.nf, first);
            yield* Effect.forEach(
              Arr.makeBy(INBOX_PAGE_SIZE, (index) => index + 1),
              (index) => invitedEntry(fixture, index),
              { discard: true }
            );
          })
        );
        yield* consumeSchool(fixture, fixture.tenants.nf);
        expect(yield* storedRows(fixture)).toHaveLength(INBOX_PAGE_SIZE);
        const before = yield* cursors(fixture);
        const failure = yield* consumeSchool(fixture, fixture.tenants.nf).pipe(
          Effect.flip
        );
        expect(failure).toMatchObject({
          _tag: "JournalCursorTooLarge",
          entries: INBOX_PAGE_SIZE + 1,
          limit: INBOX_PAGE_SIZE,
        });
        expect(yield* storedRows(fixture)).toHaveLength(INBOX_PAGE_SIZE);
        expect(yield* cursors(fixture)).toEqual(before);
      })
  );
});
