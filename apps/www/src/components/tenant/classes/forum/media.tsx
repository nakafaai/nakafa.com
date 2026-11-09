import { Download04Icon, File02Icon } from "@hugeicons/core-free-icons";
import {
  Attachment,
  AttachmentContent,
  AttachmentDescription,
  AttachmentMedia,
  AttachmentTitle,
  AttachmentTrigger,
} from "@repo/design-system/components/ui/attachment";
import { Button } from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { ResponsiveDialog } from "@repo/design-system/components/ui/responsive-dialog";
import { formatBytes } from "@repo/internationalization/src/formats";
import { cva } from "class-variance-authority";
import { Array as Arr } from "effect";
import { useState } from "react";
import { useLocale, useTranslations } from "use-intl";
import { documentCard } from "@/components/tenant/classes/forum/chips";
import type { ForumMessage } from "@/components/tenant/classes/forum/optimistic";
import { photoRatio } from "@/components/tenant/classes/forum/photo";

/** One file of a message. */
type ForumFile = ForumMessage["attachments"][number];

/** The photos of a message: one at its own shape, and several in equal squares, as a chat's album. */
const photoGrid = cva("grid w-full max-w-sm gap-1", {
  variants: { single: { false: "grid-cols-2", true: "grid-cols-1" } },
});

/**
 * The files of a message, above its text: its photos as an album, each opening large, and its
 * documents as rows that open them. A message from another stands at the start and the viewer's own
 * at the end, as its bubble does.
 */
export function MessageMedia({ message }: { message: ForumMessage }) {
  const photos = Arr.filter(
    message.attachments,
    (file) => file.kind === "image"
  );
  const documents = Arr.filter(
    message.attachments,
    (file) => file.kind === "document"
  );

  if (Arr.isReadonlyArrayEmpty(message.attachments)) {
    return null;
  }
  return (
    <div
      className="flex w-full min-w-0 flex-col gap-1 data-[mine=true]:items-end"
      data-mine={message.mine}
    >
      {Arr.isReadonlyArrayEmpty(photos) ? null : (
        <div className={photoGrid({ single: photos.length === 1 })}>
          {Arr.map(photos, (photo) => (
            <MessagePhoto
              key={photo.address ?? photo.name}
              photo={photo}
              single={photos.length === 1}
            />
          ))}
        </div>
      )}
      {Arr.map(documents, (document) => (
        <MessageDocument
          document={document}
          key={document.address ?? document.name}
        />
      ))}
    </div>
  );
}

/**
 * One photo: its small copy, in the shape its size in pixels gives, so the stream never moves when
 * it loads. A press opens it large with Download, in a sheet on a phone.
 */
function MessagePhoto({
  photo,
  single,
}: {
  photo: ForumFile;
  single: boolean;
}) {
  const t = useTranslations("Classroom");
  const common = useTranslations("Common");
  const [open, setOpen] = useState(false);
  const height = photo.height ?? 1;
  const width = photo.width ?? 1;
  const ratio = photoRatio(photo.width, photo.height);

  return (
    <>
      <button
        aria-label={t("media-open", { name: photo.name })}
        className="bg-muted focus-visible:ring-ring/50 block w-full cursor-pointer overflow-hidden rounded-2xl outline-none focus-visible:ring-3"
        onClick={() => setOpen(true)}
        type="button"
      >
        <img
          alt={photo.name}
          className="size-full object-cover"
          height={height}
          loading="lazy"
          src={photo.thumbnail ?? photo.address ?? undefined}
          style={{ aspectRatio: single ? String(ratio) : "1" }}
          width={width}
        />
      </button>
      <ResponsiveDialog
        action={
          photo.address === null ? null : (
            <>
              <Button
                onClick={() => setOpen(false)}
                type="button"
                variant="outline"
              >
                {common("close")}
              </Button>
              <Button
                render={
                  <a
                    download={photo.name}
                    href={photo.address}
                    rel="noopener"
                    target="_blank"
                    title={t("media-download")}
                  />
                }
              >
                <HugeIcons icon={Download04Icon} />
                {t("media-download")}
              </Button>
            </>
          )
        }
        description={t("media-description")}
        open={open}
        setOpen={setOpen}
        title={photo.name}
      >
        <img
          alt={photo.name}
          className="max-h-[70dvh] w-full rounded-lg object-contain"
          height={height}
          src={photo.address ?? undefined}
          width={width}
        />
      </ResponsiveDialog>
    </>
  );
}

/** One document of a message: its name and size, which open it in a new tab. */
function MessageDocument({ document }: { document: ForumFile }) {
  const t = useTranslations("Classroom");
  const locale = useLocale();

  return (
    <Attachment className={documentCard()}>
      {document.address === null ? null : (
        <AttachmentTrigger
          aria-label={t("media-open", { name: document.name })}
          className="rounded-xl"
          render={
            <a
              href={document.address}
              rel="noopener"
              target="_blank"
              title={document.name}
            />
          }
        />
      )}
      <AttachmentMedia variant="icon">
        <HugeIcons icon={File02Icon} />
      </AttachmentMedia>
      <AttachmentContent>
        <AttachmentTitle dir="auto">{document.name}</AttachmentTitle>
        <AttachmentDescription>
          {formatBytes(document.byteSize, locale)}
        </AttachmentDescription>
      </AttachmentContent>
    </Attachment>
  );
}
