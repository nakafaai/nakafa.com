import { createFileRoute } from "@tanstack/react-router";
import { serveLlmsMarkdown } from "@/lib/llms/serve.server";
import { methodNotAllowed } from "@/lib/routing/method";

/** The Markdown of one public route, for agents, under its `llms.mdx` path. */
export const Route = createFileRoute("/llms.mdx/$")({
  server: {
    handlers: { ANY: methodNotAllowed("GET, HEAD"), GET: serveLlmsMarkdown },
  },
});
