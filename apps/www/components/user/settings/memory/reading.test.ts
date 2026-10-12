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

/** A stored memory written by Nina. */
function stored(name: string): Memory {
  return {
    author: "nina",
    confirmedAt: 1000,
    createdAt: 500,
    id: memoryId(name),
    text: `Text of ${name}`,
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
      readingOf(loading, waiting, served([newest, older], false), true)
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
      readingOf(loading, waiting, served([older], true), false)
    ).toMatchObject({ empty: false, whole: true });
    expect(readingOf(loading, waiting, served([], true), false)).toMatchObject({
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
      false
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
        false
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
        false
      )
    ).toMatchObject({ empty: false, more: null, whole: true });
    expect(
      readingOf(
        PaginatedQueryResult.exhausted<Memory>({ results: [] }),
        waiting,
        served([newest], false),
        false
      )
    ).toMatchObject({ empty: true, whole: true });
  });

  it("reads whether memory is paused from Convex once it answered, and from the server before that and for a visitor", () => {
    const first = served([], true);

    expect(
      readingOf(loading, QueryResult.succeed({ paused: true }), first, false)
        .paused
    ).toBe(true);
    expect(
      readingOf(loading, QueryResult.succeed({ paused: false }), first, true)
        .paused
    ).toBe(false);
    expect(readingOf(loading, waiting, first, true).paused).toBe(true);
    expect(
      readingOf(loading, QueryResult.succeed(null), first, true).paused
    ).toBe(true);
  });
});
