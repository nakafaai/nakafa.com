"use client";

import { Link } from "@/i18n/navigation";
import { useSelectedLayoutSegment } from "next/navigation";
import type { ComponentProps } from "react";

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
  const isActive = typeof href === "string" && pathname.includes(href);

  return (
    <Link
      aria-current={isActive ? "page" : undefined}
      href={href}
      {...props}
      prefetch // always prefetch the link
    />
  );
}
