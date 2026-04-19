import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import {
  ForumScrollProvider,
  useForumScroll,
} from "@/lib/context/use-forum-scroll";

const PROVIDER_ERROR =
  /useForumScroll must be used within a ForumScrollProvider/;
const postId = "post_1" as Id<"schoolClassForumPosts">;

/** Reads the jump action from the active forum scroll provider. */
function JumpReader() {
  const jumpToPostId = useForumScroll((state) => state.jumpToPostId);

  jumpToPostId(postId);
  return null;
}

/** Reads the latest action from the active forum scroll provider. */
function LatestReader() {
  const scrollToLatest = useForumScroll((state) => state.scrollToLatest);

  scrollToLatest();
  return null;
}

describe("lib/context/use-forum-scroll", () => {
  it("provides the jump action to descendants", () => {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    const jumpToPostId = vi.fn();

    act(() => {
      root.render(
        <ForumScrollProvider
          value={{
            jumpToPostId,
            scrollToLatest: vi.fn(),
          }}
        >
          <JumpReader />
        </ForumScrollProvider>
      );
    });

    expect(jumpToPostId).toHaveBeenCalledWith(postId);

    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it("provides the latest action to descendants", () => {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    const scrollToLatest = vi.fn();

    act(() => {
      root.render(
        <ForumScrollProvider
          value={{
            jumpToPostId: vi.fn(),
            scrollToLatest,
          }}
        >
          <LatestReader />
        </ForumScrollProvider>
      );
    });

    expect(scrollToLatest).toHaveBeenCalled();

    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it("throws when the hook is used outside its provider", () => {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);

    expect(() => {
      act(() => {
        root.render(createElement(JumpReader));
      });
    }).toThrow(PROVIDER_ERROR);

    act(() => {
      root.unmount();
    });
    container.remove();
  });
});
