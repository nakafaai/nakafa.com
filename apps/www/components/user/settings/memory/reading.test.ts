import { PaginatedQueryResult, QueryResult } from "@confect/react";
import { describe, expect, it } from "@effect/vitest";
import { Id } from "@repo/backend/confect/_generated/id";
import { Schema } from "effect";
import type {
  Memory,
  MemoryPage,
} from "@/components/user/settings/memory/list";
import { readingOf } from "@/components/user/settings/memory/reading";

const memoryId = Schema.decodeUnknownSync(Id("ninaMemories"));

/** The moment the server read the page. */
const NOW = 5000;

/** A stored memory written by Nina. */
function stored(name: string, change: Partial<Memory> = {}): Memory {
  return {
    author: "nina",
    confirmedAt: 1000,
    createdAt: 500,
    id: memoryId(name),
    text: `Text of ${name}`,
    ...change,
  };
}

const newest = stored("newest");
const older = stored("older");
const oldest = stored("oldest");

/** The page the server read for the first paint. */
function served(page: readonly Memory[], isDone: boolean): MemoryPage {
  return { continueCursor: "next", isDone, page: [...page] };
}

const loading = PaginatedQueryResult.loadingFirstPage<Memory>({
  skipped: false,
});
const waiting = QueryResult.load<{ paused: boolean } | null>(false);

describe("what the Memory page reads", () => {
  it("reads the page the server read until Convex answers with the first one, and loads nothing", () => {
    expect(
      readingOf(loading, waiting, served([newest, older], false), true, NOW)
    ).toEqual({
      empty: false,
      loaded: [newest, older],
      more: null,
      paused: true,
      whole: false,
    });
  });

  it("calls the learner's list whole from the first paint when the server's page ends it, and empty when it holds nothing", () => {
    expect(
      readingOf(loading, waiting, served([older], true), false, NOW)
    ).toMatchObject({ empty: false, whole: true });
    expect(
      readingOf(loading, waiting, served([], true), false, NOW)
    ).toMatchObject({
      empty: true,
      whole: true,
    });
  });

  it("reads the pages Convex answered with instead of the server's page, and offers to load the next", () => {
    const loadMore = vi.fn();
    const reading = readingOf(
      PaginatedQueryResult.canLoadMore({
        loadMore,
        results: [newest, older],
      }),
      waiting,
      served([newest], false),
      false,
      NOW
    );

    expect(reading).toMatchObject({
      empty: false,
      loaded: [newest, older],
      whole: false,
    });
    expect(reading.more).toBe(loadMore);
  });

  it("offers nothing to load while a page is on its way, and keeps the pages loaded", () => {
    expect(
      readingOf(
        PaginatedQueryResult.loadingMore({ results: [newest, older] }),
        waiting,
        served([newest], false),
        false,
        NOW
      )
    ).toMatchObject({
      loaded: [newest, older],
      more: null,
      whole: false,
    });
  });

  it("calls the list whole once Convex has no page left, and empty when no page holds a memory", () => {
    expect(
      readingOf(
        PaginatedQueryResult.exhausted({ results: [newest, older, oldest] }),
        waiting,
        served([newest], false),
        false,
        NOW
      )
    ).toMatchObject({ empty: false, more: null, whole: true });
    expect(
      readingOf(
        PaginatedQueryResult.exhausted<Memory>({ results: [] }),
        waiting,
        served([newest], false),
        false,
        NOW
      )
    ).toMatchObject({ empty: true, whole: true });
  });

  it("reads whether memory is paused from Convex once it answered, and from the server before that and for a visitor", () => {
    const first = served([], true);

    expect(
      readingOf(
        loading,
        QueryResult.succeed({ paused: true }),
        first,
        false,
        NOW
      ).paused
    ).toBe(true);
    expect(
      readingOf(
        loading,
        QueryResult.succeed({ paused: false }),
        first,
        true,
        NOW
      ).paused
    ).toBe(false);
    expect(readingOf(loading, waiting, first, true, NOW).paused).toBe(true);
    expect(
      readingOf(loading, QueryResult.succeed(null), first, true, NOW).paused
    ).toBe(true);
  });

  describe("a situation that has ended", () => {
    const ended = stored("ended", { validUntil: NOW - 1 });
    const today = stored("today", { validUntil: NOW });
    const coming = stored("coming", { validUntil: NOW + 1 });

    it("is not listed, from the first paint and from the pages Convex answered with", () => {
      expect(
        readingOf(
          loading,
          waiting,
          served([ended, today, coming, newest], false),
          false,
          NOW
        ).loaded
      ).toEqual([today, coming, newest]);
      expect(
        readingOf(
          PaginatedQueryResult.exhausted({
            results: [newest, ended, coming],
          }),
          waiting,
          served([], true),
          false,
          NOW
        ).loaded
      ).toEqual([newest, coming]);
    });

    it("leaves the learner with no memory to show when every memory has ended", () => {
      expect(
        readingOf(loading, waiting, served([ended], true), false, NOW)
      ).toMatchObject({ empty: true, loaded: [], whole: true });
    });
  });
});
