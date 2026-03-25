"use client";

import { useHeadroom, useMediaQuery } from "@mantine/hooks";

export function useStickyVisibility() {
  const isMobile = useMediaQuery("(max-width: 1024px)");
  const pinned = useHeadroom({ fixedAt: isMobile ? 72 : 8 });

  return {
    hidden: !pinned,
  };
}
