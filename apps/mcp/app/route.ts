export const runtime = "edge";

export const GET = (): Response =>
  new Response("Welcome to Nakafa MCP!", { status: 200 });
