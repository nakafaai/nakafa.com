import type { NinaPage } from "@repo/backend/confect/nina/contract/turn";

/** The page of the home route as a turn stores it: no signed content, no asset. */
export const homePage = {
  locale: "en",
  needsFetch: false,
  nina: {
    learning: {
      locale: "en",
      slug: "home",
      url: "https://nakafa.com/en/home",
      verified: false,
    },
    tools: { allowPageFetch: false, evidenceScope: "general-learning" },
  },
  slug: "home",
} satisfies NinaPage;
