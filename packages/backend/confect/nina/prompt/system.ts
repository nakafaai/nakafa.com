import type { LearningCapabilityName } from "@repo/backend/confect/nina/capability/spec";
import type { NinaContextPack } from "@repo/backend/confect/nina/contract/pack";
import { createNinaPrompt } from "@repo/backend/confect/nina/prompt/prompt";
import type { PromptUserRole } from "@repo/backend/confect/users/role";
import dedent from "dedent";

/** Formats Nina's validated context pack for the runtime context of a turn. */
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

/**
 * Builds Nina's system prompt from the role, the signed current page, the
 * learner, the question focus, the summary, and the capabilities she is
 * offered. The runtime facts of a turn are not part of it: see
 * `formatTurnContext`.
 */
export function createNinaSystemPrompt({
  capabilities,
  focus,
  learner,
  pageContent,
  summary,
  userRole,
}: {
  readonly capabilities: readonly LearningCapabilityName[];
  readonly focus?: string;
  readonly learner?: string;
  readonly pageContent?: string;
  readonly summary?: string;
  readonly userRole?: PromptUserRole | undefined;
}) {
  return createNinaPrompt({
    capabilities,
    ...(focus === undefined ? {} : { focus }),
    ...(learner === undefined ? {} : { learner }),
    ...(pageContent === undefined ? {} : { pageContent }),
    ...(summary === undefined ? {} : { summary }),
    ...(userRole === undefined ? {} : { userRole }),
  });
}
