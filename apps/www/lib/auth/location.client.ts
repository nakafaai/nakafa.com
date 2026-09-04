"use client";

import {
  getPathname,
  useRouter,
} from "@repo/internationalization/src/navigation";
import { usePathname, useSearchParams } from "next/navigation";
import { useLocale } from "next-intl";
import type { MouseEvent, SyntheticEvent } from "react";
import {
  getPostAuthIntentSource,
  getPostAuthSignInHrefForLocation,
} from "@/lib/auth/admission";

/** Returns whether a link click must retain native browser navigation. */
function isModifiedLinkClick(event: MouseEvent<HTMLAnchorElement>) {
  const target = event.currentTarget.getAttribute("target");
  return (
    event.altKey ||
    event.ctrlKey ||
    event.metaKey ||
    event.shiftKey ||
    event.currentTarget.hasAttribute("download") ||
    (target !== null && target !== "_self")
  );
}

/**
 * Builds deterministic auth-link fallback and exact browser-event navigation.
 *
 * The live reader intentionally touches `window` only after user interaction,
 * preserving hash fragments without making server and hydration renders differ.
 */
export function useCurrentAuthNavigation() {
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const search = useSearchParams().toString();
  const href = getPostAuthSignInHrefForLocation(
    { hash: "", pathname, search },
    locale
  );

  function readIntentSource() {
    return getPostAuthIntentSource(
      window.location.pathname,
      window.location.search,
      window.location.hash
    );
  }

  function readHref() {
    return getPostAuthSignInHrefForLocation(window.location, locale);
  }

  function prepareNativeLink(event: SyntheticEvent<HTMLAnchorElement>) {
    event.currentTarget.href = getPathname({ href: readHref(), locale });
  }

  function onLinkClick(event: MouseEvent<HTMLAnchorElement>) {
    if (event.defaultPrevented) {
      return;
    }

    const currentHref = readHref();
    if (isModifiedLinkClick(event)) {
      prepareNativeLink(event);
      return;
    }

    event.preventDefault();
    router.push(currentHref);
  }

  const linkProps = {
    href,
    onAuxClick: prepareNativeLink,
    onClick: onLinkClick,
    onContextMenu: prepareNativeLink,
    onPointerDown: prepareNativeLink,
  };

  return { linkProps, readHref, readIntentSource };
}
