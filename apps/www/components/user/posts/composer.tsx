"use client";

import { useMutation } from "@confect/react";
import { Id } from "@repo/backend/confect/_generated/id";
import posts from "@repo/backend/confect/_generated/refs/posts";
import {
  countPostCharacters,
  POST_TEXT_MAX_LENGTH,
  readPostText,
} from "@repo/backend/confect/posts/schema";
import { photoOf } from "@repo/backend/confect/users/picture";
import { Button } from "@repo/design-system/components/ui/button";
import { PersonAvatar } from "@repo/design-system/components/ui/person";
import { Textarea } from "@repo/design-system/components/ui/textarea";
import { randomUuid } from "@repo/utilities/uuid";
import { DateTime, Effect, Result, Schema } from "effect";
import { useTranslations } from "next-intl";
import { type SubmitEventHandler, startTransition, useState } from "react";
import { toast } from "sonner";
import { insertDraftPost } from "@/components/user/posts/mutation.client";
import type { ListPost } from "@/components/user/posts/state";
import { reportClientException } from "@/lib/analytics/client";
import type { CurrentUser } from "@/lib/identity/client";

/** The characters left at which the composer starts to show how many remain. */
const SHOW_REMAINING_FROM = 50;

/**
 * Writes a new post at the top of the owner's posts. The post shows at once,
 * and a refused post gives its text back to the composer with a message.
 */
export function PostComposer({ appUser }: { appUser: CurrentUser["appUser"] }) {
  const t = useTranslations("Posts");
  const tCommon = useTranslations("Common");
  const [text, setText] = useState("");
  const [focused, setFocused] = useState(false);
  const startPost = useMutation(posts.mutations.create);
  const body = readPostText(text);
  const remaining = POST_TEXT_MAX_LENGTH - countPostCharacters(text);

  /** Sends the trimmed text, and shows the post in the list while the server saves it. */
  const handleSubmit: SubmitEventHandler<HTMLFormElement> = (event) => {
    event.preventDefault();
    if (Result.isFailure(body)) {
      return;
    }
    const posted = body.success;
    setText("");
    startTransition(() =>
      Effect.runPromise(
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
                    setText((previous) => previous || posted);
                    toast.error(tCommon("action-error"));
                  })
                )
              ),
          })
        )
      )
    );
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
          name="text"
          onBlur={() => setFocused(false)}
          onChange={(event) => setText(event.target.value)}
          onFocus={() => setFocused(true)}
          placeholder={t("placeholder")}
          value={text}
        />
        {(focused || text.length > 0) && (
          <div className="flex items-center justify-end gap-3">
            {remaining <= SHOW_REMAINING_FROM && (
              <span className="text-muted-foreground text-sm tabular-nums">
                {remaining}
              </span>
            )}
            <Button disabled={Result.isFailure(body)} size="sm" type="submit">
              {t("post")}
            </Button>
          </div>
        )}
      </div>
    </form>
  );
}
