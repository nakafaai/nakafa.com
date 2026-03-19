"use client";

import { useMediaQuery } from "@mantine/hooks";
import { useMotionValueEvent, useScroll } from "motion/react";
import { useRef, useState } from "react";

export function useStickyVisibility() {
  const { scrollY } = useScroll();
  const [hidden, setHidden] = useState(false);
  const anchorRef = useRef<HTMLDivElement>(null);
  const lastYRef = useRef(0);
  const isMobile = useMediaQuery("(max-width: 1024px)");

  useMotionValueEvent(scrollY, "change", (latest) => {
    const currentY = Math.max(0, latest);
    const previousY = Math.max(0, lastYRef.current);
    const diff = currentY - previousY;
    const stickyOffset = isMobile ? 72 : 8;
    const rect = anchorRef.current?.getBoundingClientRect();
    const currentTop = rect?.top ?? stickyOffset;
    const isNaturalPos = currentTop > stickyOffset + 10;

    if (isNaturalPos) {
      setHidden(false);
      lastYRef.current = currentY;
      return;
    }

    if (Math.abs(diff) < 5) {
      return;
    }

    if (diff > 0) {
      setHidden(true);
    } else {
      setHidden(false);
    }

    lastYRef.current = currentY;
  });

  return {
    anchorRef,
    hidden,
  };
}
