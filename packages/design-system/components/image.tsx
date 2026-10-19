import { cn } from "cn";
import type { ComponentProps } from "react";

interface ImageProps
  extends Omit<ComponentProps<"img">, "alt" | "height" | "width"> {
  readonly alt: string;
  /** Fills the nearest positioned ancestor instead of using the intrinsic size. */
  readonly fill?: boolean;
  readonly height?: number;
  /** Loads with the first paint instead of when the image nears the viewport. */
  readonly preload?: boolean;
  readonly width?: number;
}

/**
 * A plain `<img>` whose intrinsic size is written into the markup, so the layout
 * reserves the space before the file arrives. Images below the first paint load
 * lazily and decode asynchronously. No optimizer rewrites the file.
 */
export function Image({
  alt,
  className,
  fill = false,
  height,
  preload = false,
  width,
  ...props
}: ImageProps) {
  return (
    <img
      alt={alt}
      className={cn(fill && "absolute inset-0 size-full", className)}
      decoding={preload ? "auto" : "async"}
      fetchPriority={preload ? "high" : undefined}
      height={fill ? undefined : height}
      loading={preload ? "eager" : "lazy"}
      width={fill ? undefined : width}
      {...props}
    />
  );
}
