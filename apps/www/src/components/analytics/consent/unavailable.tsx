"use client";

import { type ReactNode, useState } from "react";
import { AnalyticsConsentContext } from "@/lib/analytics/consent/context";
import { createAnalyticsConsentStore } from "@/lib/analytics/consent/store";

/**
 * Keeps optional analytics undecidable where its signed notice is not live:
 * readers see pending consent and every decision is ignored.
 */
export function AnalyticsUnavailableProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [store] = useState(() => createAnalyticsConsentStore("unavailable"));

  return (
    <AnalyticsConsentContext value={store}>{children}</AnalyticsConsentContext>
  );
}
