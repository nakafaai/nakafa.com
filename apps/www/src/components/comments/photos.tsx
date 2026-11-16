import { CommentPhotoView } from "@repo/backend/confect/comments/photo";
import { ResponsiveDialog } from "@repo/design-system/components/ui/responsive-dialog";
import { cva } from "class-variance-authority";
import { Array as Arr, Schema } from "effect";
import { useState } from "react";
import { useTranslations } from "use-intl";
import { useRowComment } from "@/components/comments/scope";

/** One photo of a comment that the list shows: its file is stored, so it has an address to open. */
const ShownPhoto = Schema.Struct({
  ...CommentPhotoView.fields,
  address: Schema.String,
});

/** The photos of a comment: one at its own shape, and several in equal squares, as a chat's album. */
const photoGrid = cva("grid w-full max-w-sm gap-1 py-1", {
  variants: { single: { false: "grid-cols-2", true: "grid-cols-1" } },
});

/**
 * The photos of the row's comment under its text, each opening large, and nothing for a comment without
 * photos. Each takes the shape its size in pixels gives, so the list never moves when a photo loads.
 */
export function CommentPhotos() {
  const comment = useRowComment();
  // A photo whose file is gone has no address, so it has nothing to show or to open.
  const shown = Arr.filter(comment.photos, Schema.is(ShownPhoto));
  if (Arr.isReadonlyArrayEmpty(shown)) {
    return null;
  }
  const single = shown.length === 1;
  return (
    <div className={photoGrid({ single })}>
      {Arr.map(shown, (photo, index) => (
        <CommentPhoto
          index={index}
          // The address is signed from the start of the hour, so it stays the same between reads.
          key={photo.address}
          photo={photo}
          single={single}
        />
      ))}
    </div>
  );
}

/** One photo: its small copy in the list, and a press that opens it large, in a sheet on a phone. */
function CommentPhoto({
  index,
  photo,
  single,
}: {
  index: number;
  photo: typeof ShownPhoto.Type;
  single: boolean;
}) {
  const t = useTranslations("Comments");
  const tCommon = useTranslations("Common");
  const [open, setOpen] = useState(false);
  const name = t("photo", { number: index + 1 });

  return (
    <>
      <button
        aria-label={tCommon("media-open", { name })}
        className="bg-muted focus-visible:ring-ring/50 block w-full cursor-pointer overflow-hidden rounded-xl outline-none focus-visible:ring-3"
        onClick={() => setOpen(true)}
        type="button"
      >
        <img
          alt={name}
          className="size-full object-cover"
          height={photo.height}
          loading="lazy"
          src={photo.thumbnail ?? photo.address}
          style={{
            aspectRatio: single ? `${photo.width} / ${photo.height}` : "1",
          }}
          width={photo.width}
        />
      </button>
      <ResponsiveDialog
        description={t("photo-description")}
        open={open}
        setOpen={setOpen}
        title={name}
      >
        <img
          alt={name}
          className="max-h-[70dvh] w-full rounded-lg object-contain"
          height={photo.height}
          src={photo.address}
          width={photo.width}
        />
      </ResponsiveDialog>
    </>
  );
}
