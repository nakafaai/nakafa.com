"use client";

import {
  type AppRoutePath,
  EXACT_ACTIVE_OPTIONS,
  LinkAnchor,
  type LinkTarget,
} from "@repo/internationalization/src/link";
import {
  type ActiveOptions,
  createLink,
  type LinkOptions,
  linkOptions,
  type RegisteredRouter,
} from "@tanstack/react-router";
import type { ComponentProps } from "react";

/**
 * The route that holds the school of every page on a school host. It is the
 * `from` of every school link, so a school target leaves its `slug` out and the
 * link fills it from the school page on screen.
 */
export const SCHOOL_ROUTE = "/school/$slug";

/**
 * Every named route of the school tree, as the router spells its full path. The
 * school's catch-all route names no page, so it is left out.
 */
type SchoolRoutePath = Exclude<
  Extract<AppRoutePath, `${typeof SCHOOL_ROUTE}${string}`>,
  `${typeof SCHOOL_ROUTE}/$`
>;

/** A typed link target of the school tree: its `slug` is inherited from the school page on screen. */
export type SchoolLinkTarget = {
  [To in SchoolRoutePath]: LinkOptions<
    RegisteredRouter,
    typeof SCHOOL_ROUTE,
    To
  >;
}[SchoolRoutePath];

/** The home of the school, which every page of its tree reaches from the school's own path. */
export const SCHOOL_HOME_TARGET = linkOptions({
  from: SCHOOL_ROUTE,
  to: "/school/$slug",
});

/**
 * Where a link leads: a route of the app, or a route of the school tree. A host
 * decides which link renders it, so a target names its host.
 */
export type HostTarget =
  | { readonly host: "app"; readonly target: LinkTarget }
  | { readonly host: "school"; readonly target: SchoolLinkTarget };

const SchoolRouterLink = createLink(LinkAnchor);

/** A link to a school target that the app chose at runtime, such as a breadcrumb or a card row. */
export function SchoolDestinationLink({
  activeOptions = EXACT_ACTIVE_OPTIONS,
  destination,
  ...anchor
}: Omit<ComponentProps<"a">, "href" | "target"> & {
  readonly activeOptions?: ActiveOptions | undefined;
  readonly destination: SchoolLinkTarget;
}) {
  return (
    <SchoolRouterLink
      {...anchor}
      activeOptions={activeOptions}
      {...destination}
    />
  );
}
