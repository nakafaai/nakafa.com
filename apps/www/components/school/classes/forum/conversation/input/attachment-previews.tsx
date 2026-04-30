import { Cancel01Icon, FileIcon } from "@hugeicons/core-free-icons";
import { Button } from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import type { FileWithPreview } from "@repo/design-system/hooks/use-file-upload";
import { cn, formatFileSize } from "@repo/design-system/lib/utils";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { Activity, memo } from "react";

/** Renders the local attachment preview strip above the forum input. */
export const AttachmentPreviews = memo(
  ({
    files,
    hasReplyTo,
    onRemove,
  }: {
    files: FileWithPreview[];
    hasReplyTo: boolean;
    onRemove: (id: string) => void;
  }) => {
    const t = useTranslations("File");

    if (files.length === 0) {
      return null;
    }

    return (
      <div
        aria-live="polite"
        className={cn(
          "scrollbar-hide flex items-center gap-2 overflow-x-auto border-x border-t p-3",
          !hasReplyTo && "rounded-t-md"
        )}
      >
        {files.map(({ id, file, preview }) => {
          const isImage = file.type.startsWith("image/");

          return (
            <div
              className="group relative flex shrink-0 items-center gap-2 rounded-md border bg-background p-2"
              key={id}
            >
              <Activity mode={isImage ? "hidden" : "visible"}>
                <div className="flex size-8 shrink-0 items-center justify-center rounded-sm bg-muted">
                  <HugeIcons
                    className="size-4 text-muted-foreground"
                    icon={FileIcon}
                  />
                </div>
              </Activity>
              <Activity mode={isImage ? "visible" : "hidden"}>
                <div className="relative size-8 shrink-0 overflow-hidden rounded-sm border bg-muted">
                  <Image
                    alt={file.name || t("unknown-file")}
                    className="object-cover"
                    fill
                    src={preview || ""}
                  />
                </div>
              </Activity>
              <div className="flex min-w-0 max-w-32 flex-col">
                <span className="truncate font-medium text-xs">
                  {file.name || t("unknown-file")}
                </span>
                <span className="text-muted-foreground text-xs">
                  {formatFileSize(file.size)}
                </span>
              </div>

              <Button
                aria-label="Remove attachment"
                className="absolute -top-2 -right-2 z-1 opacity-0 transition-opacity ease-out group-hover:opacity-100"
                onClick={() => onRemove(id)}
                size="icon-xs"
                type="button"
                variant="outline"
              >
                <HugeIcons icon={Cancel01Icon} />
                <span className="sr-only">Remove attachment</span>
              </Button>
            </div>
          );
        })}
      </div>
    );
  }
);
AttachmentPreviews.displayName = "AttachmentPreviews";
