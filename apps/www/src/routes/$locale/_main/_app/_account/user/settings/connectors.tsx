import { createFileRoute } from "@tanstack/react-router";
import { Schema } from "effect";
import { ConnectOutcomeContext } from "@/components/connectors/actions";
import { ConnectSearch } from "@/components/connectors/outcome";
import {
  AccountDirectory,
  UserSettingsConnectors,
} from "@/components/user/settings/connectors";
import { privateHead } from "@/lib/account/head";
import { connectorsScreenFn } from "@/lib/account/settings.functions";

/** The account's own Google connectors, which Nina reads for this account alone. */
export const Route = createFileRoute(
  "/$locale/_main/_app/_account/user/settings/connectors"
)({
  validateSearch: Schema.toStandardSchemaV1(ConnectSearch),
  loader: ({ params }) =>
    connectorsScreenFn({ data: { locale: params.locale } }),
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
