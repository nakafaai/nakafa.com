"use client";

import { useMutation } from "@confect/react";
import { Id } from "@repo/backend/confect/_generated/id";
import posts from "@repo/backend/confect/_generated/refs/posts";
import {
  readPostText,
  remainingPostCharacters,
} from "@repo/backend/confect/posts/schema";
import { photoOf } from "@repo/backend/confect/users/picture";
import { Button } from "@repo/design-system/components/ui/button";
import { PersonAvatar } from "@repo/design-system/components/ui/person";
import { Textarea } from "@repo/design-system/components/ui/textarea";
import { randomUuid } from "@repo/utilities/uuid";
import { DateTime, Effect, Result, Schema } from "effect";
import { useTranslations } from "next-intl";
import { type SubmitEventHandler, useState, useTransition } from "react";
import { toast } from "sonner";
import { insertDraftPost } from "@/components/user/posts/mutation.client";
import { usePostDraft } from "@/components/user/posts/provider";
import type { ListPost } from "@/components/user/posts/state";
import { reportClientException } from "@/lib/analytics/client";
import type { CurrentUser } from "@/lib/identity/client";

/** The characters left at which the composer starts to show how many remain. */
const SHOW_REMAINING_FROM = 50;

/**
 * Writes a new post at the top of the owner's posts. The post shows at once,
 * and the text is locked while the server saves it, so a refused post gives its
 * text back to the composer with a message. The words live in the draft store,
 * so they survive a Retry of the list.
 */
export function PostComposer({
  appUser,
  disabled,
}: {
  appUser: CurrentUser["appUser"];
  disabled: boolean;
}) {
  const t = useTranslations("Posts");
  const tCommon = useTranslations("Common");
  const text = usePostDraft((draft) => draft.text);
  const setText = usePostDraft((draft) => draft.setText);
  const [focused, setFocused] = useState(false);
  const [isPosting, startPostTransition] = useTransition();
  const startPost = useMutation(posts.mutations.create);
  const body = readPostText(text);
  const remaining = remainingPostCharacters(text);

  /** Sends the trimmed text, and shows the post in the list while the server saves it. */
  const handleSubmit: SubmitEventHandler<HTMLFormElement> = (event) => {
    event.preventDefault();
    if (Result.isFailure(body)) {
      return;
    }
    const posted = body.success;
    setText("");
    // The change runs outside the transition below. A change made inside a
    // transition waits for the server, so the post would not show at once.
    const saved = Effect.runPromise(
      randomUuid.pipe(
        // The placeholder id of a post the server has not saved yet. It is
        // never sent to the server, and the saved post replaces it.
        Effect.flatMap((uuid) =>
          Schema.decodeUnknownEffect(Id("posts"))(uuid).pipe(Effect.orDie)
        ),
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
            Effect.flatMap(Effect.fromResult)
          );
        }),
        Effect.matchEffect({
          onSuccess: () => Effect.void,
          onFailure: (error) =>
            reportClientException(error, {
              source: "components/user/posts/composer",
            }).pipe(
              Effect.andThen(
                Effect.sync(() => {
                  // The text is locked until the server answers, so it is empty
                  // and the refused text takes its place.
                  setText(posted);
                  toast.error(tCommon("action-error"));
                })
              )
            ),
        })
      )
    );
    startPostTransition(() => saved);
  };

  return (
    <form className="flex gap-3 border-b py-4" onSubmit={handleSubmit}>
      <PersonAvatar
        className="size-10 shrink-0"
        mascot={appUser.mascot}
        photo={photoOf(appUser)}
      />
      <div className="grid min-w-0 flex-1 gap-2">
        <Textarea
          aria-label={t("placeholder")}
          className="field-sizing-content min-h-10 resize-none border-none bg-transparent px-0 py-2 shadow-none focus-visible:ring-0 dark:bg-transparent"
          disabled={disabled}
          name="text"
          onBlur={() => setFocused(false)}
          onChange={(event) => setText(event.target.value)}
          onFocus={() => setFocused(true)}
          placeholder={t("placeholder")}
          readOnly={isPosting}
          value={text}
        />
        {(focused || text.length > 0) && (
          <div className="flex items-center justify-end gap-3">
            {remaining <= SHOW_REMAINING_FROM && (
              <span className="text-muted-foreground text-sm tabular-nums">
                {remaining}
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
        )}
      </div>
    </form>
  );
}
