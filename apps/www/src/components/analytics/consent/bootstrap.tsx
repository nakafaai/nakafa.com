import { ANALYTICS_CONSENT_BOOTSTRAP_SCRIPT } from "@/lib/analytics/consent/bootstrap";

/**
 * Renders the inline script that marks a decided visitor's document before the
 * usage-data prompt paints. The server sends it with the page, so it runs while
 * the document is still being parsed, and the prompt follows it in the markup.
 */
export function AnalyticsConsentBootstrap() {
  return (
    <script
      // biome-ignore lint/security/noDangerouslySetInnerHtml: the script text is built from constants only.
      dangerouslySetInnerHTML={{ __html: ANALYTICS_CONSENT_BOOTSTRAP_SCRIPT }}
    />
  );
}
