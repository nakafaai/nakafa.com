import { createFileRoute, notFound, redirect } from "@tanstack/react-router";
import { Effect, Option } from "effect";

/**
 * The address of one comment, which an inbox row opens: it finds the page that
 * shows the comment in the reader's language and moves there, and a comment that
 * no page shows any more is not found. The redirect is a framework boundary, so the
 * read runs here and draws nothing.
 */
export const Route = createFileRoute("/$locale/_main/_app/comment/$commentId")({
  beforeLoad: async ({ params }) => {
    const { readCommentAddress } = await import("@/lib/comments/place");
    const address = await Effect.runPromise(
      readCommentAddress(params.locale, params.commentId)
    );
    if (Option.isNone(address)) {
      throw notFound();
    }
    // The address is the server's answer, so it stays an href, not a typed route.
    throw redirect({ href: address.value, statusCode: 307 });
  },
});
