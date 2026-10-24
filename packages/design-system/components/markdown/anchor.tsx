"use client";

import type { AnchorProps } from "@repo/design-system/types/markdown";
import { cn } from "cn";
import { Data } from "effect";
import { type ComponentType, createContext, use } from "react";

/** The props of an authored path that names a page of the app, such as `/articles/x/y#z`. */
export type MarkdownPageLinkProps = AnchorProps & { readonly href: string };

/**
 * The app's link for the authored paths that name one of its pages. The design
 * system knows no route of its own, so the app provides this link once for every
 * document it renders.
 */
export const MarkdownPageLink = createContext<
  ComponentType<MarkdownPageLinkProps> | undefined
>(undefined);

/** Raised when an authored path renders without the app's page link. */
class MarkdownPageLinkMissingError extends Data.TaggedError(
  "MarkdownPageLinkMissingError"
)<{
  readonly href: string;
}> {}

/**
 * Whether an authored href names a path of this site. A protocol-relative
 * address such as `//example.com/x` names another host, so it is not one.
 */
function isPagePath(href: string) {
  return href.startsWith("/") && !href.startsWith("//");
}

export function Anchor({
  href,
  children,
  popover,
  className,
  ...props
}: AnchorProps) {
  const PageLink = use(MarkdownPageLink);
  if (!href) {
    return null;
  }

  const anchorClassName = cn(
    "h-auto p-0 font-normal text-primary underline underline-offset-4",
    className
  );

  if (isPagePath(href)) {
    if (PageLink === undefined) {
      throw new MarkdownPageLinkMissingError({ href });
    }
    return (
      <PageLink className={anchorClassName} href={href} title={href} {...props}>
        {children}
      </PageLink>
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
