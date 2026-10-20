import { createFileRoute } from "@tanstack/react-router";
import { serveLlmsIndex } from "@/lib/llms/serve.server";

/** The small root index of the Markdown corpus, for agents. */
export const Route = createFileRoute("/llms.txt")({
  server: { handlers: { GET: serveLlmsIndex } },
});
