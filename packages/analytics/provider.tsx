import { VercelAnalytics } from "@repo/analytics/vercel";
import type { ReactNode } from "react";

export function AnalyticsProvider({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <VercelAnalytics />
    </>
  );
}
