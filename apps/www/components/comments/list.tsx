"use client";

import {
  PaginatedQueryResult,
  useMutation,
  usePaginatedQuery,
} from "@confect/react";
import refs from "@repo/backend/confect/_generated/refs";
import { Intersection } from "@repo/design-system/components/ui/intersection";
import { Effect, Schema } from "effect";
import { useTranslations } from "next-intl";
import { useOptimistic } from "react";
import { toast } from "sonner";
import { CommentsAdd } from "@/components/comments/add";
import {
  CommentContent,
  type CommentDisplay,
  CommentItem,
  type CommentWithUser,
} from "@/components/comments/item";
import { DataFailure } from "@/components/shared/failure";
import { reportClientException } from "@/lib/analytics/client";
import { useViewer } from "@/lib/identity/client";

class CommentCreateError extends Schema.TaggedError<CommentCreateError>()(
  "CommentCreateError",
  { cause: Schema.Unknown }
) {}
type Draft = CommentDisplay & Pick<CommentWithUser, "slug">;
const noDrafts: Draft[] = [];

/** Owns the comment feed and pending submissions without inventing database IDs. */
export function CommentsList({ slug }: { slug: string }) {
  const user = useViewer((state) => state.account);
  const actionError = useTranslations("Common")("action-error");
  const pagination = usePaginatedQuery(
    refs.public.comments.queries.getCommentsBySlug,
    { slug },
    { initialNumItems: 25 }
  );
  const addComment = useMutation(refs.public.comments.mutations.addComment);
  const [drafts, showDraft] = useOptimistic(
    noDrafts,
    (previous, draft: Draft) => [draft, ...previous]
  );

  async function submit(text: string, parent?: CommentWithUser) {
    if (!user) {
      return false;
    }
    showDraft({
      _id: crypto.randomUUID(),
      _creationTime: Date.now(),
      text,
      slug,
      user: {
        _id: user.appUser._id,
        name: user.authUser.name,
        image: user.authUser.image ?? null,
      },
      replyToUser: parent?.user ?? null,
      ...(parent ? { parentId: parent._id, replyToText: parent.text } : {}),
    });
    return await Effect.runPromise(
      Effect.tryPromise({
        try: () =>
          addComment({
            slug,
            text,
            ...(parent ? { parentId: parent._id } : {}),
          }),
        catch: (cause) => new CommentCreateError({ cause }),
      }).pipe(
        Effect.flatMap((result) =>
          Effect.fromResult(result).pipe(
            Effect.mapError((cause) => new CommentCreateError({ cause }))
          )
        ),
        Effect.as(true),
        Effect.catchTag("CommentCreateError", (error) =>
          reportClientException(error, { source: "comment-create" }).pipe(
            Effect.andThen(Effect.sync(() => toast.error(actionError))),
            Effect.as(false)
          )
        )
      )
    );
  }

  return (
    <>
      <CommentsAdd onSubmit={submit} />
      {PaginatedQueryResult.isFailure(pagination) ? <DataFailure /> : null}
      <div className="flex flex-col gap-4">
        {drafts
          .filter((comment) => comment.slug === slug)
          .map((comment) => (
            <CommentContent comment={comment} key={comment._id} />
          ))}
        {pagination.results.map((comment) => (
          <CommentItem comment={comment} key={comment._id} submit={submit} />
        ))}
        {PaginatedQueryResult.isCanLoadMore(pagination) ? (
          <Intersection onIntersect={() => pagination.loadMore(25)} />
        ) : null}
      </div>
    </>
  );
}
