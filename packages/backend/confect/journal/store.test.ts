import { beforeEach, describe, expect, it } from "@effect/vitest";
import { JOURNAL_COMMIT_LAG } from "@repo/backend/confect/journal/cursor";
import {
  advance,
  markPending,
  readAfter,
} from "@repo/backend/confect/journal/store";
import { cursors, invitedEntry, NOW } from "@repo/backend/test/inbox";
import { journal, tenancyFixture } from "@repo/backend/test/tenancy";
import { Array as Arr, Effect } from "effect";

describe("journal/store", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  it.effect(
    "starts a new cursor five seconds before the entry that makes it",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        vi.setSystemTime(NOW + 10_000);
        const id = yield* invitedEntry(fixture, 0);
        yield* fixture.run(
          markPending("inbox", fixture.tenants.nf, "person.invited", id)
        );
        const [entry] = yield* fixture.run(journal);
        if (entry === undefined) {
          return yield* Effect.die(
            "The invite must have written a journal entry."
          );
        }
        expect(yield* cursors(fixture)).toMatchObject([
          {
            handled: [],
            pending: true,
            since: entry._creationTime - JOURNAL_COMMIT_LAG,
          },
        ]);
      })
  );

  it.effect(
    "keeps the start of a cursor that already exists, and marks a drained cursor pending again",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        vi.setSystemTime(NOW + 10_000);
        const first = yield* invitedEntry(fixture, 0);
        yield* fixture.run(
          markPending("inbox", fixture.tenants.nf, "person.invited", first)
        );
        const [entry] = yield* fixture.run(journal);
        if (entry === undefined) {
          return yield* Effect.die(
            "The invite must have written a journal entry."
          );
        }
        const start = entry._creationTime - JOURNAL_COMMIT_LAG;
        // A run that reads to the end of its entries clears the pending flag.
        const [drained] = yield* cursors(fixture);
        yield* fixture.run(
          advance(drained._id, { handled: [], since: start }, false)
        );
        vi.setSystemTime(NOW + 20_000);
        const second = yield* invitedEntry(fixture, 1);
        const owed = yield* fixture.run(
          markPending("inbox", fixture.tenants.nf, "person.invited", second)
        );
        expect(owed).toBe(false);
        expect(yield* cursors(fixture)).toMatchObject([
          { pending: true, since: start },
        ]);
      })
  );

  it.effect(
    "reports that a run is already owed when the cursor is pending",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        vi.setSystemTime(NOW + 10_000);
        const first = yield* invitedEntry(fixture, 0);
        const created = yield* fixture.run(
          markPending("inbox", fixture.tenants.nf, "person.invited", first)
        );
        vi.setSystemTime(NOW + 20_000);
        const second = yield* invitedEntry(fixture, 1);
        const owed = yield* fixture.run(
          markPending("inbox", fixture.tenants.nf, "person.invited", second)
        );
        expect([created, owed]).toEqual([false, true]);
      })
  );

  it.effect(
    "reads from its position inclusive, and never an entry created before it",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        vi.setSystemTime(NOW + 1000);
        yield* invitedEntry(fixture, 0);
        vi.setSystemTime(NOW + 2000);
        yield* invitedEntry(fixture, 1);
        vi.setSystemTime(NOW + 3000);
        yield* invitedEntry(fixture, 2);
        const [, second, third] = yield* fixture.run(journal);
        if (second === undefined || third === undefined) {
          return yield* Effect.die(
            "The invites must have written three journal entries."
          );
        }
        const read = yield* fixture.run(
          readAfter(
            fixture.tenants.nf,
            "person.invited",
            {
              handled: [
                { createdAt: second._creationTime, entryId: second._id },
              ],
              since: second._creationTime,
            },
            10
          )
        );
        // The entry at since is read again, so the run can skip it by ID; the older one is not read.
        expect(Arr.map(read, (row) => row._id)).toEqual([
          second._id,
          third._id,
        ]);
      })
  );
});
