import type { AnchorProps } from "@repo/design-system/types/markdown";
import { HrefLink } from "@repo/internationalization/src/link";
import { cn } from "cn";

export function Anchor({
  href,
  children,
  popover,
  className,
  ...props
}: AnchorProps) {
  if (!href) {
    return null;
  }

  const anchorClassName = cn(
    "h-auto p-0 font-normal text-primary underline underline-offset-4",
    className
  );

  if (href.startsWith("/")) {
    return (
      <HrefLink className={anchorClassName} href={href} title={href} {...props}>
        {children}
      </HrefLink>
    );
  }

  if (
    href.startsWith("#") ||
    href.startsWith("mailto:") ||
    href.startsWith("tel:")
  ) {
    return (
      <a
        className={anchorClassName}
        href={href}
        title={href}
        {...(popover !== undefined && { popover })}
        {...props}
      >
        {children}
      </a>
    );
  }

  return (
    <a
      className={anchorClassName}
      href={href}
      title={href}
      {...(popover !== undefined && { popover })}
      {...props}
      rel="noopener noreferrer"
      target="_blank"
    >
      {children}
    </a>
  );
}
