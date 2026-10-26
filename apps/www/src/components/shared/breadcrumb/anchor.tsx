"use client";

import type { ReactNode } from "react";
import { type LinkTarget, TargetLink } from "@/lib/routing/link";

/**
 * One link of a breadcrumb. The breadcrumb link renders it and gives it only its
 * classes, so those are what it passes on.
 */
export function BreadcrumbAnchor({
  children,
  ...link
}: {
  children?: ReactNode;
  className?: string;
  target: LinkTarget;
}) {
  return <TargetLink {...link}>{children}</TargetLink>;
}
