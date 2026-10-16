"use client";

import { useMediaQuery } from "@mantine/hooks";
import { Intersection } from "@repo/design-system/components/ui/intersection";
import { TAILWIND_MEDIA_QUERIES } from "@repo/design-system/lib/breakpoints";
import dynamic from "next/dynamic";
import { useState } from "react";

/** The toys of the pricing page. Their code loads only when the page reaches them. */
const PricingToys = dynamic(() =>
  import("@/components/marketing/about/pricing/toys.client").then(
    (module) => module.PricingToys
  )
);

/**
 * The toys of the pricing page, loaded when the sentinel between the plans and
 * the comparison comes on screen, and only on a page wide enough to place them.
 * The sentinel stays in the page, so the page does not move when the toys load,
 * and a reader who does not scroll never downloads them.
 */
export function DeferredPricingToys() {
  const [reached, setReached] = useState(false);
  const wide = useMediaQuery(TAILWIND_MEDIA_QUERIES.lgAndUp);

  return (
    <>
      <Intersection
        aria-hidden="true"
        className="h-px"
        once
        onIntersect={() => setReached(true)}
        rootMargin="0px"
      />
      {reached && wide ? <PricingToys /> : null}
    </>
  );
}
