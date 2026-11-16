import type { ActiveAppLocaleCode } from "@nakafa/aksara-contracts/locale";

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
    ms: "/ms/articles/politik/kemelut-pilkada-2024",
  },
  cabinet: {
    de: "/de/articles/politik/kabinett-merah-putih-und-koalitionspolitik",
    en: "/en/articles/politics/merah-putih-cabinet-analysis",
    id: "/id/articles/politics/merah-putih-cabinet-analysis",
    ms: "/ms/articles/politik/kabinet-merah-putih-dan-politik-gabungan",
  },
  /**
   * A page of code blocks of several lengths, whose stand-in heights a check
   * measures. The acceptance release serves no AI and data science lesson, so
   * the developers page, which draws its code through the same renderer, stands in.
   */
  code: {
    de: "/de/developers",
    en: "/en/developers",
    id: "/id/developers",
    ms: "/ms/developers",
  },
  exponent: {
    de: "/de/faecher/mathematik/potenzen-und-logarithmen/grundlagen",
    en: "/en/subjects/mathematics/exponential-logarithm/basic-concept",
    id: "/id/materi/matematika/eksponen-dan-logaritma/konsep-eksponen",
    ms: "/ms/subjek/matematik/indeks-dan-logaritma/konsep-indeks",
  },
  growth: {
    de: "/de/faecher/mathematik/potenzen-und-logarithmen/exponentielles-wachstum",
    en: "/en/subjects/mathematics/exponential-logarithm/exponential-growth",
    id: "/id/materi/matematika/eksponen-dan-logaritma/pertumbuhan-eksponen",
    ms: "/ms/subjek/matematik/indeks-dan-logaritma/pertumbuhan-eksponen",
  },
  inverse: {
    de: "/de/faecher/mathematik/funktionskomposition-und-umkehrfunktion/eigenschaften-der-umkehrfunktion",
    en: "/en/subjects/mathematics/function-composition-inverse-function/properties-of-inverse-function",
    id: "/id/materi/matematika/fungsi-komposisi-dan-fungsi-invers/sifat-fungsi-invers",
    ms: "/ms/subjek/matematik/fungsi-gubahan-dan-fungsi-songsang/sifat-fungsi-songsang",
  },
  material: {
    de: "/de/faecher/mathematik/analytische-geometrie/hyperbel",
    en: "/en/subjects/mathematics/analytic-geometry/hyperbola",
    id: "/id/materi/matematika/geometri-analitik/hiperbola",
    ms: "/ms/subjek/matematik/geometri-analitik/hiperbola",
  },
  /** A lesson whose highlight holds a link, and which the acceptance runtime's content release serves. */
  relative: {
    de: "/de/faecher/physik/kinematik/relativbewegung",
    en: "/en/subjects/physics/kinematics/relative-movement",
    id: "/id/materi/fisika/kinematika/gerak-relatif",
    ms: "/ms/subjek/fizik/kinematik/gerakan-relatif",
  },
  /** A curriculum subject that has no lesson in the acceptance content yet. */
  upcoming: {
    de: "/de/lehrplaene/merdeka/klasse-10/physik",
    en: "/en/curriculum/merdeka/class-10/physics",
    id: "/id/kurikulum/merdeka/kelas-10/fisika",
    ms: "/ms/kurikulum/merdeka/kelas-10/fizik",
  },
  /**
   * The UTBK track of SNBT 2027, whose country the German catalog names in
   * German. No SNBT set is written in Malay, so Malay pins the TKA Matematik
   * Wajib track, whose sets are.
   */
  track: {
    de: "/de/try-out/indonesien/snbt/2027/utbk",
    en: "/en/try-out/indonesia/snbt/2027/utbk",
    id: "/id/try-out/indonesia/snbt/2027/utbk",
    ms: "/ms/try-out/indonesia/tka/sekolah-menengah-atas/matematik-wajib",
  },
} satisfies Record<string, Record<ActiveAppLocaleCode, string>>;
