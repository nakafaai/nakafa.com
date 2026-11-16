"use client";

import { Option } from "effect";
import { createContext, type ReactNode, use } from "react";
import { getTryoutPublicPathTarget } from "@/components/tryout/route/path";
import type { LinkTarget } from "@/lib/routing/link";
import { TRYOUT_TARGET } from "@/lib/routing/target";

/**
 * Where "Try out" opens in the locale on screen: its country page. Without a
 * layout that read it, the address of Try out itself, which the Worker and its
 * route answer with a redirect to that same page.
 */
const TryoutEntryContext = createContext<LinkTarget>(TRYOUT_TARGET);

/**
 * Provides the locale's try-out entry, the public path of the country that
 * "Try out" opens, which the site shell reads with its navigation. A link to
 * the address of Try out then opens that country itself, so a press never
 * passes through the address's redirect.
 */
export function TryoutEntryProvider({
  children,
  entryPath,
}: {
  readonly children: ReactNode;
  readonly entryPath: string | null;
}) {
  const target =
    entryPath === null
      ? TRYOUT_TARGET
      : Option.getOrElse(
          getTryoutPublicPathTarget(entryPath),
          () => TRYOUT_TARGET
        );
  return <TryoutEntryContext value={target}>{children}</TryoutEntryContext>;
}

/**
 * The destination a link opens: its own target, or for the address of Try out,
 * which is no page of its own, the locale's try-out entry.
 */
export function useLinkDestination(target: LinkTarget): LinkTarget {
  const entry = use(TryoutEntryContext);
  return target.to === TRYOUT_TARGET.to ? entry : target;
}
