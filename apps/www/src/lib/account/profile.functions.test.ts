// @vitest-environment node
import { beforeEach, describe, expect, it } from "@effect/vitest";
import {
  answerProfileChat,
  answerProfileComments,
  answerProfileCommentsPage,
  answerProfilePosts,
  answerProfilePostsPage,
  answerProfileScreen,
} from "@/lib/account/profile.functions";

const mocks = vi.hoisted(() => ({
  profileChatHandler: vi.fn(),
  profileCommentsHandler: vi.fn(),
  profileCommentsPageHandler: vi.fn(),
  profilePostsHandler: vi.fn(),
  profilePostsPageHandler: vi.fn(),
  profileScreenHandler: vi.fn(),
}));

vi.mock("@/lib/account/profile.server", () => ({
  profileChatHandler: mocks.profileChatHandler,
  profileCommentsHandler: mocks.profileCommentsHandler,
  profileCommentsPageHandler: mocks.profileCommentsPageHandler,
  profilePostsHandler: mocks.profilePostsHandler,
  profilePostsPageHandler: mocks.profilePostsPageHandler,
  profileScreenHandler: mocks.profileScreenHandler,
}));

beforeEach(() => {
  vi.clearAllMocks();
});

const profile = { locale: "en", username: "nabil" } as const;
const page = { cursor: "next", locale: "en", username: "nabil" } as const;

describe("profile server functions", () => {
  it("hands each profile screen to its read with the profile's address", async () => {
    mocks.profileScreenHandler.mockResolvedValueOnce("screen");
    mocks.profilePostsHandler.mockResolvedValueOnce("posts");
    mocks.profileChatHandler.mockResolvedValueOnce("chats");
    mocks.profileCommentsHandler.mockResolvedValueOnce("comments");

    expect(await answerProfileScreen({ data: profile })).toBe("screen");
    expect(await answerProfilePosts({ data: profile })).toBe("posts");
    expect(await answerProfileChat({ data: profile })).toBe("chats");
    expect(await answerProfileComments({ data: profile })).toBe("comments");
    expect(mocks.profileScreenHandler).toHaveBeenCalledWith({ data: profile });
    expect(mocks.profilePostsHandler).toHaveBeenCalledWith({ data: profile });
    expect(mocks.profileChatHandler).toHaveBeenCalledWith({ data: profile });
    expect(mocks.profileCommentsHandler).toHaveBeenCalledWith({
      data: profile,
    });
  });

  it("hands each next page to its read with the cursor of the page before", async () => {
    mocks.profilePostsPageHandler.mockResolvedValueOnce("more posts");
    mocks.profileCommentsPageHandler.mockResolvedValueOnce("more comments");

    expect(await answerProfilePostsPage({ data: page })).toBe("more posts");
    expect(await answerProfileCommentsPage({ data: page })).toBe(
      "more comments"
    );
    expect(mocks.profilePostsPageHandler).toHaveBeenCalledWith({ data: page });
    expect(mocks.profileCommentsPageHandler).toHaveBeenCalledWith({
      data: page,
    });
  });
});
