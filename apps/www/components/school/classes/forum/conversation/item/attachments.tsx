import { FileIcon } from "@hugeicons/core-free-icons";
import type { PostAttachment } from "@repo/backend/convex/classes/forums/utils/posts";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { formatFileSize } from "@repo/design-system/lib/utils";
import Image from "next/image";
import { memo } from "react";

/**
 * Splits forum attachments into image previews and file links while tolerating
 * storage URLs that are temporarily unavailable.
 */
export const PostAttachments = memo(
  ({ attachments }: { attachments: PostAttachment[] }) => {
    if (attachments.length === 0) {
      return null;
    }

    const images = attachments.filter((item) =>
      item.mimeType.startsWith("image/")
    );
    const files = attachments.filter(
      (item) => !item.mimeType.startsWith("image/")
    );

    return (
      <div className="flex flex-col gap-1">
        {images.map((attachment) => {
          if (!attachment.url) {
            return null;
          }

          return (
            <a
              className="group/image relative block h-40 w-full max-w-xs overflow-hidden rounded-sm border bg-muted sm:h-48"
              href={attachment.url}
              key={attachment._id}
              rel="noopener noreferrer"
              target="_blank"
            >
              <Image
                alt={attachment.name}
                className="object-cover transition-transform ease-out group-hover/image:scale-105"
                fill
                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                src={attachment.url}
              />
            </a>
          );
        })}

        <div className="flex flex-wrap gap-1">
          {files.map((attachment) => (
            <a
              className="group/file flex items-center gap-2 rounded-sm border bg-background p-2 transition-colors ease-out hover:bg-accent hover:text-accent-foreground"
              href={attachment.url ?? "#"}
              key={attachment._id}
              rel="noopener noreferrer"
              target="_blank"
            >
              <div className="flex size-8 items-center justify-center rounded-sm bg-muted">
                <HugeIcons
                  className="size-4 text-muted-foreground"
                  icon={FileIcon}
                />
              </div>
              <div className="flex min-w-0 flex-col">
                <span className="max-w-30 truncate font-medium text-xs">
                  {attachment.name}
                </span>
                <span className="text-[10px] text-muted-foreground group-hover/file:text-accent-foreground">
                  {formatFileSize(attachment.size)}
                </span>
              </div>
            </a>
          ))}
        </div>
      </div>
    );
  }
);
PostAttachments.displayName = "PostAttachments";
