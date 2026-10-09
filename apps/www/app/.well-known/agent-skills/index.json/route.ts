import { Effect } from "effect";
import { LLMS_CACHE_CONTROL } from "@/lib/llms/constants";
import { getNakafaAgentSkillIndex } from "@/lib/llms/skill";

/** Serves the agent-skills discovery manifest. A failed digest is a defect. */
export function GET() {
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
