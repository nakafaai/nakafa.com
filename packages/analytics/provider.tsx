import { VercelAnalytics } from "@repo/analytics/vercel";
import type { ReactNode } from "react";

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
