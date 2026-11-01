import { createFileRoute } from "@tanstack/react-router";
import { Schema } from "effect";
import { AgentConsent } from "@/components/entry/agent";
import { EntryShellBody, EntryShellHeader } from "@/components/entry/shell";
import { ThemePicker } from "@/components/shared/theme/picker";
import { readAuthClient } from "@/lib/auth/client";

/** The authorization that Better Auth holds while a person answers. */
const AgentSearch = Schema.Struct({
  client_id: Schema.String,
  consent_code: Schema.String,
});

/** The agent that asks, as it registered itself. */
const AgentClient = Schema.NullOr(
  Schema.Struct({
    name: Schema.NullOr(Schema.String),
    redirect: Schema.NullOr(Schema.String),
  })
);

/**
 * Asks a signed-in person whether an agent may act as them. Better Auth redirects here from an
 * agent's authorization, so the page renders only in the browser and its loader reads the
 * agent's own name.
 */
export const Route = createFileRoute("/$locale/_entry/agent")({
  validateSearch: Schema.toStandardSchemaV1(AgentSearch),
  loaderDeps: ({ search }) => ({ clientId: search.client_id }),
  ssr: false,
  loader: async ({ deps }) => {
    const { data } = await readAuthClient().$fetch("/agent/client", {
      query: { client_id: deps.clientId },
    });
    return Schema.decodeUnknownSync(AgentClient)(data);
  },
  component: AgentPage,
});

/** The consent of one agent in the entry frame. */
function AgentPage() {
  const client = Route.useLoaderData();
  const { consent_code: consentCode } = Route.useSearch();
  return (
    <>
      <EntryShellHeader>
        <div className="ms-auto">
          <ThemePicker variant="ghost" />
        </div>
      </EntryShellHeader>
      <EntryShellBody>
        <AgentConsent
          consentCode={consentCode}
          name={client?.name ?? null}
          redirect={client?.redirect ?? null}
        />
      </EntryShellBody>
    </>
  );
}
