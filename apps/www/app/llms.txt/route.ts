import { buildRootLlmsIndexText } from "@/lib/llms/indexes";

/** Serves the small root llms index. */
export function GET() {
  return new Response(buildRootLlmsIndexText(), {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
    },
  });
}
