import { Login01Icon } from "@hugeicons/core-free-icons";
import { photoOf } from "@repo/backend/confect/users/picture";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { lazy, readChunk } from "@repo/design-system/lib/lazy";
import { ClientOnly } from "@tanstack/react-router";
import { cva } from "class-variance-authority";
import { Effect, String as Str } from "effect";
import { Suspense, use, useState } from "react";
import { useTranslations } from "use-intl";
import { photosOf, textOf } from "@/components/comments/draft";
import { usePostComment } from "@/components/comments/posting";
import { useCommentDraft } from "@/components/comments/provider";
import { ComposerAnswersContext } from "@/components/comments/scope";
import type { CommentRow } from "@/components/comments/state";
import { FeedAvatar } from "@/components/user/feed";
import { useCurrentAuthNavigation } from "@/lib/auth/location";
import { useViewer } from "@/lib/identity/client";
import { Link } from "@/lib/routing/link";

/** Loads the open composer, and the editing library with it. */
const loadWriter = () => import("@/components/comments/writer");

/** The open composer, which loads on the learner's first intent on the closed one. */
const CommentWriter = lazy(() =>
  loadWriter().then((module) => ({ default: module.CommentWriter }))
);

/** The closed composer: one line in the frame of a field, which opens the composer when pressed. */
const closedField = cva(
  "border-input text-muted-foreground hover:bg-accent/40 flex h-10 min-w-0 flex-1 items-center rounded-xl border px-3 text-start text-sm transition-colors ease-out"
);

/**
 * The composer of a comment, or of a reply when a thread names the comment it answers
 * (`ComposerAnswersContext`): the writer's picture beside a field. A
 * visitor's field asks them to sign in. A learner's list composer stays one closed line until it is pressed,
 * so the page loads no editor before then; a reply composer opens at once, with the focus in it.
 */
export function CommentComposer() {
  const account = useViewer((state) => state.account);
  return (
    <div className="flex items-start gap-3">
      <FeedAvatar
        mascot={account?.appUser.mascot}
        photo={account ? photoOf(account.appUser) : undefined}
      />
      {account ? <LearnerComposer /> : <VisitorComposer />}
    </div>
  );
}

/** A visitor's field: it reads as the composer, and leads to sign-in, which returns to the comments. */
function VisitorComposer() {
  const t = useTranslations("Comments");
  const authNavigation = useCurrentAuthNavigation();
  return (
    <Link className={closedField()} {...authNavigation.linkProps}>
      <HugeIcons className="me-2 shrink-0" icon={Login01Icon} />
      <span className="truncate">{t("sign-in-to-comment")}</span>
    </Link>
  );
}

/** The closed composer, whose first intent loads the open one before the press. */
function ClosedComposer({ onOpen }: { onOpen: () => void }) {
  const t = useTranslations("Comments");
  return (
    <button
      className={closedField()}
      onClick={onOpen}
      onFocus={() => Effect.runFork(readChunk(loadWriter))}
      onPointerEnter={() => Effect.runFork(readChunk(loadWriter))}
      type="button"
    >
      <span className="truncate">{t("add-comment-placeholder")}</span>
    </button>
  );
}

/** A learner's composer: closed until pressed for a new comment, open at once for a reply. */
function LearnerComposer() {
  const answers = use(ComposerAnswersContext);
  const composerKey = answers?._id ?? "";
  const drafted = useCommentDraft(
    (draft) =>
      !Str.isEmpty(textOf(draft, composerKey)) ||
      photosOf(draft, composerKey).length > 0
  );
  const [open, setOpen] = useState(answers !== null || drafted);
  const close = useCommentDraft((draft) => draft.close);
  const send = useSend(answers);

  if (!open) {
    return <ClosedComposer onOpen={() => setOpen(true)} />;
  }
  return (
    <Suspense fallback={<ClosedComposer onOpen={() => undefined} />}>
      <ClientOnly fallback={<ClosedComposer onOpen={() => undefined} />}>
        <CommentWriter
          autoFocus
          composerKey={composerKey}
          onClose={() => {
            if (answers !== null) {
              close();
              return;
            }
            if (!drafted) {
              setOpen(false);
            }
          }}
          onSend={send}
        />
      </ClientOnly>
    </Suspense>
  );
}

/**
 * Sends what one composer holds as a comment, or as a reply to `parent`. The composer empties at once and the
 * comment shows where it will sit; a refusal gives the words and the photos back to the composer, ahead of
 * anything written since, while the list says why.
 */
function useSend(parent: CommentRow | null) {
  const composerKey = parent?._id ?? "";
  const text = useCommentDraft((draft) => textOf(draft, composerKey));
  const photos = useCommentDraft((draft) => photosOf(draft, composerKey));
  const clear = useCommentDraft((draft) => draft.clear);
  const close = useCommentDraft((draft) => draft.close);
  const restore = useCommentDraft((draft) => draft.restore);
  const addPhotos = useCommentDraft((draft) => draft.addPhotos);
  const postComment = usePostComment();

  return () => {
    clear(composerKey);
    if (parent !== null) {
      close();
    }
    Effect.runPromise(
      Effect.promise(() => postComment({ parent, photos, text })).pipe(
        Effect.flatMap((saved) =>
          Effect.sync(() => {
            if (!saved) {
              restore(composerKey, text);
              addPhotos(composerKey, photos);
            }
          })
        )
      )
    );
  };
}
