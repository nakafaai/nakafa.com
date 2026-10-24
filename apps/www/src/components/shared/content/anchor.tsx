"use client";

import {
  MarkdownPageLink,
  type MarkdownPageLinkProps,
} from "@repo/design-system/components/markdown/anchor";
import { SITE_ORIGIN } from "@repo/seo/origin";
import type { ReactNode } from "react";
import { TargetLink } from "@/lib/routing/link";
import { PublicPathLink } from "@/lib/routing/public/link";
import { LANDING_TARGET } from "@/lib/routing/target";

/**
 * The link of an authored path that names a page of the app, such as
 * `/articles/x/y#z`. The page on screen supplies the locale, and the fragment
 * stays with the link, including on the landing page.
 */
function ContentPageAnchor({ href, ...anchor }: MarkdownPageLinkProps) {
  const url = new URL(href, SITE_ORIGIN);
  const hash = url.hash === "" ? undefined : url.hash.slice(1);
  if (url.pathname === "/") {
    return <TargetLink {...anchor} hash={hash} target={LANDING_TARGET} />;
  }
  return (
    <PublicPathLink
      {...anchor}
      hash={hash}
      publicPath={url.pathname.slice(1)}
    />
  );
}

/** Gives every Markdown document below it the app's page link. */
export function ContentPageAnchorProvider({
  children,
}: {
  readonly children: ReactNode;
}) {
  return (
    <MarkdownPageLink value={ContentPageAnchor}>{children}</MarkdownPageLink>
  );
}
