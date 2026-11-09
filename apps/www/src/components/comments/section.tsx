import { CommentComposer } from "@/components/comments/composer";
import { CommentsHeader } from "@/components/comments/header";
import { CommentsList } from "@/components/comments/list";
import { CommentsProvider } from "@/components/comments/provider";
import { CommentsPlaceContext } from "@/components/comments/scope";

/**
 * The comments of a page, as a video's: the header with how many there are and their order, the composer
 * of a new comment, then the comments, each with its replies one level below it.
 */
export function Comments() {
  return (
    <CommentsPlaceContext value="page">
      <CommentsProvider>
        <section aria-labelledby="comments" className="flex flex-col gap-4">
          <CommentsHeader />
          <CommentComposer />
          <CommentsList />
        </section>
      </CommentsProvider>
    </CommentsPlaceContext>
  );
}
