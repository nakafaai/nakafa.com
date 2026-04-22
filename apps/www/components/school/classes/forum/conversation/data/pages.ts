import { api } from "@repo/backend/convex/_generated/api";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type { FunctionReturnType } from "convex/server";
import type { ForumPost } from "@/components/school/classes/forum/conversation/data/entities";

export const FORUM_BOTTOM_THRESHOLD = 1;
export const FORUM_PAGE_SIZE = 25;
export const FORUM_TOP_LOAD_THRESHOLD = 240;
export const FORUM_VIRTUAL_BUFFER = 600;
export const forumPostsPageQuery =
  api.classes.forums.queries.pages.getForumPostsPage;

export type ForumPostsPageResult = FunctionReturnType<
  typeof forumPostsPageQuery
>;

export interface TranscriptPage {
  cursor: string | null;
  endCursor?: string;
  id: string;
}

export type ConversationRow =
  | { type: "header" }
  | { post: ForumPost; type: "post" };

export type ForumPostsPageResults = Record<
  string,
  Error | ForumPostsPageResult | undefined
>;

/** Create one reactive page descriptor for Convex `useQueries`. */
export function createTranscriptPage(cursor: string | null): TranscriptPage {
  return {
    cursor,
    id: crypto.randomUUID(),
  };
}

/** Ignore unresolved and failed `useQueries` results until Convex settles them. */
export function getForumPostsPageResult(
  value: Error | ForumPostsPageResult | undefined
) {
  if (!value || value instanceof Error) {
    return null;
  }

  return value;
}

/** Build one Convex request map that `useQueries` can subscribe to reactively. */
export function createTranscriptQueryRequests(
  pages: TranscriptPage[],
  forumId: Id<"schoolClassForums">,
  numItems: number
) {
  return Object.fromEntries(
    pages.map((page) => [
      page.id,
      {
        args: {
          cursor: page.cursor,
          forumId,
          numItems,
          ...(page.endCursor ? { endCursor: page.endCursor } : {}),
        },
        query: forumPostsPageQuery,
      },
    ])
  );
}

/** Flatten pinned Convex pages into one ascending transcript row model. */
export function createConversationRows(
  pages: TranscriptPage[],
  queryResults: ForumPostsPageResults,
  withHeader: boolean
): ConversationRow[] {
  const postRows = pages.flatMap((page) => {
    const result = getForumPostsPageResult(queryResults[page.id]);
    return result
      ? result.page.map((post) => ({ post, type: "post" as const })).reverse()
      : [];
  });

  if (!withHeader) {
    return postRows;
  }

  return [{ type: "header" }, ...postRows];
}

/** Read the newest pinned page so the transcript can block until it is ready. */
export function getLatestTranscriptPageResult(
  pages: TranscriptPage[],
  queryResults: ForumPostsPageResults
) {
  const latestPage = pages.at(-1);

  if (!latestPage) {
    return null;
  }

  return getForumPostsPageResult(queryResults[latestPage.id]);
}
