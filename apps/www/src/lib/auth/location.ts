import { useLocation, useNavigate, useRouter } from "@tanstack/react-router";
import type { MouseEvent, SyntheticEvent } from "react";
import { getPostAuthSignInTarget } from "@/lib/auth/admission";
import type { LinkTarget } from "@/lib/routing/link";
import { useCurrentLocale } from "@/lib/routing/link";

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

/** The browser URL without its fragment, which the server never sees. */
function withoutFragment(href: string) {
  const fragment = href.indexOf("#");
  return fragment === -1 ? href : href.slice(0, fragment);
}

/**
 * Builds deterministic auth-link fallback and exact browser-event navigation.
 *
 * The rendered target leaves the fragment out, so the server and the hydration
 * render agree. A click reads the router's own location, which keeps the fragment.
 */
export function useCurrentAuthNavigation() {
  const locale = useCurrentLocale();
  const navigate = useNavigate();
  const router = useRouter();
  const renderedSource = useLocation({
    select: (location) => withoutFragment(location.publicHref),
  });
  const renderedTarget = getPostAuthSignInTarget(renderedSource, locale);

  /** The sign-in target that resumes the browser location as it is now. */
  function readTarget(): LinkTarget {
    return getPostAuthSignInTarget(router.state.location.publicHref, locale);
  }

  /** The browser location as it is now, for an intent that a sign-in resumes. */
  function readIntentSource() {
    return router.state.location.publicHref;
  }

  function prepareNativeLink(event: SyntheticEvent<HTMLAnchorElement>) {
    event.currentTarget.href = router.buildLocation(readTarget()).publicHref;
  }

  function onLinkClick(event: MouseEvent<HTMLAnchorElement>) {
    if (event.defaultPrevented) {
      return;
    }

    if (isModifiedLinkClick(event)) {
      prepareNativeLink(event);
      return;
    }

    event.preventDefault();
    navigate(readTarget());
  }

  const linkProps = {
    ...renderedTarget,
    onAuxClick: prepareNativeLink,
    onClick: onLinkClick,
    onContextMenu: prepareNativeLink,
    onPointerDown: prepareNativeLink,
  };

  return { linkProps, readIntentSource, readTarget };
}
