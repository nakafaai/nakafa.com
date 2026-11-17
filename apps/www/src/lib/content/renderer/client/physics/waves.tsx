"use client";

import { lazy } from "@repo/design-system/lib/lazy";
import { withHydrationBoundary } from "@/lib/content/renderer/client/boundary";

export const DoubleSlitLab = withHydrationBoundary(
  lazy(() =>
    import(
      "@repo/design-system/components/contents/physics/waves/slit/lab"
    ).then((module) => ({ default: module.DoubleSlitLab }))
  )
);

export const EchoLab = withHydrationBoundary(
  lazy(() =>
    import(
      "@repo/design-system/components/contents/physics/waves/echo/lab"
    ).then((module) => ({ default: module.EchoLab }))
  )
);

export const RippleTankLab = withHydrationBoundary(
  lazy(() =>
    import(
      "@repo/design-system/components/contents/physics/waves/tank/lab"
    ).then((module) => ({ default: module.RippleTankLab }))
  )
);

export const SpeakerInterferenceLab = withHydrationBoundary(
  lazy(() =>
    import(
      "@repo/design-system/components/contents/physics/waves/sound/lab"
    ).then((module) => ({ default: module.SpeakerInterferenceLab }))
  )
);
