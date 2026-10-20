"use client";

import { isInternalHref } from "@repo/internationalization/src/href";
import { SITE_ORIGIN } from "@repo/seo/origin";
import {
  Link,
  type RegisteredRouter,
  useLocation,
  useParams,
} from "@tanstack/react-router";
import type { ComponentPropsWithoutRef } from "react";

/** The school tree of the router: `/school/{slug}` and the path below it. */
const SCHOOL_TREE_PATTERN = /^\/school\/[^/]+(\/.*)?$/;

/**
 * The school of the page on screen, which its path names. A page outside the
 * school tree reads none.
 */
export function useSchoolSlug() {
  return useParams({ select: (params) => params.slug, strict: false });
}

/**
 * A link to a path inside the school of the page on screen. The school host's
 * paths carry no locale, so the link writes the school's own route and no
 * locale. A page outside the school tree keeps the path as it is.
 */
export function SchoolHrefLink({
  href,
  target,
  ...anchor
}: Omit<ComponentPropsWithoutRef<"a">, "href" | "target"> & {
  readonly href: string;
  readonly target?: string | undefined;
}) {
  const slug = useSchoolSlug();
  if (!isInternalHref(href) || target !== undefined) {
    return <a {...anchor} href={href} target={target} />;
  }
  if (slug === undefined) {
    return <Link<RegisteredRouter, string, string> {...anchor} href={href} />;
  }
  const url = new URL(href, SITE_ORIGIN);
  const path = url.pathname === "/" ? "" : url.pathname;
  return (
    <Link<RegisteredRouter, string, string>
      {...anchor}
      href={`/school/${slug}${path}${url.search}${url.hash}`}
    />
  );
}

/**
 * The pathname of the school page on screen without its school, as the school
 * host shows it, such as `/settings/profile` for `/school/harapan/settings/profile`.
 */
export function useSchoolPath() {
  return useLocation({
    select: (location) => {
      const match = SCHOOL_TREE_PATTERN.exec(location.pathname);
      return match?.[1] ?? "/";
    },
  });
}
