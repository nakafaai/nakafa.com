import { laterCode, openLaterCode } from "@/components/marketing/shared/code";

/** The sections under the first screen of the home page, each one's code on its own. */
export const homeSections = {
  closing: laterCode(() =>
    import("@/components/marketing/about/closing").then(
      (module) => module.Closing
    )
  ),
  community: laterCode(() =>
    import("@/components/marketing/about/community").then(
      (module) => module.Community
    )
  ),
  curricula: laterCode(() =>
    import("@/components/marketing/about/curricula/home").then(
      (module) => module.HomeCurricula
    )
  ),
  faq: laterCode(() =>
    import("@/components/marketing/about/faq/home").then(
      (module) => module.HomeFaq
    )
  ),
  lesson: laterCode(() =>
    import("@/components/marketing/about/lesson").then(
      (module) => module.Lesson
    )
  ),
  letter: laterCode(() =>
    import("@/components/marketing/about/letter").then(
      (module) => module.Letter
    )
  ),
  medals: laterCode(() =>
    import("@/components/marketing/about/medals").then(
      (module) => module.Medals
    )
  ),
  memory: laterCode(() =>
    import("@/components/marketing/about/memory").then(
      (module) => module.Memory
    )
  ),
  nina: laterCode(() =>
    import("@/components/marketing/about/nina/section").then(
      (module) => module.NinaSection
    )
  ),
  pricing: laterCode(() =>
    import("@/components/marketing/about/pricing/landing").then(
      (module) => module.Pricing
    )
  ),
  privacy: laterCode(() =>
    import("@/components/marketing/about/privacy").then(
      (module) => module.Privacy
    )
  ),
  schools: laterCode(() =>
    import("@/components/marketing/about/schools").then(
      (module) => module.Schools
    )
  ),
  tryout: laterCode(() =>
    import("@/components/marketing/about/tryout").then(
      (module) => module.Tryout
    )
  ),
};

/**
 * The sections under the first screen of the pricing page, each one's code on its
 * own, as on the home page (ADR 0039). The plans and their comparison hydrate with
 * the page; the schools and the questions wait here.
 */
export const pricingSections = {
  faq: laterCode(() =>
    import("@/components/marketing/about/faq/landing").then(
      (module) => module.Faq
    )
  ),
  schools: laterCode(() =>
    import("@/components/marketing/about/schools").then(
      (module) => module.Schools
    )
  ),
};

/** Loads the code of the pricing page's later sections, as `openHomeSections` does for the home page. */
export function openPricingSections() {
  return Promise.all([
    openLaterCode(pricingSections.faq),
    openLaterCode(pricingSections.schools),
  ]);
}

/**
 * Loads every section's code. The home route opens them before a load that renders
 * the page whole, on the server and on a client navigation, so the page commits
 * with its sections and no boundary waits on screen. The first document never runs
 * it, nor does a warm of a link to the home, and each section loads as it nears the
 * screen.
 */
export function openHomeSections() {
  return Promise.all([
    openLaterCode(homeSections.closing),
    openLaterCode(homeSections.community),
    openLaterCode(homeSections.curricula),
    openLaterCode(homeSections.faq),
    openLaterCode(homeSections.lesson),
    openLaterCode(homeSections.letter),
    openLaterCode(homeSections.medals),
    openLaterCode(homeSections.memory),
    openLaterCode(homeSections.nina),
    openLaterCode(homeSections.pricing),
    openLaterCode(homeSections.privacy),
    openLaterCode(homeSections.schools),
    openLaterCode(homeSections.tryout),
  ]);
}
