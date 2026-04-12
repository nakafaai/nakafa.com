import { getCachedLlmsIndexText } from "@/lib/llms";

export async function GET() {
  return new Response(await getCachedLlmsIndexText());
}
