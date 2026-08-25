import { LLMS_CACHE_CONTROL } from "@/lib/llms/constants";
import { buildDeveloperLlmsIndexText } from "@/lib/llms/developers";

/** Serves the canonical developer resource index without rewrite ambiguity. */
export function GET() {
  return new Response(buildDeveloperLlmsIndexText(), {
    headers: {
      "Cache-Control": LLMS_CACHE_CONTROL,
      "Content-Type": "text/markdown; charset=utf-8",
      Vary: "Accept, Accept-Encoding",
    },
  });
}
