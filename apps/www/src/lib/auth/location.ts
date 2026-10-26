import {
  useHydrated,
  useLocation,
  useNavigate,
  useRouter,
} from "@tanstack/react-router";
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

/** The browser URL without its query, which a prerendered page never sees. */
function withoutQuery(href: string) {
  const query = href.indexOf("?");
  return query === -1 ? href : href.slice(0, query);
}

/**
 * Builds deterministic auth-link fallback and exact browser-event navigation.
 *
 * Until React has hydrated the page, the rendered target names the path alone:
 * the build renders a prerendered page without the query of a visitor's address,
 * and React keeps a server attribute that its hydration render disagrees with.
 * Once hydrated, the target names the query too. A click reads the router's own
 * location, which keeps the fragment.
 */
export function useCurrentAuthNavigation() {
  const locale = useCurrentLocale();
  const navigate = useNavigate();
  const router = useRouter();
  const hydrated = useHydrated();
  const publicHref = useLocation({
    select: (location) => withoutFragment(location.publicHref),
  });
  const renderedTarget = getPostAuthSignInTarget(
    hydrated ? publicHref : withoutQuery(publicHref),
    locale
  );

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
