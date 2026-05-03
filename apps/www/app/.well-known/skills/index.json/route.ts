import { LLMS_CACHE_CONTROL } from "@/lib/llms/constants";
import { getNakafaLegacySkillIndex } from "@/lib/llms/skill";

/** Serves the legacy skills discovery manifest. */
export function GET() {
  return Response.json(getNakafaLegacySkillIndex(), {
    headers: {
      "Cache-Control": LLMS_CACHE_CONTROL,
    },
  });
}
