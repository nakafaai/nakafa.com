import { LLMS_CACHE_CONTROL } from "@/lib/llms/constants";
import { getNakafaAgentSkillIndex } from "@/lib/llms/skill";

/** Serves the agent-skills discovery manifest. */
export function GET() {
  return Response.json(getNakafaAgentSkillIndex(), {
    headers: {
      "Cache-Control": LLMS_CACHE_CONTROL,
    },
  });
}
