"use client";

import NavigationLink from "@repo/design-system/components/ui/navigation-link";
import { usePathname } from "@repo/internationalization/src/navigation";
import type { ComponentProps } from "react";

/**
 * Scrolls the features section into view on its own, smoothly unless the
 * reader asked for less motion. The page no longer smooths every hash jump, so
 * this link brings its own smooth scroll.
 */
function scrollToFeatures() {
  const reduceMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)"
  ).matches;
  document.getElementById("features")?.scrollIntoView({
    behavior: reduceMotion ? "auto" : "smooth",
  });
}

/**
 * Links to the features section of the home page. On the home page the section
 * is already on screen, so the link scrolls to it itself and the router only
 * records the address. From another page the router scrolls to the section, as
 * it does for every other hash link.
 */
export function HeaderFeaturesLink(
  props: Omit<ComponentProps<typeof NavigationLink>, "href">
) {
  const pathname = usePathname();
  const onHome = pathname === "/";

  return (
    <NavigationLink
      {...props}
      href={{ pathname: "/", hash: "features" }}
      onClick={(event) => {
        props.onClick?.(event);
        if (onHome) {
          scrollToFeatures();
        }
      }}
      scroll={onHome ? false : props.scroll}
    />
  );
}
