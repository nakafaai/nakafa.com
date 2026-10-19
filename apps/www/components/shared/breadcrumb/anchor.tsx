"use client";

import { IntentLink } from "@repo/design-system/components/ui/intent-link";
import { Link } from "@repo/internationalization/src/navigation";
import { createContext, type ReactNode, use } from "react";

/**
 * The host a breadcrumb sits on. The app's paths start with a locale, which its
 * links add; a school host's paths have none, so its breadcrumb draws plain links,
 * as the school's sidebar does.
 */
const BreadcrumbHostContext = createContext<"app" | "school">("app");

/** Sets the host of the breadcrumbs inside it. Without it a breadcrumb is the app's. */
export function BreadcrumbHost({
  children,
  host,
}: {
  children: ReactNode;
  host: "app" | "school";
}) {
  return <BreadcrumbHostContext value={host}>{children}</BreadcrumbHostContext>;
}

/**
 * One link of a breadcrumb, drawn the way its host's paths need. The breadcrumb
 * link renders it and gives it only its classes, so those are what it passes on.
 */
export function BreadcrumbAnchor({
  children,
  className,
  href,
}: {
  children?: ReactNode;
  className?: string;
  href: string;
}) {
  const host = use(BreadcrumbHostContext);
  const classes = className === undefined ? {} : { className };
  return host === "school" ? (
    <Link href={href} {...classes}>
      {children}
    </Link>
  ) : (
    <IntentLink href={href} {...classes}>
      {children}
    </IntentLink>
  );
}
