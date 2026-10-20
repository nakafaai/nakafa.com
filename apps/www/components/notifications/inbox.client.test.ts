// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import { Option } from "effect";
import { useInbox } from "@/components/notifications/inbox.client";

const mocks = vi.hoisted(() => ({
  settled: { isLoading: false },
  usePaginatedPreloaded: vi.fn<(...args: unknown[]) => unknown>(),
}));

vi.mock("@/components/providers/convex", () => ({
  useConvexAuth: (select: (auth: { isLoading: boolean }) => boolean) =>
    select(mocks.settled),
}));

vi.mock("@/lib/data/paginated", () => ({
  usePaginatedPreloaded: mocks.usePaginatedPreloaded,
}));

describe("useInbox", () => {
  it("subscribes to the inbox once the session has settled, from the loader's page", () => {
    mocks.settled.isLoading = false;
    const first = Option.some({ isDone: true, page: [] });

    const page = { results: [] };
    mocks.usePaginatedPreloaded.mockReturnValue(page);

    expect(useInbox(first)).toBe(page);
    expect(mocks.usePaginatedPreloaded).toHaveBeenLastCalledWith(
      expect.anything(),
      {},
      { initialNumItems: 20 },
      first
    );
  });

  it("skips the subscription while the session is still loading", () => {
    mocks.settled.isLoading = true;

    useInbox(Option.none());

    expect(mocks.usePaginatedPreloaded).toHaveBeenLastCalledWith(
      expect.anything(),
      "skip",
      { initialNumItems: 20 },
      Option.none()
    );
  });
});
