// @vitest-environment node

import { PaginatedQueryResult } from "@confect/react";
import { describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import { readFirstPage, usePaginatedPreloaded } from "@/lib/data/paginated";

/** The live page that the mocked Confect hook returns. */
const live = vi.hoisted(() => ({ next: vi.fn<() => unknown>() }));

vi.mock("@confect/react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@confect/react")>()),
  usePaginatedQuery: () => live.next(),
}));

describe("paginated first page", () => {
  it("shows the live list once its subscription has a page", () => {
    const current = PaginatedQueryResult.exhausted({ results: ["live"] });
    expect(readFirstPage(current, { isDone: false, page: ["loader"] })).toBe(
      current
    );
  });

  it("shows the loader's last page as the whole list", () => {
    const page = readFirstPage(
      PaginatedQueryResult.loadingFirstPage({ skipped: false }),
      { isDone: true, page: ["loader"] }
    );
    expect(PaginatedQueryResult.isLoadingFirstPage(page)).toBe(false);
    expect(page.results).toStrictEqual(["loader"]);
  });

  it("shows the loader's first page as loading more, with no load more until the subscription has its page", () => {
    const page = readFirstPage(
      PaginatedQueryResult.loadingFirstPage({ skipped: false }),
      { isDone: false, page: ["loader"] }
    );
    expect(page.results).toStrictEqual(["loader"]);
    expect(PaginatedQueryResult.isLoadingFirstPage(page)).toBe(false);
    expect(PaginatedQueryResult.isLoadingMore(page)).toBe(true);
    expect(PaginatedQueryResult.isCanLoadMore(page)).toBe(false);
  });
});

describe("paginated first page without a loader page", () => {
  it("keeps the live result when the loader has no page for these arguments", () => {
    const loading = PaginatedQueryResult.loadingFirstPage({ skipped: false });
    expect(readFirstPage(loading, undefined)).toBe(loading);
  });
});

describe("paginated preloaded hook", () => {
  const ref = refs.public.contents.queries.recent.getRecentlyViewed;

  it("returns the loader's first page while the subscription loads", () => {
    live.next.mockReturnValue(
      PaginatedQueryResult.loadingFirstPage({ skipped: false })
    );
    const page = usePaginatedPreloaded(
      ref,
      { locale: "en" },
      {
        initialNumItems: 2,
      },
      { isDone: true, page: [] }
    );
    expect(page.results).toStrictEqual([]);
  });
});
