import { Array as Arr, Effect, Schema } from "effect";
import { LLMS_CACHE_CONTROL } from "@/lib/llms/constants";
import { buildRootLlmsIndexText } from "@/lib/llms/index/public";
import {
  answerLlmsMarkdown,
  readLlmsMarkdownTarget,
} from "@/lib/llms/markdown.server";
import { getNakafaAgentSkillIndex, getNakafaSkillText } from "@/lib/llms/skill";

/** Serves the small root llms index. */
export function serveLlmsIndex() {
  return new Response(buildRootLlmsIndexText(), {
    headers: {
      "Cache-Control": LLMS_CACHE_CONTROL,
      "Content-Type": "text/markdown; charset=utf-8",
      Vary: "Accept",
    },
  });
}

/** Serves Nakafa's public skill.md guide for agents. */
export function serveSkill() {
  return new Response(getNakafaSkillText(), {
    headers: {
      "Cache-Control": LLMS_CACHE_CONTROL,
      "Content-Type": "text/markdown; charset=utf-8",
    },
  });
}

/** Serves the agent-skills discovery manifest. A failed digest is a defect. */
export function serveAgentSkills() {
  return Effect.runPromise(
    Effect.map(getNakafaAgentSkillIndex(), (index) =>
      Response.json(index, {
        headers: {
          "Cache-Control": LLMS_CACHE_CONTROL,
        },
      })
    ).pipe(Effect.orDie)
  );
}

/** The splat of a `/llms.mdx/...` path. */
const LlmsMarkdownParamsSchema = Schema.Struct({
  _splat: Schema.optionalKey(Schema.String),
});

/** Serves the Markdown of one `/llms.mdx/...` path, with the splat as its segments. */
export function serveLlmsMarkdown({
  params,
}: {
  readonly params: typeof LlmsMarkdownParamsSchema.Type;
}) {
  const segments = Arr.filter(
    (params._splat ?? "").split("/"),
    (segment) => segment !== ""
  );
  return Effect.runPromise(
    answerLlmsMarkdown(readLlmsMarkdownTarget(segments))
  );
}
