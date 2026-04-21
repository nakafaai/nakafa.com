import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { act, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ConversationProvider,
  useConversation,
} from "@/components/school/classes/forum/conversation/provider";
import type { Forum } from "@/components/school/classes/forum/conversation/types";

const forumStoreMock = vi.hoisted(() => ({
  isHydrated: true,
  saveConversationView: vi.fn(),
  savedConversationViews: {} as Record<string, unknown>,
}));

vi.mock("convex/react", () => ({
  useConvex: () => ({
    query: vi.fn(),
  }),
  useMutation: () => vi.fn(),
  usePaginatedQuery: () => ({
    loadMore: vi.fn(),
    results: [],
    status: "Exhausted",
  }),
}));

vi.mock(
  "@/components/school/classes/forum/conversation/context/use-forum",
  () => ({
    useForum: (selector: (state: typeof forumStoreMock) => unknown) =>
      selector(forumStoreMock),
  })
);

const mountedRoots: Array<() => void> = [];
const currentUserId = "user_1" as Id<"users">;
const forumId = "forum_1" as Id<"schoolClassForums">;

/** Creates one minimal forum payload for provider tests. */
function createForum(): Forum {
  const createdTime = Date.UTC(2026, 3, 21, 10, 0, 0);

  return {
    _creationTime: createdTime,
    _id: forumId,
    body: "Forum body",
    classId: "class_1" as Id<"schoolClasses">,
    createdBy: currentUserId,
    isPinned: false,
    lastPostAt: createdTime,
    lastPostBy: currentUserId,
    myReactions: [],
    nextPostSequence: 2,
    postCount: 1,
    reactionCounts: [],
    reactionUsers: [],
    schoolId: "school_1" as Id<"schools">,
    status: "open",
    tag: "general",
    title: "Forum title",
    updatedAt: createdTime,
    user: null,
  } satisfies Forum;
}

/** Mounts the provider once and returns the detached container for assertions. */
function renderWithProvider(children: ReactNode) {
  const container = document.createElement("div");
  const root = createRoot(container);

  document.body.append(container);

  act(() => {
    root.render(
      <ConversationProvider
        currentUserId={currentUserId}
        forum={createForum()}
        forumId={forumId}
      >
        {children}
      </ConversationProvider>
    );
  });

  mountedRoots.push(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  return container;
}

afterEach(() => {
  while (mountedRoots.length > 0) {
    mountedRoots.pop()?.();
  }
});

describe("conversation/provider", () => {
  beforeEach(() => {
    forumStoreMock.saveConversationView.mockClear();
  });

  it("exposes selected runtime store state from the active provider", () => {
    let selectedForumId = "" as Id<"schoolClassForums">;
    let selectedBottomState = true;

    /** Reads two representative runtime slices from the provider store. */
    function Probe() {
      selectedForumId = useConversation((state) => state.forumId);
      selectedBottomState = useConversation((state) => state.isAtBottom);
      return null;
    }

    renderWithProvider(<Probe />);

    expect(selectedForumId).toBe(forumId);
    expect(selectedBottomState).toBe(false);
  });
});
