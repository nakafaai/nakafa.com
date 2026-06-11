"use client";

import { normalizeLocalizedInternalHref } from "@repo/internationalization/src/href";
import { Link } from "@repo/internationalization/src/navigation";
import { useSelectedLayoutSegment } from "next/navigation";
import type { ComponentProps } from "react";
import { useMemo } from "react";

/**
 * A navigation link component that is styled to look like a button.
 *
 * @param href - The href of the link
 * @param props - The props of the link
 * @returns A navigation link component
 * https://next-intl.dev/docs/routing/navigation#link-active
 */
export default function NavigationLink({
  href,
  ...props
}: ComponentProps<typeof Link>) {
  const selectedLayoutSegment = useSelectedLayoutSegment();
  const pathname = selectedLayoutSegment ? `/${selectedLayoutSegment}` : "/";

  const cleanHref = useMemo(() => {
    if (typeof href !== "string") {
      return href;
    }

    return normalizeLocalizedInternalHref(href);
  }, [href]);

  // More accurate active state check - exact match or starts with the href followed by /
  const isActive = useMemo(() => {
    if (typeof href !== "string") {
      return false;
    }
    const normalizedHref = href.endsWith("/") ? href.slice(0, -1) : href;
    const normalizedPathname = pathname.endsWith("/")
      ? pathname.slice(0, -1)
      : pathname;
    return (
      normalizedPathname === normalizedHref ||
      normalizedPathname.startsWith(`${normalizedHref}/`)
    );
  }, [href, pathname]);

  const ariaCurrent = useMemo(() => {
    if (isActive) {
      return "page";
    }
    return;
  }, [isActive]);

  return (
    <Link
      aria-current={ariaCurrent}
      href={cleanHref}
      {...props}
      prefetch // always prefetch the link
    />
  );
}
