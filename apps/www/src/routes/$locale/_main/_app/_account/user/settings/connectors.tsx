import { createFileRoute, notFound, redirect } from "@tanstack/react-router";
import { Effect, Match, Schema } from "effect";
import { ConnectOutcomeContext } from "@/components/connectors/actions";
import { ConnectSearch } from "@/components/connectors/outcome";
import {
  AccountDirectory,
  UserSettingsConnectors,
} from "@/components/user/settings/connectors";
import { privateHead } from "@/lib/account/head";

/** The account's own Google connectors, which Nina reads for this account alone. */
export const Route = createFileRoute(
  "/$locale/_main/_app/_account/user/settings/connectors"
)({
  validateSearch: Schema.toStandardSchemaV1(ConnectSearch),
  loader: async ({ params }) => {
    const { readConnectorsScreen } = await import("@/lib/account/settings");
    const outcome = await Effect.runPromise(
      readConnectorsScreen(params.locale)
    );
    return Match.value(outcome).pipe(
      Match.tagsExhaustive({
        NotFound: () => {
          throw notFound();
        },
        Ready: ({ screen }) => screen,
        SignedOut: () => {
          throw redirect({
            params: { locale: params.locale },
            statusCode: 307,
            to: "/$locale/auth",
          });
        },
      })
    );
  },
  head: ({ loaderData }) =>
    loaderData === undefined ? {} : privateHead(loaderData.seo),
  component: ConnectorsPage,
});

function ConnectorsPage() {
  const search = Route.useSearch();
  const { first, offered } = Route.useLoaderData();
  return (
    <ConnectOutcomeContext value={search}>
      <UserSettingsConnectors>
        <AccountDirectory first={first} initialOffered={offered} />
      </UserSettingsConnectors>
    </ConnectOutcomeContext>
  );
}
