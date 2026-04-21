import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type { ForumPost } from "@/components/school/classes/forum/conversation/models";
import type {
  FocusedWindowResult,
  NewerWindowResult,
  OlderWindowResult,
} from "@/components/school/classes/forum/conversation/store/runtime/types";
import type { Forum } from "@/components/school/classes/forum/conversation/types";
import { FORUM_CONVERSATION_WINDOW } from "@/components/school/classes/forum/conversation/utils/focused";

const PLAYWRIGHT_FORUM_ID = "forum_playwright" as Id<"schoolClassForums">;
const PLAYWRIGHT_USER_ID = "user_playwright" as Id<"users">;
const PLAYWRIGHT_CLASS_ID = "class_playwright" as Id<"schoolClasses">;
const PLAYWRIGHT_SCHOOL_ID = "school_playwright" as Id<"schools">;
const PLAYWRIGHT_BASE_TIME = Date.UTC(2026, 3, 21, 8, 0, 0);
const PLAYWRIGHT_FIRST_SEQUENCE = 101;

export type ConversationPlaywrightScenario = "image" | "long" | "short";

export interface ConversationPlaywrightFixture {
  classId: string;
  currentUserId: Id<"users">;
  forum: Forum;
  forumId: Id<"schoolClassForums">;
  jumpTargetPostId: Id<"schoolClassForumPosts">;
  posts: ForumPost[];
  replySourcePostId: Id<"schoolClassForumPosts">;
  replyTargetPostId: Id<"schoolClassForumPosts">;
}

const PLAYWRIGHT_USER = {
  _id: PLAYWRIGHT_USER_ID,
  email: "playwright@nakafa.test",
  image: "",
  name: "Playwright User",
} as const;

function createBody({
  scenario,
  sequence,
}: {
  scenario: ConversationPlaywrightScenario;
  sequence: number;
}) {
  if (scenario !== "image" || sequence % 7 !== 0) {
    return `Post ${sequence}\n\nIsi percakapan deterministik untuk skenario ${scenario}.`;
  }

  const delay = 120 + ((sequence / 7) % 3) * 80;

  return [
    `Post ${sequence} dengan gambar`,
    "",
    `<img alt="Forum image ${sequence}" src="/api/playwright/forum-image?label=${sequence}&delay=${delay}" />`,
    "",
    `Paragraf setelah gambar ${sequence}.`,
  ].join("\n");
}

function createForumPost({
  allSequences,
  scenario,
  sequence,
}: {
  allSequences: number[];
  scenario: ConversationPlaywrightScenario;
  sequence: number;
}) {
  const createdTime = PLAYWRIGHT_BASE_TIME + sequence * 60_000;
  let replyTargetSequence: number | null = null;

  if (sequence === 154) {
    replyTargetSequence = 118;
  } else if (sequence === 158) {
    replyTargetSequence = 132;
  }
  const replyTargetPostId =
    replyTargetSequence && allSequences.includes(replyTargetSequence)
      ? (`forum_post_${replyTargetSequence}` as Id<"schoolClassForumPosts">)
      : undefined;

  return {
    _creationTime: createdTime,
    _id: `forum_post_${sequence}` as Id<"schoolClassForumPosts">,
    attachments: [],
    body: createBody({
      scenario,
      sequence,
    }),
    classId: PLAYWRIGHT_CLASS_ID,
    createdBy: PLAYWRIGHT_USER_ID,
    forumId: PLAYWRIGHT_FORUM_ID,
    isUnread: false,
    mentions: [],
    myReactions: [],
    parentId: replyTargetPostId,
    reactionCounts: [],
    reactionUsers: [],
    replyCount: 0,
    replyToBody: replyTargetPostId
      ? `Target ${replyTargetSequence}`
      : undefined,
    replyToUser: replyTargetPostId ? PLAYWRIGHT_USER : null,
    replyToUserId: replyTargetPostId ? PLAYWRIGHT_USER_ID : undefined,
    sequence,
    updatedAt: createdTime,
    user: PLAYWRIGHT_USER,
  } satisfies ForumPost;
}

function createPosts(scenario: ConversationPlaywrightScenario) {
  const totalPosts = scenario === "short" ? 8 : 60;
  const sequences = Array.from(
    { length: totalPosts },
    (_, index) => PLAYWRIGHT_FIRST_SEQUENCE + index
  );

  return Array.from({ length: totalPosts }, (_, index) =>
    createForumPost({
      allSequences: sequences,
      scenario,
      sequence: sequences[index],
    })
  );
}

function createForum(posts: ForumPost[]) {
  const lastPost = posts.at(-1);

  return {
    _creationTime: PLAYWRIGHT_BASE_TIME,
    _id: PLAYWRIGHT_FORUM_ID,
    body: "Playwright forum body",
    classId: PLAYWRIGHT_CLASS_ID,
    createdBy: PLAYWRIGHT_USER_ID,
    isPinned: false,
    lastPostAt: lastPost?._creationTime ?? PLAYWRIGHT_BASE_TIME,
    lastPostBy: PLAYWRIGHT_USER_ID,
    myReactions: [],
    nextPostSequence: (lastPost?.sequence ?? PLAYWRIGHT_FIRST_SEQUENCE) + 1,
    postCount: posts.length,
    reactionCounts: [],
    reactionUsers: [],
    schoolId: PLAYWRIGHT_SCHOOL_ID,
    status: "open",
    tag: "general",
    title: "Playwright forum conversation",
    updatedAt: lastPost?._creationTime ?? PLAYWRIGHT_BASE_TIME,
    user: null,
  } satisfies Forum;
}

export function createConversationPlaywrightFixture(
  scenario: ConversationPlaywrightScenario
) {
  const posts = createPosts(scenario);
  const jumpTargetPostId =
    posts[scenario === "short" ? 2 : 14]?._id ?? posts[0]._id;
  const replySourcePostId = posts.find(
    (post) => post._id === ("forum_post_154" as Id<"schoolClassForumPosts">)
  )
    ? ("forum_post_154" as Id<"schoolClassForumPosts">)
    : jumpTargetPostId;
  const replyTargetPostId = posts.find(
    (post) => post._id === ("forum_post_118" as Id<"schoolClassForumPosts">)
  )
    ? ("forum_post_118" as Id<"schoolClassForumPosts">)
    : jumpTargetPostId;

  return {
    classId: `playwright-forum-${scenario}`,
    currentUserId: PLAYWRIGHT_USER_ID,
    forum: createForum(posts),
    forumId: PLAYWRIGHT_FORUM_ID,
    jumpTargetPostId,
    posts,
    replySourcePostId,
    replyTargetPostId,
  } satisfies ConversationPlaywrightFixture;
}

export function appendConversationPlaywrightPost({
  currentPosts,
  scenario,
}: {
  currentPosts: ForumPost[];
  scenario: ConversationPlaywrightScenario;
}) {
  const nextSequence =
    (currentPosts.at(-1)?.sequence ?? PLAYWRIGHT_FIRST_SEQUENCE) + 1;

  return createForumPost({
    allSequences: [...currentPosts.map((post) => post.sequence), nextSequence],
    scenario,
    sequence: nextSequence,
  });
}

export function getLiveWindowPosts(posts: ForumPost[], liveWindowSize: number) {
  return posts.slice(-liveWindowSize);
}

export function loadOlderLiveWindow({
  liveWindowSize,
  posts,
}: {
  liveWindowSize: number;
  posts: ForumPost[];
}) {
  return Math.min(liveWindowSize + FORUM_CONVERSATION_WINDOW, posts.length);
}

export function fetchFocusedWindow({
  postId,
  posts,
}: {
  postId: Id<"schoolClassForumPosts">;
  posts: ForumPost[];
}) {
  const targetIndex = posts.findIndex((post) => post._id === postId);

  if (targetIndex < 0) {
    throw new Error(`Unknown post id: ${postId}`);
  }

  let startIndex = Math.max(
    0,
    targetIndex - Math.floor(FORUM_CONVERSATION_WINDOW / 2)
  );
  const endIndex = Math.min(
    posts.length,
    startIndex + FORUM_CONVERSATION_WINDOW
  );

  startIndex = Math.max(0, endIndex - FORUM_CONVERSATION_WINDOW);

  const focusedPosts = posts.slice(startIndex, endIndex);

  return {
    hasMoreAfter: endIndex < posts.length,
    hasMoreBefore: startIndex > 0,
    newestPostId: focusedPosts.at(-1)?._id ?? null,
    oldestPostId: focusedPosts[0]?._id ?? null,
    posts: focusedPosts,
  } satisfies FocusedWindowResult;
}

export function fetchNewerWindow({
  postId,
  posts,
}: {
  postId: Id<"schoolClassForumPosts">;
  posts: ForumPost[];
}) {
  const currentIndex = posts.findIndex((post) => post._id === postId);

  if (currentIndex < 0) {
    throw new Error(`Unknown post id: ${postId}`);
  }

  const startIndex = Math.max(0, currentIndex + 1);
  const endIndex = Math.min(
    posts.length,
    startIndex + FORUM_CONVERSATION_WINDOW
  );
  const newerPosts = posts.slice(startIndex, endIndex);

  return {
    hasMore: endIndex < posts.length,
    newestPostId: newerPosts.at(-1)?._id ?? null,
    posts: newerPosts,
  } satisfies NewerWindowResult;
}

export function fetchOlderWindow({
  postId,
  posts,
}: {
  postId: Id<"schoolClassForumPosts">;
  posts: ForumPost[];
}) {
  const currentIndex = posts.findIndex((post) => post._id === postId);

  if (currentIndex < 0) {
    throw new Error(`Unknown post id: ${postId}`);
  }

  const startIndex = Math.max(0, currentIndex - FORUM_CONVERSATION_WINDOW);
  const olderPosts = posts.slice(startIndex, currentIndex);

  return {
    hasMore: startIndex > 0,
    oldestPostId: olderPosts[0]?._id ?? null,
    posts: olderPosts,
  } satisfies OlderWindowResult;
}
