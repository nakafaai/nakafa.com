"use client";

import NavigationLink from "@repo/design-system/components/ui/navigation-link";
import { usePathname } from "@repo/internationalization/src/navigation";
import type { ComponentProps } from "react";
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
export function HeaderFeaturesLink(
  props: Omit<ComponentProps<typeof NavigationLink>, "href">
) {
  const pathname = usePathname();
  const onHome = pathname === "/";

  return (
    <NavigationLink
      {...props}
      href={`/#${LESSON_SECTION_ID}`}
      onClick={(event) => {
        props.onClick?.(event);
        if (onHome) {
          scrollToSection();
        }
      }}
      resetScroll={!onHome}
    />
  );
}
