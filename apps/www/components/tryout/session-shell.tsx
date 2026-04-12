"use client";

import type { TryoutProduct } from "@repo/backend/convex/tryouts/products";
import type { Locale } from "next-intl";
import { AppShell } from "@/components/sidebar/app-shell";
import {
  TryoutSessionProvider,
  useTryoutSession,
} from "@/components/tryout/providers/session";

function TryoutSessionFrame({ children }: { children: React.ReactNode }) {
  const isTryoutActive = useTryoutSession(
    (state) => state.state.isTryoutActive
  );

  return <AppShell locked={isTryoutActive}>{children}</AppShell>;
}

/** Renders the shared locked shell for tryout set and part routes. */
export function TryoutSessionShell({
  children,
  locale,
  product,
  slug,
}: {
  children: React.ReactNode;
  locale: Locale;
  product: TryoutProduct;
  slug: string;
}) {
  return (
    <TryoutSessionProvider locale={locale} product={product} slug={slug}>
      <TryoutSessionFrame>{children}</TryoutSessionFrame>
    </TryoutSessionProvider>
  );
}
