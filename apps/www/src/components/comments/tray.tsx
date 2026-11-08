import { useMutation } from "@confect/react";
import { Alert02Icon, Cancel01Icon } from "@hugeicons/core-free-icons";
import comments from "@repo/backend/confect/_generated/refs/comments";
import { Button } from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { Spinner } from "@repo/design-system/components/ui/spinner";
import { Array as Arr, Effect, Option } from "effect";
import { useTranslations } from "use-intl";
import {
  type ComposerKey,
  photosOf,
  type TrayPhoto,
} from "@/components/comments/draft";
import { useCommentDraft } from "@/components/comments/provider";

/**
 * The photos on their way into one composer's comment, as small squares over its text: each from this device
 * at once, with a spinner while it uploads, a mark when the server refused it, and a press that takes it out
 * and deletes its upload. A composer without photos shows nothing.
 */
export function PhotoTray({ composerKey }: { composerKey: ComposerKey }) {
  const photos = useCommentDraft((draft) => photosOf(draft, composerKey));
  if (Arr.isReadonlyArrayEmpty(photos)) {
    return null;
  }
  return (
    <ul className="flex flex-wrap gap-2 pb-2">
      {Arr.map(photos, (photo, index) => (
        <TrayItem
          composerKey={composerKey}
          index={index}
          key={photo.key}
          photo={photo}
        />
      ))}
    </ul>
  );
}

/** One photo of the tray, with its state and its remove button. */
function TrayItem({
  composerKey,
  index,
  photo,
}: {
  composerKey: ComposerKey;
  index: number;
  photo: typeof TrayPhoto.Type;
}) {
  const t = useTranslations("Comments");
  const removePhotos = useCommentDraft((draft) => draft.removePhotos);
  const withdraw = useMutation(comments.files.withdraw);
  const name = t("photo", { number: index + 1 });
  const uploading = Option.isNone(photo.upload) && !photo.failed;

  /** Takes the photo out of the tray, and deletes its upload once the server holds one. */
  function remove() {
    removePhotos(composerKey, [photo.key]);
    URL.revokeObjectURL(photo.preview);
    if (Option.isSome(photo.upload)) {
      const uploadId = photo.upload.value;
      Effect.runFork(Effect.tryPromise(() => withdraw({ uploadId })));
    }
  }

  return (
    <li className="bg-muted relative size-16 overflow-hidden rounded-lg">
      <img
        alt={name}
        className="size-full object-cover"
        height={64}
        src={photo.preview}
        width={64}
      />
      {uploading ? (
        <span className="bg-background/60 absolute inset-0 grid place-items-center">
          <Spinner />
        </span>
      ) : null}
      {photo.failed ? (
        <span className="bg-destructive/70 text-destructive-foreground absolute inset-0 grid place-items-center">
          <HugeIcons icon={Alert02Icon} />
        </span>
      ) : null}
      <Button
        aria-label={t("photo-remove", { name })}
        className="absolute end-0.5 top-0.5 size-6 rounded-full"
        onClick={remove}
        size="icon-sm"
        type="button"
        variant="secondary"
      >
        <HugeIcons icon={Cancel01Icon} />
      </Button>
    </li>
  );
}
