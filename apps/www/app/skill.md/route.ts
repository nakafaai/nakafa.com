import { LLMS_CACHE_CONTROL } from "@/lib/llms/constants";
import { getNakafaSkillText } from "@/lib/llms/skill";

/** Serves Nakafa's public skill.md guide for agents. */
export function GET() {
  return new Response(getNakafaSkillText(), {
    headers: {
      "Cache-Control": LLMS_CACHE_CONTROL,
      "Content-Type": "text/markdown; charset=utf-8",
    },
  });
}
