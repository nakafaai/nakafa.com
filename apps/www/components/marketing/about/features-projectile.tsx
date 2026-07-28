"use client";

import { useIntersection } from "@mantine/hooks";
import dynamic from "next/dynamic";

const FeaturesProjectileScene = dynamic(
  () =>
    import("@/components/marketing/about/features-projectile-scene").then(
      (module) => module.FeaturesProjectileScene
    ),
  {
    loading: () => null,
    ssr: false,
  }
);

/** Defers the complete interactive projectile surface until it nears view. */
export function FeaturesProjectile() {
  const { ref, entry } = useIntersection({
    root: null,
    rootMargin: "400px 0px",
    threshold: 0.01,
  });

  return (
    <div
      className="relative min-h-[42rem] bg-background lg:col-span-7 lg:min-h-[44rem]"
      ref={ref}
    >
      {entry?.isIntersecting ? <FeaturesProjectileScene /> : null}
    </div>
  );
}
