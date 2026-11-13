import { HttpClient } from "@confect/js";
import auth from "@repo/backend/confect/_generated/refs/auth";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { Effect, Option, Schema } from "effect";
import { AgentConsent } from "@/components/entry/agent";
import { EntryShellBody, EntryShellHeader } from "@/components/entry/shell";
import { ThemePicker } from "@/components/shared/theme/picker";
import { getPostAuthSignInTarget } from "@/lib/auth/admission";
import { readAgentRequest } from "@/lib/auth/consent";
import { isSignedIn } from "@/lib/auth/gate";
import { httpLayer } from "@/lib/convex/http";
import { TextSearchParam } from "@/lib/entry/search";

/**
 * An agent's authorization request, each key as text. The loader reads it as a
 * whole (`readAgentRequest`), so a malformed link shows the refusal instead of
 * failing the page.
 */
const AgentSearch = Schema.Struct({
  client_id: TextSearchParam,
  code_challenge: TextSearchParam,
  code_challenge_method: TextSearchParam,
  redirect_uri: TextSearchParam,
  response_type: TextSearchParam,
  scope: TextSearchParam,
  state: TextSearchParam,
});

/**
 * Asks a signed-in person whether an agent may act as them: the authorization
 * endpoint that the agent discovery names (ADR 0029). A visitor signs in first
 * and comes back to the same request. The page renders only in the browser, and
 * its loader reads the agent's own name.
 */
export const Route = createFileRoute("/$locale/_entry/agent")({
  validateSearch: Schema.toStandardSchemaV1(AgentSearch),
  ssr: false,
  beforeLoad: async ({ location, params }) => {
    if (await isSignedIn()) {
      return;
    }
    throw redirect(getPostAuthSignInTarget(location.publicHref, params.locale));
  },
  loaderDeps: ({ search }) => search,
  loader: async ({ deps }) => {
    const request = readAgentRequest(deps);
    if (Option.isNone(request)) {
      return { _tag: "Refused" } as const;
    }
    const agent = await Effect.runPromise(
      Effect.flatMap(HttpClient.HttpClient, (client) =>
        client.query(auth.grant.describe, {
          clientId: request.value.client_id,
        })
      ).pipe(Effect.provide(httpLayer()))
    );
    if (agent === null) {
      return { _tag: "Refused" } as const;
    }
    return { _tag: "Ask", name: agent.name, request: request.value } as const;
  },
  component: AgentPage,
});

/** The consent of one agent in the entry frame. */
function AgentPage() {
  return (
    <>
      <EntryShellHeader>
        <div className="ms-auto">
          <ThemePicker variant="ghost" />
        </div>
      </EntryShellHeader>
      <EntryShellBody>
        <AgentConsent />
      </EntryShellBody>
    </>
  );
}
