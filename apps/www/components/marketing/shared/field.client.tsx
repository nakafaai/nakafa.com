"use client";

import { useIntersection } from "@mantine/hooks";
import { ErrorBoundary } from "@repo/design-system/components/ui/error-boundary";
import { DeferredParticles } from "@/components/shared/particles";

/**
 * The particle field behind a part of a marketing page. It drifts while the part
 * is on screen, and it holds still once the reader has scrolled past it. The
 * field is decoration: when its code fails to load, the part stays without it,
 * and the failure never reaches the page's error page. The part is the field's
 * positioned, isolated parent.
 */
export function ParticleField() {
  const { entry, ref } = useIntersection({ threshold: 0 });

  return (
    <div className="absolute inset-0 -z-10" ref={ref}>
      <ErrorBoundary fallback={null}>
        <DeferredParticles
          className="absolute inset-0"
          paused={!(entry?.isIntersecting ?? false)}
        />
      </ErrorBoundary>
    </div>
  );
}
