import type { AnchorProps } from "@repo/design-system/types/markdown";
import { DestinationLink } from "@repo/internationalization/src/link";
import { PublicPathLink } from "@repo/internationalization/src/public";
import { LANDING_TARGET } from "@repo/internationalization/src/target";
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
    // An authored path names a signed page without its locale; the page on
    // screen supplies the locale, and the fragment stays with the link.
    const url = new URL(href, "https://nakafa.invalid");
    const hash = url.hash === "" ? undefined : url.hash.slice(1);
    if (url.pathname === "/") {
      return (
        <DestinationLink
          className={anchorClassName}
          destination={LANDING_TARGET}
          title={href}
          {...props}
        >
          {children}
        </DestinationLink>
      );
    }
    return (
      <PublicPathLink
        className={anchorClassName}
        hash={hash}
        publicPath={url.pathname.slice(1)}
        title={href}
        {...props}
      >
        {children}
      </PublicPathLink>
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
