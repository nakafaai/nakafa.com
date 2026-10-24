"use client";

import { DestinationLink } from "@repo/internationalization/src/link";
import type { ReactNode } from "react";
import {
  type HostTarget,
  SchoolDestinationLink,
} from "@/lib/routing/school/link";

/**
 * One link of a breadcrumb, drawn the way its host's routes need. The breadcrumb
 * link renders it and gives it only its classes, so those are what it passes on.
 */
export function BreadcrumbAnchor({
  children,
  className,
  target,
}: {
  children?: ReactNode;
  className?: string;
  target: HostTarget;
}) {
  if (target.host === "school") {
    return (
      <SchoolDestinationLink className={className} destination={target.target}>
        {children}
      </SchoolDestinationLink>
    );
  }
  return (
    <DestinationLink className={className} destination={target.target}>
      {children}
    </DestinationLink>
  );
}
