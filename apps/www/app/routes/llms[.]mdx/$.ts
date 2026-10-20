import { createFileRoute } from "@tanstack/react-router";
import { serveLlmsMarkdown } from "@/lib/llms/serve.server";

/** The Markdown of one public route, for agents, under its `llms.mdx` path. */
export const Route = createFileRoute("/llms.mdx/$")({
  server: { handlers: { GET: serveLlmsMarkdown } },
});
