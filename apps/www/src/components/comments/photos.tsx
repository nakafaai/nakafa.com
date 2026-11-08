import { ResponsiveDialog } from "@repo/design-system/components/ui/responsive-dialog";
import { cva } from "class-variance-authority";
import { Array as Arr } from "effect";
import { useState } from "react";
import { useTranslations } from "use-intl";
import { useRowComment } from "@/components/comments/scope";
import type { RowComment } from "@/components/comments/state";

/** One photo of a comment, as a list shows it. */
type Photo = RowComment["photos"][number];

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
  if (Arr.isReadonlyArrayEmpty(comment.photos)) {
    return null;
  }
  const single = comment.photos.length === 1;
  return (
    <div className={photoGrid({ single })}>
      {Arr.map(comment.photos, (photo, index) => (
        <CommentPhoto
          index={index}
          // A photo has no id of its own, and its place in the comment never changes once posted.
          key={photo.address ?? photo.thumbnail ?? index}
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
  photo: Photo;
  single: boolean;
}) {
  const t = useTranslations("Comments");
  const [open, setOpen] = useState(false);
  const name = t("photo", { number: index + 1 });

  return (
    <>
      <button
        aria-label={t("photo-open", { name })}
        className="bg-muted focus-visible:ring-ring/50 block w-full cursor-pointer overflow-hidden rounded-xl outline-none focus-visible:ring-3"
        onClick={() => setOpen(true)}
        type="button"
      >
        <img
          alt={name}
          className="size-full object-cover"
          height={photo.height}
          loading="lazy"
          src={photo.thumbnail ?? photo.address ?? undefined}
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
          src={photo.address ?? undefined}
          width={photo.width}
        />
      </ResponsiveDialog>
    </>
  );
}
