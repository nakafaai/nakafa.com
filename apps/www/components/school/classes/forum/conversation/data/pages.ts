import { api } from "@repo/backend/convex/_generated/api";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type { FunctionArgs, FunctionReturnType } from "convex/server";
import type {
  Forum,
  ForumPost,
} from "@/components/school/classes/forum/conversation/data/entities";

export const FORUM_BOTTOM_THRESHOLD = 1;
export const FORUM_PAGE_SIZE = 25;
export const FORUM_TOP_LOAD_THRESHOLD = 240;
export const FORUM_VIRTUAL_BUFFER = 600;

export const forumPostAnchorQuery =
  api.classes.forums.queries.pages.getForumPostAnchor;
export const forumPostsWindowQuery =
  api.classes.forums.queries.pages.getForumPostsWindow;

export type ForumPostAnchorResult = FunctionReturnType<
  typeof forumPostAnchorQuery
>;
export type ForumPostsWindowArgs = FunctionArgs<typeof forumPostsWindowQuery>;
export type ForumPostsWindowIndexKey = NonNullable<
  ForumPostsWindowArgs["startIndexKey"]
>;
export type ForumPostsWindowResult = FunctionReturnType<
  typeof forumPostsWindowQuery
>;

export interface TranscriptWindow {
  args: ForumPostsWindowArgs;
  id: string;
}

export type ConversationRow =
  | { type: "date"; value: number }
  | { type: "header" }
  | { post: ForumPost; type: "post" };

export type ForumPostsWindowResults = Record<
  string,
  Error | ForumPostsWindowResult | undefined
>;

const FORUM_MAX_SEQUENCE = Number.MAX_SAFE_INTEGER;
const FORUM_MIN_SEQUENCE = 0;

/** Returns the lowest range key for one forum transcript. */
export function getForumStartIndexKey(
  forumId: Id<"schoolClassForums">
): ForumPostsWindowIndexKey {
  return [forumId, FORUM_MIN_SEQUENCE];
}

/** Returns the highest range key for one forum transcript. */
export function getForumEndIndexKey(
  forumId: Id<"schoolClassForums">
): ForumPostsWindowIndexKey {
  return [forumId, FORUM_MAX_SEQUENCE];
}

/** Creates one desc window pinned to the latest edge of a forum. */
export function createLatestTranscriptWindow(
  forumId: Id<"schoolClassForums">
): TranscriptWindow {
  return {
    args: {
      endIndexKey: getForumStartIndexKey(forumId),
      forumId,
      numItems: FORUM_PAGE_SIZE,
      order: "desc",
      startIndexKey: getForumEndIndexKey(forumId),
    },
    id: crypto.randomUUID(),
  };
}

/** Creates the focused pair around one anchor post. */
export function createFocusedTranscriptWindows(
  forumId: Id<"schoolClassForums">,
  anchor: ForumPostAnchorResult
): TranscriptWindow[] {
  return [
    {
      args: {
        endIndexKey: getForumStartIndexKey(forumId),
        forumId,
        numItems: FORUM_PAGE_SIZE,
        order: "desc",
        startInclusive: true,
        startIndexKey: anchor.indexKey,
      },
      id: crypto.randomUUID(),
    },
    {
      args: {
        endIndexKey: getForumEndIndexKey(forumId),
        forumId,
        numItems: FORUM_PAGE_SIZE,
        order: "asc",
        startInclusive: false,
        startIndexKey: anchor.indexKey,
      },
      id: crypto.randomUUID(),
    },
  ];
}

/** Creates the next older desc window before the current oldest loaded post. */
export function createOlderTranscriptWindow(
  forumId: Id<"schoolClassForums">,
  oldestIndexKey: ForumPostsWindowIndexKey
): TranscriptWindow {
  return {
    args: {
      endIndexKey: getForumStartIndexKey(forumId),
      forumId,
      numItems: FORUM_PAGE_SIZE,
      order: "desc",
      startInclusive: false,
      startIndexKey: oldestIndexKey,
    },
    id: crypto.randomUUID(),
  };
}

/** Creates the next newer asc window after the current newest loaded post. */
export function createNewerTranscriptWindow(
  forumId: Id<"schoolClassForums">,
  newestIndexKey: ForumPostsWindowIndexKey
): TranscriptWindow {
  return {
    args: {
      endIndexKey: getForumEndIndexKey(forumId),
      forumId,
      numItems: FORUM_PAGE_SIZE,
      order: "asc",
      startInclusive: false,
      startIndexKey: newestIndexKey,
    },
    id: crypto.randomUUID(),
  };
}

/** Builds the dynamic `useQueries(windowMap)` request object. */
export function createTranscriptQueryRequests(windows: TranscriptWindow[]) {
  return Object.fromEntries(
    windows.map((window) => [
      window.id,
      {
        args: window.args,
        query: forumPostsWindowQuery,
      },
    ])
  );
}

/** Throws query failures into the existing error boundary instead of hiding them. */
export function getForumPostsWindowResult(
  value: Error | ForumPostsWindowResult | undefined
) {
  if (!value) {
    return null;
  }

  if (value instanceof Error) {
    throw value;
  }

  return value;
}

/** Returns the oldest index key that is currently loaded in one window. */
export function getOldestWindowIndexKey(
  window: TranscriptWindow,
  result: ForumPostsWindowResult | null
) {
  if (!result || result.indexKeys.length === 0) {
    return null;
  }

  if (window.args.order === "desc") {
    return result.indexKeys.at(-1) ?? null;
  }

  return result.indexKeys[0] ?? null;
}

/** Returns the newest index key that is currently loaded in one window. */
export function getNewestWindowIndexKey(
  window: TranscriptWindow,
  result: ForumPostsWindowResult | null
) {
  if (!result || result.indexKeys.length === 0) {
    return null;
  }

  if (window.args.order === "desc") {
    return result.indexKeys[0] ?? null;
  }

  return result.indexKeys.at(-1) ?? null;
}

/** Flattens reactive desc/asc windows into one ascending transcript post list. */
export function flattenConversationPosts(
  windows: TranscriptWindow[],
  queryResults: ForumPostsWindowResults
) {
  return windows.flatMap((window) => {
    const result = getForumPostsWindowResult(queryResults[window.id]);

    if (!result) {
      return [];
    }

    if (window.args.order === "desc") {
      return [...result.page].reverse();
    }

    return result.page;
  });
}

/** Builds the final Virtua row model while preserving header and date separators. */
export function createConversationRows({
  forum,
  posts,
}: {
  forum: Forum | undefined;
  posts: ForumPost[];
}) {
  const rows: ConversationRow[] = forum ? [{ type: "header" }] : [];
  let previousDate: string | null = null;

  for (const post of posts) {
    const currentDate = new Date(post._creationTime).toDateString();

    if (currentDate !== previousDate) {
      rows.push({ type: "date", value: post._creationTime });
      previousDate = currentDate;
    }

    rows.push({ post, type: "post" });
  }

  return rows;
}

/** Returns the final post id in one flattened transcript list. */
export function getLastConversationPostId(posts: ForumPost[]) {
  return posts.at(-1)?._id ?? null;
}

/** Finds the current Virtua row index for one post id. */
export function getPostRowIndex(
  rows: ConversationRow[],
  postId: Id<"schoolClassForumPosts">
) {
  return rows.findIndex(
    (row) => row.type === "post" && row.post._id === postId
  );
}

/** Returns the stable Virtua key for one rendered conversation row. */
export function getConversationRowKey(
  row: ConversationRow,
  forumId: Forum["_id"] | undefined
) {
  if (row.type === "header") {
    return forumId ?? "header";
  }

  if (row.type === "date") {
    return `date:${row.value}`;
  }

  return row.post._id;
}
