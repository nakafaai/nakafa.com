// @vitest-environment node

import { PaginatedQueryResult } from "@confect/react";
import { describe, expect, it } from "@effect/vitest";
import { Option } from "effect";
import { useInbox } from "@/components/notifications/inbox";

const mocks = vi.hoisted(() => ({
  settled: { isLoading: false },
  usePaginatedQuery: vi.fn<(...args: unknown[]) => unknown>(),
}));

vi.mock("@/components/providers/convex", () => ({
  useConvexAuth: (select: (auth: { isLoading: boolean }) => boolean) =>
    select(mocks.settled),
}));

vi.mock("@confect/react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@confect/react")>()),
  usePaginatedQuery: mocks.usePaginatedQuery,
}));

describe("useInbox", () => {
  it("subscribes to the inbox once the session has settled, and shows the loader's page until it answers", () => {
    mocks.settled.isLoading = false;
    mocks.usePaginatedQuery.mockReturnValue(
      PaginatedQueryResult.loadingFirstPage({ skipped: false })
    );

    const inbox = useInbox(Option.some({ isDone: true, page: [] }));

    expect(mocks.usePaginatedQuery).toHaveBeenLastCalledWith(
      expect.anything(),
      {},
      { initialNumItems: 20 }
    );
    expect(inbox).toStrictEqual({
      empty: true,
      failed: false,
      loadMore: undefined,
      ready: false,
      rows: [],
    });
  });

  it("skips the subscription while the session is still loading", () => {
    mocks.settled.isLoading = true;
    mocks.usePaginatedQuery.mockReturnValue(
      PaginatedQueryResult.loadingFirstPage({ skipped: true })
    );

    const inbox = useInbox(Option.none());

    expect(mocks.usePaginatedQuery).toHaveBeenLastCalledWith(
      expect.anything(),
      "skip",
      { initialNumItems: 20 }
    );
    expect(inbox.ready).toBe(false);
  });

  it("offers the next page once the live inbox can load more", () => {
    mocks.settled.isLoading = false;
    const loadMore = vi.fn<(numItems: number) => void>();
    mocks.usePaginatedQuery.mockReturnValue(
      PaginatedQueryResult.canLoadMore({ loadMore, results: [] })
    );

    const inbox = useInbox(Option.none());
    inbox.loadMore?.();

    expect(loadMore).toHaveBeenCalledExactlyOnceWith(20);
  });
});
