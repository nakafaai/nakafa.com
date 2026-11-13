import { createFileRoute } from "@tanstack/react-router";
import { Schema } from "effect";
import { UserSettingsAgents } from "@/components/user/settings/agents";
import { UserSettingsProfilePage } from "@/components/user/settings/profile";
import { UserSettingsPage } from "@/components/user/settings/section";
import { privateHead } from "@/lib/account/head";
import { settingsScreenFn } from "@/lib/account/settings.functions";

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
    // A loader sits in the first JavaScript of every page, so the auth client
    // loads here, when a person opens their settings.
    const [screen, agents] = await Promise.all([
      settingsScreenFn({ data: { locale: params.locale } }),
      import("@/lib/auth/client").then(({ readAuthClient }) =>
        readAuthClient().$fetch("/agent/list")
      ),
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
    <UserSettingsPage>
      <UserSettingsProfilePage initialAccount={account}>
        <UserSettingsAgents agents={agents} />
      </UserSettingsProfilePage>
    </UserSettingsPage>
  );
}
