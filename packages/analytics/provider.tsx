import { Analytics as VercelAnalytics } from "@vercel/analytics/react";
import type { ReactNode } from "react";

/** Provides Vercel Analytics with the correct runtime mode. */
export function AnalyticsProvider({ children }: { children: ReactNode }) {
  const mode =
    process.env.VERCEL_ENV === "production" ||
    process.env.VERCEL_ENV === "preview"
      ? "production"
      : "development";

  return (
    <>
      {children}
      <VercelAnalytics debug={false} mode={mode} />
    </>
  );
}
