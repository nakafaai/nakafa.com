import { Analytics as AnalyticsVercel } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";
import Script from "next/script";

export function Analytics() {
  return (
    <>
      <Script
        defer
        src="https://cloud.umami.is/script.js" // Remove this if don't want to use umami
        data-website-id="03928cbb-62d4-4efe-8e21-aa1250082007"
      />
      <AnalyticsVercel />
      <SpeedInsights />
    </>
  );
}
