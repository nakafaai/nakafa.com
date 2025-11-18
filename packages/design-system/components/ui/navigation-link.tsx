"use client";

import { Link } from "@repo/internationalization/src/navigation";
import { routing } from "@repo/internationalization/src/routing";
import { useSelectedLayoutSegment } from "next/navigation";
import type { ComponentProps } from "react";
import { useMemo } from "react";

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
  const selectedLayoutSegment = useSelectedLayoutSegment();
  const pathname = selectedLayoutSegment ? `/${selectedLayoutSegment}` : "/";

  const cleanHref = useMemo(() => {
    let result = href;
    const hrefString = typeof href === "string" ? href : href.toString();

    const hrefSplit = hrefString.split("/");
    const firstSegment = hrefString.startsWith("/")
      ? hrefSplit[1]
      : hrefSplit[0];

    // if in href still containing locale, remove it, because <Link> supports built-in locale
    const locale = routing.locales.find((l) => l === firstSegment);
    if (locale) {
      result = hrefString.replace(`/${locale}`, ""); // remove locale from href
    }

    if (typeof result === "string") {
      const isExternal = EXTERNAL_URL_REGEX.test(result);
      const isProtocolRelative = PROTOCOL_RELATIVE_REGEX.test(result);
      const isHash = result.startsWith("#");
      const isMailOrTel = MAIL_OR_TEL_REGEX.test(result);

      const shouldNormalize =
        result.length > 0 &&
        !result.startsWith("/") &&
        !isExternal &&
        !isProtocolRelative &&
        !isHash &&
        !isMailOrTel;

      if (shouldNormalize) {
        result = `/${result}`;
      }
    }

    return result;
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

  return (
    <Link
      aria-current={isActive ? "page" : undefined}
      href={cleanHref}
      {...props}
      prefetch // always prefetch the link
    />
  );
}
