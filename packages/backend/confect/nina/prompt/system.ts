import type { NinaContextPack } from "@repo/backend/confect/nina/contract/pack";
import type {
  NinaPage,
  NinaRuntime,
  NinaUser,
} from "@repo/backend/confect/nina/contract/turn";
import { readNinaLearningPage } from "@repo/backend/confect/nina/contract/turn";
import { createNinaPrompt } from "@repo/backend/confect/nina/prompt/prompt";
import dedent from "dedent";

/** Formats Nina's validated context pack for the system prompt. */
export function formatNinaContextPackPrompt(context: NinaContextPack) {
  const placement = context.placement
    ? dedent`
        Placement:
        - mode: placement
        - programKey: ${context.placement.programKey}
        - nodeKey: ${context.placement.nodeKey}
        - parentHref: ${context.placement.parentHref}
        - parentTitle: ${context.placement.parentTitle}
      `
    : "Placement: canonical direct asset visit";

  return dedent`
    # Nina Context Pack

    Learning asset:
    - url: ${context.learning.url}
    - locale: ${context.learning.locale}
    - slug: ${context.learning.slug}
    - verified: ${context.learning.verified ? "yes" : "no"}
    - title: ${context.learning.title ?? "unknown"}
    - sourcePath: ${context.learning.sourcePath ?? "unknown"}
    - assetId: ${context.learning.assetId ?? "unknown"}
    - section: ${context.learning.section ?? "unknown"}
    - materialKey: ${context.learning.materialKey ?? "unknown"}

    ${placement}

    Tool policy:
    - Nakafa evidence allowed: ${context.tools.allowNakafa ? "yes" : "no"}
    - current page content provided: ${context.tools.allowPageFetch ? "yes" : "no"}
    - math evidence allowed: ${context.tools.allowMath ? "yes" : "no"}
    - deep research allowed: ${context.tools.allowDeepResearch ? "yes" : "no"}
    - evidence scope: ${context.tools.evidenceScope}
  `;
}

/** Builds Nina's system prompt from validated runtime, page, and user context. */
export function createNinaSystemPrompt({
  focus,
  learner,
  page,
  pageContent,
  runtime,
  summary,
  user,
}: {
  readonly focus?: string;
  readonly learner?: string;
  readonly page: NinaPage;
  readonly pageContent?: string;
  readonly runtime: NinaRuntime;
  readonly summary?: string;
  readonly user: NinaUser;
}) {
  const learningPage = readNinaLearningPage(page);

  return createNinaPrompt({
    ...(focus === undefined ? {} : { focus }),
    ...(learner === undefined ? {} : { learner }),
    ...(pageContent === undefined ? {} : { pageContent }),
    ...(summary === undefined ? {} : { summary }),
    currentDate: runtime.currentDate,
    currentPage: {
      locale: learningPage.locale,
      slug: learningPage.slug,
      verified: learningPage.verified,
    },
    curriculumPreference: user.curriculumPreference,
    nina: page.nina,
    url: learningPage.url,
    userRole: user.role,
  });
}
