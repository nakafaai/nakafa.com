import type { AppLocaleCode } from "@nakafa/aksara-contracts/locale";

/**
 * Public content routes the acceptance suite pins, keyed by locale.
 *
 * Suites import these instead of copying paths so a published rename updates
 * every suite at once, and no suite can silently pin a path another suite
 * already dropped.
 */
export const pinnedRoutes = {
  article: {
    de: "/de/articles/politik/pilkada-2024-gerichtsurteile-und-kandidaturen",
    en: "/en/articles/politics/regional-elections-turmoil",
    id: "/id/articles/politics/regional-elections-turmoil",
  },
  cabinet: {
    de: "/de/articles/politik/kabinett-merah-putih-und-koalitionspolitik",
    en: "/en/articles/politics/merah-putih-cabinet-analysis",
    id: "/id/articles/politics/merah-putih-cabinet-analysis",
  },
  material: {
    de: "/de/faecher/mathematik/analytische-geometrie/hyperbel",
    en: "/en/subjects/mathematics/analytic-geometry/hyperbola",
    id: "/id/materi/matematika/geometri-analitik/hiperbola",
  },
} satisfies Record<string, Record<AppLocaleCode, string>>;
