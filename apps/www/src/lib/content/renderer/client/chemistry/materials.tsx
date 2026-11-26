"use client";

import { lazy } from "@repo/design-system/lib/lazy";
import { withHydrationBoundary } from "@/lib/content/renderer/client/boundary";

export const AlloySlipPlaneLab = withHydrationBoundary(
  lazy(() =>
    import("@repo/design-system/components/contents/chemistry/alloy/lab").then(
      (module) => ({ default: module.AlloySlipPlaneLab })
    )
  )
);

export const ContactSulfuricTowerLab = withHydrationBoundary(
  lazy(() =>
    import(
      "@repo/design-system/components/contents/chemistry/contact/lab"
    ).then((module) => ({ default: module.ContactSulfuricTowerLab }))
  )
);

export const GlassCeramicLatticeLab = withHydrationBoundary(
  lazy(() =>
    import(
      "@repo/design-system/components/contents/chemistry/silicate/lab"
    ).then((module) => ({ default: module.GlassCeramicLatticeLab }))
  )
);
