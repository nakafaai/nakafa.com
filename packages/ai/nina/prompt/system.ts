import type {
  NinaPage,
  NinaRuntime,
  NinaUser,
} from "@repo/ai/nina/contract/turn";
import { readNinaLearningPage } from "@repo/ai/nina/contract/turn";
import type { NinaContextPack } from "@repo/ai/nina/memory/pack";
import { createNinaPrompt } from "@repo/ai/nina/prompt/prompt";
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
    - current page fetch allowed: ${context.tools.allowPageFetch ? "yes" : "no"}
    - math evidence allowed: ${context.tools.allowMath ? "yes" : "no"}
    - deep research allowed: ${context.tools.allowDeepResearch ? "yes" : "no"}
    - evidence scope: ${context.tools.evidenceScope}
  `;
}

/** Builds Nina's system prompt from validated runtime, page, and user context. */
export function createNinaSystemPrompt({
  page,
  runtime,
  user,
}: {
  readonly page: NinaPage;
  readonly runtime: NinaRuntime;
  readonly user: NinaUser;
}) {
  const learningPage = readNinaLearningPage(page);

  return createNinaPrompt({
    currentDate: runtime.currentDate,
    currentPage: {
      locale: learningPage.locale,
      slug: learningPage.slug,
      verified: learningPage.verified,
    },
    learningProfile: user.learningProfile,
    nina: page.nina,
    url: learningPage.url,
    userLocation: user.location,
    userRole: user.role,
  });
}
