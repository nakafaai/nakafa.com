import { Id } from "@repo/backend/confect/_generated/id";
import { Option, Schema } from "effect";

/** The comment a page opens for its reader, as its address names it. */
const CommentSearch = Schema.Struct({ comment: Id("comments") });

/** The comment that the parsed search of an address names, if it names one. */
export function readFocusedComment(search: unknown) {
  return Option.map(
    Schema.decodeUnknownOption(CommentSearch)(search),
    ({ comment }) => comment
  );
}

/** Points a page's address at one of its comments, in the comments of the page. */
export function focusComment(url: URL, commentId: string) {
  url.searchParams.set("comment", commentId);
  url.hash = "comments";
  return `${url.pathname}${url.search}${url.hash}`;
}
