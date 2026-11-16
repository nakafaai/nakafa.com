import { laterCode, openLaterCode } from "@/components/marketing/shared/code";

/**
 * The sections of the School pricing page under its plans, each one's code on its
 * own, so a phone loads only what the reader nears (ADR 0039). The plans hydrate
 * with the page; the comparison, calculator, add-ons, questions and closing wait
 * here. The landing keeps its own registry, so this page's code never reaches the
 * landing's sections or the messages they read.
 */
export const pricingSections = {
  addons: laterCode(() =>
    import("@/components/marketing/school/pricing/addons").then(
      (module) => module.SchoolAddOns
    )
  ),
  calculator: laterCode(() =>
    import("@/components/marketing/school/pricing/calculator").then(
      (module) => module.SchoolCalculator
    )
  ),
  closing: laterCode(() =>
    import("@/components/marketing/school/closing").then(
      (module) => module.SchoolClosing
    )
  ),
  compare: laterCode(() =>
    import("@/components/marketing/school/pricing/compare").then(
      (module) => module.SchoolCompare
    )
  ),
  faq: laterCode(() =>
    import("@/components/marketing/school/faq").then(
      (module) => module.SchoolFaq
    )
  ),
};

/**
 * Loads the code of the pricing page's later sections. The route opens them before
 * a load that renders the page whole, on the server and on a client navigation, so
 * the page commits with its sections; the first document never runs it, nor does a
 * warm of a link to the page.
 */
export function openSchoolPricing() {
  return Promise.all([
    openLaterCode(pricingSections.addons),
    openLaterCode(pricingSections.calculator),
    openLaterCode(pricingSections.closing),
    openLaterCode(pricingSections.compare),
    openLaterCode(pricingSections.faq),
  ]);
}
