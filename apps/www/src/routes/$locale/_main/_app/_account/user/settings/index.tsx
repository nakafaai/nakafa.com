import { createFileRoute } from "@tanstack/react-router";
import { Schema } from "effect";
import { UserSettingsAgents } from "@/components/user/settings/agents";
import { UserSettingsProfilePage } from "@/components/user/settings/profile";
import { privateHead } from "@/lib/account/head";
import { settingsScreenFn } from "@/lib/account/settings.functions";
import { readAuthClient } from "@/lib/auth/client";

/** The agents a person let in, as the auth server lists them. */
const Agents = Schema.Array(
  Schema.Struct({
    clientId: Schema.String,
    name: Schema.NullOr(Schema.String),
  })
);

export const Route = createFileRoute(
  "/$locale/_main/_app/_account/user/settings/"
)({
  loader: async ({ params }) => {
    const [screen, agents] = await Promise.all([
      settingsScreenFn({ data: { locale: params.locale } }),
      readAuthClient().$fetch("/agent/list"),
    ]);
    return {
      ...screen,
      agents: Schema.decodeUnknownSync(Agents)(agents.data ?? []),
    };
  },
  head: ({ loaderData }) =>
    loaderData === undefined ? {} : privateHead(loaderData.seo),
  component: SettingsPage,
});

function SettingsPage() {
  const { account, agents } = Route.useLoaderData();
  return (
    <UserSettingsProfilePage initialAccount={account}>
      <UserSettingsAgents agents={agents} />
    </UserSettingsProfilePage>
  );
}
