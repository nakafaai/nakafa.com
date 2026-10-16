import { beforeEach, describe, expect, it } from "@effect/vitest";
import { Id } from "@repo/backend/confect/_generated/id";
import {
  JOURNAL_COMMIT_LAG,
  markPending,
  planRun,
  readAfter,
} from "@repo/backend/confect/journal/cursor";
import { cursors, invitedEntry, NOW } from "@repo/backend/test/inbox";
import { journal, tenancyFixture } from "@repo/backend/test/tenancy";
import { Array as Arr, Effect, Schema } from "effect";

/** The ID of a journal entry, as a test names it. */
const entryId = (name: string) =>
  Schema.decodeUnknownSync(Id("journalEntries"))(name);

/** One journal entry of a page: the two fields that a run reads. */
const entry = (name: string, createdAt: number) => ({
  _creationTime: createdAt,
  _id: entryId(name),
});

/** One handled record, as a cursor keeps it. */
const handled = (name: string, createdAt: number) => ({
  createdAt,
  entryId: entryId(name),
});

describe("journal/cursor planRun", () => {
  it("hands a settled entry to the run and moves since to it", () => {
    const plan = planRun(
      10_000,
      { handled: [], since: 0 },
      [entry("a", 1000)],
      50,
      50
    );
    expect(plan.handle).toEqual([entry("a", 1000)]);
    expect(plan.position).toEqual({
      handled: [handled("a", 1000)],
      since: 1000,
    });
    expect(plan.nextRunAt).toBeUndefined();
  });

  it("skips the entries its position already handled", () => {
    const plan = planRun(
      10_000,
      { handled: [handled("a", 1000)], since: 1000 },
      [entry("a", 1000), entry("b", 2000)],
      50,
      50
    );
    expect(plan.handle).toEqual([entry("b", 2000)]);
    expect(plan.position).toEqual({
      handled: [handled("b", 2000)],
      since: 2000,
    });
    expect(plan.nextRunAt).toBeUndefined();
  });

  it("keeps the entries that share the time of since, and reads a later one with that time", () => {
    // Two entries share one creation time, and the cursor cannot tell them apart by time.
    const first = planRun(
      10_000,
      { handled: [], since: 0 },
      [entry("a", 1000), entry("b", 1000)],
      50,
      50
    );
    expect(first.handle).toEqual([entry("a", 1000), entry("b", 1000)]);
    expect(first.position).toEqual({
      handled: [handled("a", 1000), handled("b", 1000)],
      since: 1000,
    });
    // A third entry with the same time commits later, and the next read must not skip it.
    const second = planRun(
      10_000,
      first.position,
      [entry("a", 1000), entry("b", 1000), entry("c", 1000)],
      50,
      50
    );
    expect(second.handle).toEqual([entry("c", 1000)]);
    expect(second.position).toEqual({
      handled: [handled("a", 1000), handled("b", 1000), handled("c", 1000)],
      since: 1000,
    });
  });

  it("hands an unsettled entry early and leaves since behind it", () => {
    const plan = planRun(
      4000,
      { handled: [], since: 0 },
      [entry("u", 1000)],
      50,
      50
    );
    expect(plan.handle).toEqual([entry("u", 1000)]);
    expect(plan.position).toEqual({ handled: [handled("u", 1000)], since: 0 });
    expect(plan.nextRunAt).toBeUndefined();
  });

  it("reads an entry that commits late even when it is older than an unsettled entry the run handled", () => {
    const first = planRun(
      4000,
      { handled: [], since: 0 },
      [entry("u", 1000)],
      50,
      50
    );
    // The late entry was created at 500, before the unsettled one, and commits now.
    const later = planRun(
      7000,
      first.position,
      [entry("late", 500), entry("u", 1000)],
      50,
      50
    );
    expect(later.handle).toEqual([entry("late", 500)]);
    expect(later.position).toEqual({
      handled: [handled("u", 1000), handled("late", 500)],
      since: 500,
    });
    expect(later.nextRunAt).toBeUndefined();
  });

  it("stops at the handled limit, and asks for the next run when the oldest entry it left settles", () => {
    const page = [
      entry("u1", 6000),
      entry("u2", 6500),
      entry("u3", 7000),
      entry("u4", 7500),
    ];
    const plan = planRun(10_000, { handled: [], since: 0 }, page, 10, 2);
    expect(plan.handle).toEqual([entry("u1", 6000), entry("u2", 6500)]);
    expect(plan.position).toEqual({
      handled: [handled("u1", 6000), handled("u2", 6500)],
      since: 0,
    });
    // u3 settles at 7000 plus the lag, and by then every handled entry has settled too.
    expect(plan.nextRunAt).toBe(7000 + JOURNAL_COMMIT_LAG);
  });

  it("hands no unsettled entry while its position already holds the limit", () => {
    const plan = planRun(
      10_000,
      { handled: [handled("h1", 6000), handled("h2", 6500)], since: 6000 },
      [entry("h1", 6000), entry("h2", 6500), entry("u3", 7000)],
      10,
      2
    );
    expect(plan.handle).toEqual([]);
    expect(plan.position).toEqual({
      handled: [handled("h1", 6000), handled("h2", 6500)],
      since: 6000,
    });
    expect(plan.nextRunAt).toBe(7000 + JOURNAL_COMMIT_LAG);
  });

  it("asks for the next run at once when a full page stopped the run", () => {
    const plan = planRun(
      10_000,
      { handled: [], since: 0 },
      [entry("a", 1000), entry("b", 2000), entry("c", 3000)],
      2,
      50
    );
    expect(plan.handle).toEqual([entry("a", 1000), entry("b", 2000)]);
    expect(plan.position).toEqual({
      handled: [handled("b", 2000)],
      since: 2000,
    });
    expect(plan.nextRunAt).toBe(10_000);
  });

  it("has no next run when the page held every entry left", () => {
    const plan = planRun(
      10_000,
      { handled: [], since: 0 },
      [entry("a", 1000), entry("b", 2000)],
      2,
      50
    );
    expect(plan.handle).toEqual([entry("a", 1000), entry("b", 2000)]);
    expect(plan.position).toEqual({
      handled: [handled("b", 2000)],
      since: 2000,
    });
    expect(plan.nextRunAt).toBeUndefined();
  });

  it("does not read an entry created before its since", () => {
    const plan = planRun(
      20_000,
      { handled: [], since: 5000 },
      [entry("old", 1000)],
      50,
      50
    );
    expect(plan.handle).toEqual([]);
    expect(plan.position).toEqual({ handled: [], since: 5000 });
    expect(plan.nextRunAt).toBeUndefined();
  });

  it("hands the settled entries and the unsettled ones that fit a full page, and asks for a run at once", () => {
    const page = [
      entry("s1", 1000),
      entry("s2", 2000),
      entry("u1", 6000),
      entry("u2", 7000),
    ];
    const plan = planRun(10_000, { handled: [], since: 0 }, page, 3, 5);
    expect(plan.handle).toEqual([
      entry("s1", 1000),
      entry("s2", 2000),
      entry("u1", 6000),
    ]);
    expect(plan.position).toEqual({
      handled: [handled("s2", 2000), handled("u1", 6000)],
      since: 2000,
    });
    expect(plan.nextRunAt).toBe(10_000);
  });

  it("drains the entries it left once they settle, in the next run", () => {
    const page = [
      entry("u1", 6000),
      entry("u2", 6500),
      entry("u3", 7000),
      entry("u4", 7500),
    ];
    const first = planRun(10_000, { handled: [], since: 0 }, page, 10, 2);
    const settleOfU3 = 7000 + JOURNAL_COMMIT_LAG;
    expect(first.nextRunAt).toBe(settleOfU3);
    const second = planRun(settleOfU3, first.position, page, 10, 2);
    expect(second.handle).toEqual([entry("u3", 7000), entry("u4", 7500)]);
    expect(second.position).toEqual({
      handled: [handled("u3", 7000), handled("u4", 7500)],
      since: 7000,
    });
    expect(second.nextRunAt).toBeUndefined();
  });
});

describe("journal/cursor store", () => {
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
    "keeps the start of a cursor that already exists, and marks it pending again",
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
        vi.setSystemTime(NOW + 20_000);
        const second = yield* invitedEntry(fixture, 1);
        yield* fixture.run(
          markPending("inbox", fixture.tenants.nf, "person.invited", second)
        );
        expect(yield* cursors(fixture)).toMatchObject([
          { pending: true, since: start },
        ]);
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
