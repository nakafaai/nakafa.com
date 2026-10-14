"use client";

import { useIntersection } from "@mantine/hooks";
import { DeferredParticles } from "@/components/shared/particles";

/**
 * The particle field behind the hero. It drifts while the hero is on screen,
 * and it holds still once the reader has scrolled past the hero.
 */
export function HeroField() {
  const { entry, ref } = useIntersection({ threshold: 0 });

  return (
    <div className="absolute inset-0 -z-10" ref={ref}>
      <DeferredParticles
        className="absolute inset-0"
        paused={!(entry?.isIntersecting ?? false)}
      />
    </div>
  );
}
