import { createFileRoute } from "@tanstack/react-router";
import { serveLlmsIndex } from "@/lib/llms/serve.server";
import { methodNotAllowed } from "@/lib/routing/method";

/** The small root index of the Markdown corpus, for agents. */
export const Route = createFileRoute("/llms.txt")({
  server: {
    handlers: { ANY: methodNotAllowed("GET, HEAD"), GET: serveLlmsIndex },
  },
});
