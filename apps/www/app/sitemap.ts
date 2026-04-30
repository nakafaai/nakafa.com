import { captureServerException } from "@repo/analytics/posthog/server";
import type { MetadataRoute } from "next";
import { getSitemapEntries } from "@/lib/sitemap";

export {
  baseRoutes,
  getContentRoutes,
  getEntries,
  getQuranRoutes,
  getSitemapRoutes,
  getUrl,
} from "@/lib/sitemap";

export default function sitemap(): Promise<MetadataRoute.Sitemap> {
  return getSitemapEntries({
    reportError: (error, context) =>
      captureServerException(error, undefined, context),
  });
}
