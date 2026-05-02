import { LLMS_CACHE_CONTROL } from "@/lib/llms/constants";
import { buildRootLlmsIndexText } from "@/lib/llms/indexes";

/** Serves the small root llms index. */
export function GET() {
  return new Response(buildRootLlmsIndexText(), {
    headers: {
      "Cache-Control": LLMS_CACHE_CONTROL,
      "Content-Type": "text/plain; charset=utf-8",
    },
  });
}
