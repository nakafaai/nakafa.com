import { cn } from "@repo/design-system/lib/utils";
import Image from "next/image";
import { type ComponentProps, memo } from "react";

const DEFAULT_MARKDOWN_IMAGE_WIDTH = 720;
const DEFAULT_MARKDOWN_IMAGE_HEIGHT = 520;

function getImageDimension(value: ComponentProps<"img">["width" | "height"]) {
  const nextValue =
    typeof value === "number"
      ? value
      : Number.parseInt(String(value ?? ""), 10);

  return Number.isFinite(nextValue) && nextValue > 0 ? nextValue : null;
}

/** Renders one markdown image with a stable intrinsic size hint to reduce layout shift. */
export const MarkdownImage = memo(
  ({
    alt = "",
    className,
    height,
    src,
    title,
    width,
  }: ComponentProps<"img">) => {
    const resolvedWidth =
      getImageDimension(width) ?? DEFAULT_MARKDOWN_IMAGE_WIDTH;
    const resolvedHeight =
      getImageDimension(height) ?? DEFAULT_MARKDOWN_IMAGE_HEIGHT;

    if (typeof src !== "string" || src.length === 0) {
      return null;
    }

    return (
      <Image
        alt={alt}
        className={cn(
          "my-4 block h-auto max-w-full rounded-xl border bg-muted",
          className
        )}
        height={resolvedHeight}
        loading="lazy"
        src={src}
        title={title}
        unoptimized
        width={resolvedWidth}
      />
    );
  }
);
MarkdownImage.displayName = "MarkdownImage";
