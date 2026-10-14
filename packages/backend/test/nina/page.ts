import { LearningProgramKeySchema } from "@nakafa/aksara-contracts/program/spec";
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

/**
 * The page of a signed lesson as a turn stores it, with the asset id of the
 * lesson and the placement it was opened from.
 */
export const lessonPage = {
  locale: "en",
  needsFetch: true,
  nina: {
    learning: {
      assetId: "asset:id:material:mathematics:vector:addition",
      locale: "en",
      materialKey: "mathematics",
      section: "subject-lesson",
      slug: "subjects/mathematics/vector/addition",
      sourcePath: "material/lesson/mathematics/vector/addition",
      title: "Vector Addition",
      url: "https://nakafa.com/en/subjects/mathematics/vector/addition",
      verified: true,
    },
    placement: {
      mode: "placement",
      nodeKey: "curriculum:vector:addition",
      parentHref: "/en/curriculum/mathematics/vector",
      parentTitle: "Vector",
      programKey: LearningProgramKeySchema.make("cambridge-lower-secondary"),
    },
    tools: { allowPageFetch: true, evidenceScope: "verified-page" },
  },
  slug: "subjects/mathematics/vector/addition",
} satisfies NinaPage;
