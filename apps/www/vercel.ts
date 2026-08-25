import type { VercelConfig } from "@vercel/config/v1";

/**
 * Every Next static-param owner and each remote contract its generated routes
 * can read while metadata and page output are built.
 */
export const staticBuildRoutes = [
  {
    contracts: [],
    source: "app/[locale]/layout.tsx",
  },
  {
    contracts: ["contentRelease/page:catalog", "/internal/content/runtime/v2"],
    source: "app/[locale]/(app)/(shared)/(site)/(legal)/[...page]/page.tsx",
  },
  {
    contracts: ["contentRelease/program:page", "contentRelease/program:route"],
    source:
      "app/[locale]/(app)/(shared)/(main)/(learn)/curricula/[curriculum]/[[...path]]/page.tsx",
  },
  {
    contracts: ["contentRelease/quran:surahs", "contentRelease/quran:view"],
    source: "app/[locale]/(app)/(shared)/(main)/(learn)/quran/[surah]/page.tsx",
  },
  {
    contracts: [
      "contentRelease/article:categories",
      "contentRelease/article:publications",
    ],
    source:
      "app/[locale]/(app)/(shared)/(main)/(learn)/articles/[category]/page.tsx",
  },
  {
    contracts: [
      "contentRelease/article:categories",
      "contentRelease/article:publications",
      "contentRelease/article:route",
      "/internal/content/runtime/v2",
    ],
    source:
      "app/[locale]/(app)/(shared)/(main)/(learn)/articles/[category]/[slug]/page.tsx",
  },
  {
    contracts: [
      "contentRelease/material:publications",
      "contentRelease/material:publication",
      "/internal/content/runtime/v2",
    ],
    source:
      "app/[locale]/(app)/(shared)/(main)/(learn)/materials/[subject]/[topic]/[[...lesson]]/page.tsx",
  },
] as const;

/**
 * The production script temporarily pushes the additive content bridge before
 * Next builds these routes. The switch change removes that first push only
 * after its exact deploymentId and successor function spec are verified.
 */
export const config: VercelConfig = {
  buildCommand: "pnpm run build:vercel",
  ignoreCommand:
    'if [ "$VERCEL_ENV" != "production" ]; then exit 0; fi; turbo query affected --base="$VERCEL_GIT_PREVIOUS_SHA" --packages www --exit-code || exit 1',
  git: {
    deploymentEnabled: {
      "**": false,
      "changeset-release/main": false,
      main: true,
    },
  },
};
