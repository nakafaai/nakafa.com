import { useAction, useMutation } from "@confect/react";
import { ArrowUp02Icon, Image01Icon } from "@hugeicons/core-free-icons";
import comments from "@repo/backend/confect/_generated/refs/comments";
import { COMMENT_PHOTO_LIMIT } from "@repo/backend/confect/comments/photo";
import { readCommentText } from "@repo/backend/confect/comments/text";
import { LEARNER_TEXT_MAX_LENGTH } from "@repo/backend/confect/writing/text";
import {
  LearnerEditor,
  useInsertText,
} from "@repo/design-system/components/editor/learner";
import { RichEditorControl } from "@repo/design-system/components/editor/tools";
import { Button } from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { toast } from "@repo/design-system/lib/toast/notify";
import { ImageType } from "@repo/editor/upload";
import { randomUuid } from "@repo/utilities/uuid";
import { Array as Arr, Effect, Number as Num, Option, Result } from "effect";
import { useRef } from "react";
import { useTranslations } from "use-intl";
import {
  type ComposerKey,
  generationOf,
  photosOf,
  textOf,
} from "@/components/comments/draft";
import { useCommentDraft } from "@/components/comments/provider";
import { PhotoTray } from "@/components/comments/tray";
import { uploadPhoto } from "@/components/comments/upload";
import {
  EmojiPopover,
  EmojiTrigger,
} from "@/components/tenant/classes/forum/chooser";
import { useDocumentLabels } from "@/lib/editor/labels";

/**
 * The open composer of a comment or a reply, as a chat's: its photos over the text, the formats of learner
 * text in the bar under it, then an emoji, a photo and Send at the bar's end. Mod-Enter sends. A photo
 * chosen, pasted or dropped goes into the tray and uploads at once, at most four, and Send waits for every
 * upload. The words and the photos live in the list's draft, so a reply composer that closes keeps them.
 */
export function CommentWriter({
  autoFocus,
  composerKey,
  onClose,
  onSend,
}: {
  autoFocus: boolean;
  composerKey: ComposerKey;
  onClose: () => void;
  onSend: () => void;
}) {
  const t = useTranslations("Comments");
  const labels = useDocumentLabels();
  const text = useCommentDraft((draft) => textOf(draft, composerKey));
  const generation = useCommentDraft((draft) =>
    generationOf(draft, composerKey)
  );
  const photos = useCommentDraft((draft) => photosOf(draft, composerKey));
  const write = useCommentDraft((draft) => draft.write);
  const addFiles = useAddPhotos(composerKey);
  const sendable =
    Result.isSuccess(readCommentText(text, photos.length)) &&
    Arr.every(photos, (photo) => Option.isSome(photo.upload));

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <PhotoTray composerKey={composerKey} />
      <LearnerEditor
        autoFocus={autoFocus}
        defaultValue={text}
        key={generation}
        label={t("add-comment-placeholder")}
        labels={{ ...labels.toolbar, formulaEdit: labels.formulaEdit }}
        limit={LEARNER_TEXT_MAX_LENGTH}
        onChange={(markdown) => write(composerKey, markdown)}
        onClose={onClose}
        onFiles={addFiles}
        onRefuse={() => toast.error({ title: "comment-paste-refused.title" })}
        onSubmit={() => {
          if (sendable) {
            onSend();
          }
        }}
        placeholder={t("add-comment-placeholder")}
      >
        <EmojiButton />
        <PhotoButton onFiles={addFiles} />
        <Button
          aria-label={t("send")}
          disabled={!sendable}
          onClick={onSend}
          size="icon-sm"
          type="button"
        >
          <HugeIcons icon={ArrowUp02Icon} />
        </Button>
      </LearnerEditor>
    </div>
  );
}

/** The emoji of a comment: the forum's searchable chooser, whose pick goes in at the caret. */
function EmojiButton() {
  const t = useTranslations("Comments");
  const insert = useInsertText();

  return (
    <EmojiPopover onPick={insert} side="top">
      <EmojiTrigger
        render={
          <Button
            aria-label={t("emoji")}
            size="icon-sm"
            type="button"
            variant="ghost"
          />
        }
      />
    </EmojiPopover>
  );
}

/** The photo control: it opens the file picker, and the chosen photos go into the tray. */
function PhotoButton({
  onFiles,
}: {
  onFiles: (files: readonly File[]) => void;
}) {
  const t = useTranslations("Comments");
  const picker = useRef<HTMLInputElement>(null);

  return (
    <>
      <RichEditorControl
        icon={Image01Icon}
        label={t("photo-add")}
        onClick={() => picker.current?.click()}
      />
      <input
        accept={Arr.join(ImageType.literals, ",")}
        aria-hidden
        className="hidden"
        multiple
        onChange={(event) => {
          onFiles(Arr.fromIterable(event.target.files ?? []));
          event.target.value = "";
        }}
        ref={picker}
        tabIndex={-1}
        type="file"
      />
    </>
  );
}

/**
 * Adds files to one composer's tray, the first four photos at most, each shown at once from this device and
 * uploaded on its own fiber. A photo the server refuses stays in the tray marked, and the learner hears why.
 */
function useAddPhotos(composerKey: ComposerKey) {
  const room = useCommentDraft(
    (draft) => COMMENT_PHOTO_LIMIT - photosOf(draft, composerKey).length
  );
  const addPhotos = useCommentDraft((draft) => draft.addPhotos);
  const placePhoto = useCommentDraft((draft) => draft.placePhoto);
  const reserve = useMutation(comments.files.reserve);
  const register = useAction(comments.files.register);

  return (files: readonly File[]) => {
    const taken = Arr.take(files, Num.max(room, 0));
    if (taken.length < files.length) {
      toast.error({ title: "comment-photo-limit.title" });
    }
    Arr.forEach(taken, (file) => {
      Effect.runFork(
        Effect.gen(function* () {
          const key = yield* randomUuid;
          addPhotos(composerKey, [
            {
              failed: false,
              height: 0,
              key,
              preview: URL.createObjectURL(file),
              upload: Option.none(),
              width: 0,
            },
          ]);
          yield* uploadPhoto(
            file,
            (bytes, contentType) =>
              reserve({ byteSize: bytes.size, contentType }),
            register
          ).pipe(
            Effect.matchEffect({
              onFailure: () =>
                Effect.sync(() => {
                  placePhoto(composerKey, key, { failed: true });
                  toast.error({ title: "comment-photo-refused.title" });
                }),
              onSuccess: ({ height, upload, width }) =>
                Effect.sync(() =>
                  placePhoto(composerKey, key, {
                    height,
                    upload: Option.some(upload),
                    width,
                  })
                ),
            })
          );
        })
      );
    });
  };
}
