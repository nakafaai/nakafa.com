import { describe, expect, it } from "vitest";
import {
  getForumPrefetchDistance,
  getNextForumHistoryBoundaryIntent,
  shouldRequestHistoryBoundary,
} from "@/components/school/classes/forum/conversation/utils/scroll-policy";

describe("forum conversation scroll policy", () => {
  it("uses the minimum prefetch distance on small viewports", () => {
    expect(getForumPrefetchDistance(100)).toBe(200);
  });

  it("scales with the viewport inside the normal range", () => {
    expect(getForumPrefetchDistance(400)).toBe(300);
  });

  it("caps the prefetch distance on large viewports", () => {
    expect(getForumPrefetchDistance(1200)).toBe(600);
  });

  it("keeps history continuation armed only while the user still pushes that edge", () => {
    expect(
      getNextForumHistoryBoundaryIntent({
        currentIntent: null,
        isMovingDown: false,
        isMovingUp: true,
        isNearBottom: false,
        isNearTop: true,
      })
    ).toBe("older");

    expect(
      getNextForumHistoryBoundaryIntent({
        currentIntent: "older",
        isMovingDown: false,
        isMovingUp: false,
        isNearBottom: false,
        isNearTop: true,
      })
    ).toBe("older");

    expect(
      getNextForumHistoryBoundaryIntent({
        currentIntent: "older",
        isMovingDown: true,
        isMovingUp: false,
        isNearBottom: false,
        isNearTop: true,
      })
    ).toBeNull();

    expect(
      getNextForumHistoryBoundaryIntent({
        currentIntent: "older",
        isMovingDown: false,
        isMovingUp: false,
        isNearBottom: false,
        isNearTop: false,
      })
    ).toBeNull();

    expect(
      getNextForumHistoryBoundaryIntent({
        currentIntent: null,
        isMovingDown: true,
        isMovingUp: false,
        isNearBottom: true,
        isNearTop: false,
      })
    ).toBe("newer");

    expect(
      getNextForumHistoryBoundaryIntent({
        currentIntent: "newer",
        isMovingDown: false,
        isMovingUp: true,
        isNearBottom: true,
        isNearTop: false,
      })
    ).toBeNull();

    expect(
      getNextForumHistoryBoundaryIntent({
        currentIntent: "newer",
        isMovingDown: false,
        isMovingUp: false,
        isNearBottom: false,
        isNearTop: false,
      })
    ).toBeNull();
  });

  it("requests another history page only when the boundary meaningfully changes", () => {
    expect(
      shouldRequestHistoryBoundary({
        boundaryPostId: "post_1",
        hasMore: true,
        isLoading: false,
        lastRequestedBoundaryPostId: null,
      })
    ).toBe(true);

    expect(
      shouldRequestHistoryBoundary({
        boundaryPostId: "post_1",
        hasMore: true,
        isLoading: false,
        lastRequestedBoundaryPostId: "post_1",
      })
    ).toBe(false);

    expect(
      shouldRequestHistoryBoundary({
        boundaryPostId: "post_2",
        hasMore: true,
        isLoading: false,
        lastRequestedBoundaryPostId: "post_1",
      })
    ).toBe(true);

    expect(
      shouldRequestHistoryBoundary({
        boundaryPostId: null,
        hasMore: true,
        isLoading: false,
        lastRequestedBoundaryPostId: null,
      })
    ).toBe(false);

    expect(
      shouldRequestHistoryBoundary({
        boundaryPostId: "post_1",
        hasMore: false,
        isLoading: false,
        lastRequestedBoundaryPostId: null,
      })
    ).toBe(false);

    expect(
      shouldRequestHistoryBoundary({
        boundaryPostId: "post_1",
        hasMore: true,
        isLoading: true,
        lastRequestedBoundaryPostId: null,
      })
    ).toBe(false);
  });
});
