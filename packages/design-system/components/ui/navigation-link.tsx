"use client";

import { Link } from "@repo/internationalization/src/navigation";
import { routing } from "@repo/internationalization/src/routing";
import { useSelectedLayoutSegment } from "next/navigation";
import type { ComponentProps } from "react";

const EXTERNAL_URL_REGEX = /^https?:\/\//;
const PROTOCOL_RELATIVE_REGEX = /^\/\//;
const MAIL_OR_TEL_REGEX = /^(mailto:|tel:)/;

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
  let cleanHref = href;

  const selectedLayoutSegment = useSelectedLayoutSegment();
  const pathname = selectedLayoutSegment ? `/${selectedLayoutSegment}` : "/";
  const isActive = typeof href === "string" && pathname.includes(href);

  const hrefSplit = href.toString().split("/");
  const firstSegment = href.toString().startsWith("/")
    ? hrefSplit[1]
    : hrefSplit[0];

  // if in href still containing locale, remove it, because <Link> supports built-in locale
  const locale = routing.locales.find((l) => l === firstSegment);
  if (locale) {
    cleanHref = href.toString().replace(`/${locale}`, ""); // remove locale from href
  }

  if (typeof cleanHref === "string") {
    const isExternal = EXTERNAL_URL_REGEX.test(cleanHref);
    const isProtocolRelative = PROTOCOL_RELATIVE_REGEX.test(cleanHref);
    const isHash = cleanHref.startsWith("#");
    const isMailOrTel = MAIL_OR_TEL_REGEX.test(cleanHref);

    const shouldNormalize =
      cleanHref.length > 0 &&
      !cleanHref.startsWith("/") &&
      !isExternal &&
      !isProtocolRelative &&
      !isHash &&
      !isMailOrTel;

    if (shouldNormalize) {
      cleanHref = `/${cleanHref}`;
    }
  }

  return (
    <Link
      aria-current={isActive ? "page" : undefined}
      href={cleanHref}
      {...props}
      prefetch // always prefetch the link
    />
  );
}
