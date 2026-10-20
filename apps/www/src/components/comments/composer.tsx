"use client";

import { Login01Icon } from "@hugeicons/core-free-icons";
import { photoOf } from "@repo/backend/confect/users/picture";
import { readLearnerText } from "@repo/backend/confect/writing/text";
import { Button } from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { InputGroupTextarea } from "@repo/design-system/components/ui/input-group";
import { buttonVariants } from "@repo/design-system/lib/button";
import { Link } from "@repo/internationalization/src/navigation";
import { cn } from "cn";
import { Effect, Option, Result } from "effect";
import type { FocusEvent, FormEvent, KeyboardEvent } from "react";
import { useTranslations } from "use-intl";
import { type ComposerKey, textOf } from "@/components/comments/draft";
import { useCommentDraft } from "@/components/comments/provider";
import { FeedAvatar, FeedForm } from "@/components/user/feed";
import { remainingToShow } from "@/components/user/posts/remaining";
import { useCurrentAuthNavigation } from "@/lib/auth/location.client";
import { useViewer } from "@/lib/identity/client";

/** Props of the composer: whose words it holds, how it posts, and how it closes when it is a reply. */
interface Props {
  /** The comment a reply composer answers; the list's own composer has none. */
  readonly answers?: ComposerKey;
  /** Whether the text field takes the focus when the composer appears. */
  readonly autoFocus?: boolean;
  /** Closes a reply composer on Escape, and when the learner leaves it empty. */
  readonly onClose?: () => void;
  /** Posts the text, and resolves to whether the server saved it. */
  readonly onPost: (text: string) => Promise<boolean>;
}

/** Takes the focus when the text field appears. */
function focusOnMount(node: HTMLTextAreaElement | null) {
  node?.focus();
}

/**
 * Writes a comment or a reply in the composer of the posts. The text clears on
 * Post and stays usable while the server saves, so nothing waits. The words live
 * in the list's draft, so a reply composer that closes keeps them for when it
 * opens again, and a refused post gives its text back there, ahead of any next
 * text written meanwhile, while the list says why.
 */
export function CommentComposer({
  answers = "",
  autoFocus = false,
  onClose,
  onPost,
}: Props) {
  const t = useTranslations("Comments");
  const tPosts = useTranslations("Posts");
  const user = useViewer((state) => state.account);
  const text = useCommentDraft((draft) => textOf(draft, answers));
  const write = useCommentDraft((draft) => draft.write);
  const restore = useCommentDraft((draft) => draft.restore);
  const body = readLearnerText(text);
  const remaining = remainingToShow(text);

  /** Posts the trimmed text, and gives it back to the field when the server refuses it. */
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user || Result.isFailure(body)) {
      return;
    }
    const posted = body.success;
    write(answers, "");
    Effect.runPromise(
      Effect.promise(() => onPost(posted)).pipe(
        Effect.flatMap((saved) =>
          Effect.sync(() => {
            if (!saved) {
              restore(answers, posted);
            }
          })
        )
      )
    );
  }

  /** Closes a reply composer that the learner leaves while it is empty. */
  function closeWhenEmpty(event: FocusEvent<HTMLFormElement>) {
    const next = event.relatedTarget;
    const staysInside =
      next instanceof Node && event.currentTarget.contains(next);
    if (text === "" && !staysInside) {
      onClose?.();
    }
  }

  /** Closes a reply composer on Escape; its words wait in the draft for when it opens again. */
  function closeOnEscape(event: KeyboardEvent<HTMLFormElement>) {
    if (event.key === "Escape") {
      onClose?.();
    }
  }

  return (
    <FeedForm
      onBlur={closeWhenEmpty}
      onKeyDown={closeOnEscape}
      onSubmit={submit}
    >
      {user ? (
        <FeedAvatar
          mascot={user.appUser.mascot}
          photo={photoOf(user.appUser)}
        />
      ) : null}
      <InputGroupTextarea
        aria-label={t("add-comment-placeholder")}
        className="min-h-10 min-w-0 flex-1 px-0 py-2"
        name="text"
        onChange={(event) => write(answers, event.target.value)}
        placeholder={t("add-comment-placeholder")}
        ref={autoFocus ? focusOnMount : undefined}
        value={text}
      />
      <div className="flex shrink-0 items-center gap-3 pt-1">
        {Option.isSome(remaining) && (
          <span className="text-muted-foreground text-sm tabular-nums">
            {remaining.value}
          </span>
        )}
        {user ? (
          <Button disabled={Result.isFailure(body)} size="sm" type="submit">
            {tPosts("post")}
          </Button>
        ) : (
          <SignInLink />
        )}
      </div>
    </FeedForm>
  );
}

/** The link to the sign-in page, which returns to the page of the comments. */
function SignInLink() {
  const t = useTranslations("Auth");
  const authNavigation = useCurrentAuthNavigation();

  return (
    <Link
      className={cn(buttonVariants({ size: "sm", variant: "ghost" }))}
      {...authNavigation.linkProps}
    >
      <HugeIcons icon={Login01Icon} />
      {t("login")}
    </Link>
  );
}
