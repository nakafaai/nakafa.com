import "server-only";

import { api } from "@repo/backend/convex/_generated/api";
import { fetchQuery } from "convex/nextjs";
import type { Locale } from "next-intl";
import { applyContentRuntimeCache } from "@/lib/content/cache";

/** Reads the public country-first try-out catalog from the tagged content cache. */
export async function readTryoutHubPage(locale: Locale) {
  "use cache";
  applyContentRuntimeCache();

  return await fetchQuery(api.tryouts.queries.catalog.getHubPage, { locale });
}

/** Reads one public country page from the tagged content cache. */
export async function readTryoutCountryPage(
  locale: Locale,
  publicPath: string
) {
  "use cache";
  applyContentRuntimeCache();

  return await fetchQuery(api.tryouts.queries.catalog.getCountryPage, {
    locale,
    publicPath,
  });
}

/** Reads one public exam page from the tagged content cache. */
export async function readTryoutExamPage(locale: Locale, publicPath: string) {
  "use cache";
  applyContentRuntimeCache();

  return await fetchQuery(api.tryouts.queries.catalog.getExamPage, {
    locale,
    publicPath,
  });
}

/** Reads one public track shell from the tagged content cache. */
export async function readTryoutTrackPage(locale: Locale, publicPath: string) {
  "use cache";
  applyContentRuntimeCache();

  return await fetchQuery(api.tryouts.queries.catalog.getTrackPage, {
    locale,
    publicPath,
  });
}

/** Reads one public set page from the tagged content cache. */
export async function readTryoutSetPage(locale: Locale, publicPath: string) {
  "use cache";
  applyContentRuntimeCache();

  return await fetchQuery(api.tryouts.queries.catalog.getSetPage, {
    locale,
    publicPath,
  });
}

/** Reads one public section page from the tagged content cache. */
export async function readTryoutSectionPage(
  locale: Locale,
  publicPath: string
) {
  "use cache";
  applyContentRuntimeCache();

  return await fetchQuery(api.tryouts.queries.catalog.getSectionPage, {
    locale,
    publicPath,
  });
}
