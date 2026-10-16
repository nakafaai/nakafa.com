import { describe, expect, it } from "@effect/vitest";
import { Id } from "@repo/backend/confect/_generated/id";
import {
  JOURNAL_COMMIT_LAG,
  planRun,
} from "@repo/backend/confect/journal/cursor";
import { Option, Schema } from "effect";

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
    expect(plan.nextRunAt).toEqual(Option.none());
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
    expect(plan.nextRunAt).toEqual(Option.none());
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
    expect(plan.nextRunAt).toEqual(Option.none());
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
    expect(later.nextRunAt).toEqual(Option.none());
  });

  it("stops at the handled limit, which keeps one slot free, and asks for the next run when the oldest entry it left settles", () => {
    const page = [
      entry("u1", 6000),
      entry("u2", 6500),
      entry("u3", 7000),
      entry("u4", 7500),
    ];
    const plan = planRun(10_000, { handled: [], since: 0 }, page, 10, 3);
    expect(plan.handle).toEqual([entry("u1", 6000), entry("u2", 6500)]);
    expect(plan.position).toEqual({
      handled: [handled("u1", 6000), handled("u2", 6500)],
      since: 0,
    });
    // u3 settles at 7000 plus the lag, and by then every handled entry has settled too.
    expect(plan.nextRunAt).toEqual(Option.some(7000 + JOURNAL_COMMIT_LAG));
  });

  it("keeps a late settled entry within the limit, beside the unsettled entries it handled", () => {
    const unsettled = [entry("u1", 6000), entry("u2", 6010), entry("u3", 6020)];
    // Two unsettled entries are handled early, and one slot of the three stays free.
    const first = planRun(6050, { handled: [], since: 0 }, unsettled, 10, 3);
    expect(first.position.handled).toEqual([
      handled("u1", 6000),
      handled("u2", 6010),
    ]);
    // A late entry, created at 5500 before them, commits now and settles at 10500.
    const late = planRun(
      10_500,
      first.position,
      [entry("late", 5500), ...unsettled],
      10,
      3
    );
    expect(late.handle).toEqual([entry("late", 5500)]);
    expect(late.position).toEqual({
      handled: [
        handled("u1", 6000),
        handled("u2", 6010),
        handled("late", 5500),
      ],
      since: 5500,
    });
    expect(late.nextRunAt).toEqual(
      Option.some(Math.ceil(6020 + JOURNAL_COMMIT_LAG))
    );
  });

  it("waits for the oldest unread entry when the bound stopped a run that filled its page", () => {
    const page = [entry("u1", 6000), entry("u2", 6500), entry("u3", 7000)];
    // The page holds two entries and the limit three, so the next run would have no room.
    const plan = planRun(10_000, { handled: [], since: 0 }, page, 2, 3);
    expect(plan.handle).toEqual([entry("u1", 6000), entry("u2", 6500)]);
    expect(plan.nextRunAt).toEqual(Option.some(7000 + JOURNAL_COMMIT_LAG));
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
    expect(plan.nextRunAt).toEqual(Option.some(7000 + JOURNAL_COMMIT_LAG));
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
    expect(plan.nextRunAt).toEqual(Option.some(10_000));
  });

  it("asks for the next run at once while the limit leaves room for an unsettled entry", () => {
    const page = [
      entry("u1", 6000),
      entry("u2", 6500),
      entry("u3", 7000),
      entry("u4", 7500),
    ];
    const plan = planRun(10_000, { handled: [], since: 0 }, page, 2, 5);
    expect(plan.handle).toEqual([entry("u1", 6000), entry("u2", 6500)]);
    expect(plan.nextRunAt).toEqual(Option.some(10_000));
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
    expect(plan.nextRunAt).toEqual(Option.none());
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
    expect(plan.nextRunAt).toEqual(Option.none());
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
    expect(plan.nextRunAt).toEqual(Option.some(10_000));
  });

  it("drains the entries it left once they settle, in the next run", () => {
    const page = [
      entry("u1", 6000),
      entry("u2", 6500),
      entry("u3", 7000),
      entry("u4", 7500),
    ];
    const first = planRun(10_000, { handled: [], since: 0 }, page, 10, 3);
    const settleOfU3 = 7000 + JOURNAL_COMMIT_LAG;
    expect(first.nextRunAt).toEqual(Option.some(settleOfU3));
    const second = planRun(settleOfU3, first.position, page, 10, 3);
    expect(second.handle).toEqual([entry("u3", 7000), entry("u4", 7500)]);
    expect(second.position).toEqual({
      handled: [handled("u3", 7000), handled("u4", 7500)],
      since: 7000,
    });
    expect(second.nextRunAt).toEqual(Option.none());
  });
});
