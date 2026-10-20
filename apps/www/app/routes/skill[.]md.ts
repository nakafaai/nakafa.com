import { createFileRoute } from "@tanstack/react-router";
import { serveSkill } from "@/lib/llms/serve.server";

/** The Nakafa skill guide that agents read before they use the site. */
export const Route = createFileRoute("/skill.md")({
  server: { handlers: { GET: serveSkill } },
});
