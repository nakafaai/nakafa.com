import { useMutation } from "@confect/react";
import { Id } from "@repo/backend/confect/_generated/id";
import posts from "@repo/backend/confect/_generated/refs/posts";
import { readLearnerText } from "@repo/backend/confect/writing/text";
import { Button } from "@repo/design-system/components/ui/button";
import { InputGroupTextarea } from "@repo/design-system/components/ui/input-group";
import { toast } from "@repo/design-system/lib/toast/notify";
import { randomUuid } from "@repo/utilities/uuid";
import { DateTime, Effect, Option, Result, Schema } from "effect";
import { createContext, type SubmitEventHandler, use } from "react";
import { useTranslations } from "use-intl";
import { FeedAvatar, FeedForm } from "@/components/user/feed";
import { insertDraftPost } from "@/components/user/posts/mutation";
import { usePostDraft } from "@/components/user/posts/provider";
import { remainingToShow } from "@/components/user/posts/remaining";
import type { ListPost } from "@/components/user/posts/state";
import { reportClientException } from "@/lib/analytics/client";
import type { PublicProfile } from "@/lib/profile/public";

/**
 * Writes a new post at the top of the owner's posts, in the first row of the
 * list. Post stays at the end of the row and turns on once the text can be
 * posted. The post shows at once and the text clears, so the author can write
 * the next one while the server saves it. A refused post says so and gives its
 * text back to the composer, ahead of any next post started there. The words
 * and the posts in flight live in the draft store, so they survive a Retry of
 * the list.
 */
export function PostComposer({
  disabled,
  profile,
}: {
  disabled: boolean;
  profile: PublicProfile;
}) {
  const text = usePostDraft((draft) => draft.text);
  const startSaving = usePostDraft((draft) => draft.startSaving);
  const finishSaving = usePostDraft((draft) => draft.finishSaving);
  const refuseSaving = usePostDraft((draft) => draft.refuseSaving);
  const startPost = useMutation(posts.mutations.create);
  const body = readLearnerText(text);

  /** Sends the trimmed text, and shows the post in the list while the server saves it. */
  const handleSubmit: SubmitEventHandler<HTMLFormElement> = (event) => {
    event.preventDefault();
    if (Result.isFailure(body)) {
      return;
    }
    const posted = body.success;
    Effect.runPromise(
      randomUuid.pipe(
        // The placeholder id of a post the server has not saved yet. The create
        // mutation sends only the text, so the server never sees this id, and
        // the saved post replaces the placeholder in the list.
        Effect.flatMap((uuid) =>
          Schema.decodeUnknownEffect(Id("posts"))(uuid).pipe(Effect.orDie)
        ),
        Effect.tap((draftId) => Effect.sync(() => startSaving(draftId))),
        Effect.flatMap((draftId) => {
          const draft: ListPost = {
            _creationTime: DateTime.toEpochMillis(DateTime.nowUnsafe()),
            _id: draftId,
            likeCount: 0,
            liked: false,
            text: posted,
          };
          const save = startPost.withOptimisticUpdate(insertDraftPost(draft));
          return Effect.tryPromise(() => save({ text: posted })).pipe(
            Effect.flatMap(Effect.fromResult),
            Effect.matchEffect({
              onSuccess: () => Effect.sync(() => finishSaving(draftId)),
              onFailure: (error) =>
                reportClientException(error, {
                  source: "components/user/posts/composer",
                }).pipe(
                  Effect.andThen(
                    Effect.sync(() => {
                      refuseSaving(draftId, posted);
                      toast.error({
                        title: "action-error.title",
                        description: "action-error.description",
                      });
                    })
                  )
                ),
            })
          );
        })
      )
    );
  };

  return (
    <PostComposerContext value={{ disabled, profile }}>
      <FeedForm onSubmit={handleSubmit}>
        <PostComposerFields />
      </FeedForm>
    </PostComposerContext>
  );
}

/**
 * The composer before the client arrives: the same fields, disabled, with nothing
 * to send. The server renders it, so the owner's first HTML keeps the composer.
 */
export function PostComposerFrame({ profile }: { profile: PublicProfile }) {
  return (
    <PostComposerContext value={{ disabled: true, profile }}>
      <FeedForm onSubmit={ignoreSubmit}>
        <PostComposerFields />
      </FeedForm>
    </PostComposerContext>
  );
}

/** A frame has nothing to send, so its submit only stops the browser from navigating. */
const ignoreSubmit: SubmitEventHandler<HTMLFormElement> = (event) => {
  event.preventDefault();
};

/** Whether the composer around the fields is closed, and the author it writes as. */
const PostComposerContext = createContext<{
  disabled: boolean;
  profile: PublicProfile;
} | null>(null);

/** The composer's fields and send button, which read the draft and need no client. */
function PostComposerFields() {
  const composer = use(PostComposerContext);
  if (composer === null) {
    throw new Error("PostComposerFields must be used within a composer");
  }
  const { disabled, profile } = composer;
  const t = useTranslations("Posts");
  const text = usePostDraft((draft) => draft.text);
  const setText = usePostDraft((draft) => draft.setText);
  const body = readLearnerText(text);
  const remaining = remainingToShow(text);
  return (
    <>
      <FeedAvatar mascot={profile.mascot} photo={profile.image} />
      <InputGroupTextarea
        aria-label={t("placeholder")}
        className="min-h-10 min-w-0 flex-1 px-0 py-2"
        disabled={disabled}
        name="text"
        onChange={(event) => setText(event.target.value)}
        placeholder={t("placeholder")}
        value={text}
      />
      <div className="flex shrink-0 items-center gap-3 pt-1">
        {Option.isSome(remaining) && (
          <span className="text-muted-foreground text-sm tabular-nums">
            {remaining.value}
          </span>
        )}
        <Button
          disabled={disabled || Result.isFailure(body)}
          size="sm"
          type="submit"
        >
          {t("post")}
        </Button>
      </div>
    </>
  );
}
