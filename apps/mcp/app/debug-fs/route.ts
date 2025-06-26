import { debugFileSystem } from "@repo/contents/_lib/utils";

export function GET() {
  const debug = debugFileSystem();

  return new Response(JSON.stringify(debug, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
    },
  });
}
