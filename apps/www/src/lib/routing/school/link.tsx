"use client";

import { isInternalHref } from "@repo/internationalization/src/href";
import { EXACT_ACTIVE_OPTIONS } from "@repo/internationalization/src/link";
import { SITE_ORIGIN } from "@repo/seo/origin";
import {
  type ActiveOptions,
  Link,
  type RegisteredRouter,
  useLocation,
  useMatch,
} from "@tanstack/react-router";
import type { ComponentPropsWithoutRef } from "react";

/**
 * The school of the page on screen, which its school route matches. A page
 * outside the school tree reads none.
 */
function useSchoolSlug() {
  return useMatch({
    from: "/school/$slug",
    select: (match) => match.params.slug,
    shouldThrow: false,
  });
}

/**
 * A link to a path inside the school of the page on screen. The school host's
 * paths carry no locale, so the link writes the school's own route and no
 * locale. A page outside the school tree keeps the path as it is.
 */
export function SchoolHrefLink({
  activeOptions = EXACT_ACTIVE_OPTIONS,
  href,
  target,
  ...anchor
}: Omit<ComponentPropsWithoutRef<"a">, "href" | "target"> & {
  readonly activeOptions?: ActiveOptions | undefined;
  readonly href: string;
  readonly target?: string | undefined;
}) {
  const slug = useSchoolSlug();
  if (!isInternalHref(href) || target !== undefined) {
    return <a {...anchor} href={href} target={target} />;
  }
  if (slug === undefined) {
    return (
      <Link<RegisteredRouter, string, string>
        {...anchor}
        activeOptions={activeOptions}
        href={href}
      />
    );
  }
  const url = new URL(href, SITE_ORIGIN);
  const path = url.pathname === "/" ? "" : url.pathname;
  return (
    <Link<RegisteredRouter, string, string>
      {...anchor}
      activeOptions={activeOptions}
      href={`/school/${slug}${path}${url.search}${url.hash}`}
    />
  );
}

/**
 * The pathname of the school page on screen without its school, as the school
 * host shows it, such as `/settings/profile` for `/school/harapan/settings/profile`.
 */
export function useSchoolPath() {
  const slug = useSchoolSlug();
  return useLocation({
    select: (location) => {
      if (slug === undefined) {
        return "/";
      }
      const path = location.pathname.slice(`/school/${slug}`.length);
      return path === "" ? "/" : path;
    },
  });
}
