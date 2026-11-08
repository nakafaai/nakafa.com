import { laterCode, openLaterCode } from "@/components/marketing/shared/code";

/**
 * The sections under the first screen of the School pages, each one's code on its
 * own, so a phone loads only what the reader nears (ADR 0039). The pricing page's
 * plans and calculator follow its period switch and hydrate with the page; only
 * its comparison and questions wait here.
 */
export const schoolSections = {
  closing: laterCode(() =>
    import("@/components/marketing/school/closing").then(
      (module) => module.SchoolClosing
    )
  ),
  compare: laterCode(() =>
    import("@/components/marketing/school/compare").then(
      (module) => module.SchoolCompare
    )
  ),
  faq: laterCode(() =>
    import("@/components/marketing/school/faq").then(
      (module) => module.SchoolFaq
    )
  ),
  features: laterCode(() =>
    import("@/components/marketing/school/features").then(
      (module) => module.SchoolFeatures
    )
  ),
  proof: laterCode(() =>
    import("@/components/marketing/school/proof").then(
      (module) => module.SchoolProof
    )
  ),
  steps: laterCode(() =>
    import("@/components/marketing/school/steps").then(
      (module) => module.SchoolSteps
    )
  ),
  teaser: laterCode(() =>
    import("@/components/marketing/school/teaser").then(
      (module) => module.SchoolTeaser
    )
  ),
};

/**
 * Loads the code of the School landing's sections. A route's loader runs only
 * where the page renders whole, on the server and on a client navigation, so the
 * page commits with its sections; the first document never runs it.
 */
export function openSchoolLanding() {
  return Promise.all([
    openLaterCode(schoolSections.closing),
    openLaterCode(schoolSections.faq),
    openLaterCode(schoolSections.features),
    openLaterCode(schoolSections.proof),
    openLaterCode(schoolSections.steps),
    openLaterCode(schoolSections.teaser),
  ]);
}

/** Loads the code of the School pricing page's later sections, as `openSchoolLanding` does for the landing. */
export function openSchoolPricing() {
  return Promise.all([
    openLaterCode(schoolSections.compare),
    openLaterCode(schoolSections.faq),
  ]);
}
