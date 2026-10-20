import { createFileRoute } from "@tanstack/react-router";
import { serveAgentSkills } from "@/lib/llms/serve.server";
import { methodNotAllowed } from "@/lib/routing/method";

/** The agent-skills discovery manifest that names the Nakafa skill and its digest. */
export const Route = createFileRoute("/.well-known/agent-skills/index.json")({
  server: {
    handlers: { ANY: methodNotAllowed("GET, HEAD"), GET: serveAgentSkills },
  },
});
