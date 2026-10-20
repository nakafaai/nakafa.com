import {
  EXACT_ACTIVE_OPTIONS,
  Link,
  useCurrentLocale,
} from "@repo/internationalization/src/link";
import { useMatchRoute } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { LESSON_SECTION_ID } from "@/components/marketing/about/lesson/id";

/**
 * Scrolls the lesson section into view on its own, smoothly unless the reader
 * asked for less motion. The page no longer smooths every hash jump, so this
 * link brings its own smooth scroll.
 */
function scrollToSection() {
  const reduceMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)"
  ).matches;
  document.getElementById(LESSON_SECTION_ID)?.scrollIntoView({
    behavior: reduceMotion ? "auto" : "smooth",
  });
}

/**
 * Links to the lesson section of the home page, which the header names Features.
 * On the home page the section is already on screen, so the link scrolls to it
 * itself and the router only records the address. From another page the router
 * scrolls to the section, as it does for every other hash link.
 */
export function HeaderFeaturesLink({
  children,
}: {
  readonly children: ReactNode;
}) {
  const locale = useCurrentLocale();
  const matchRoute = useMatchRoute();
  const onHome = matchRoute({ params: { locale }, to: "/$locale" }) !== false;

  return (
    <Link
      activeOptions={EXACT_ACTIVE_OPTIONS}
      hash={LESSON_SECTION_ID}
      onClick={() => {
        if (onHome) {
          scrollToSection();
        }
      }}
      params={{ locale }}
      resetScroll={!onHome}
      to="/$locale"
    >
      {children}
    </Link>
  );
}
