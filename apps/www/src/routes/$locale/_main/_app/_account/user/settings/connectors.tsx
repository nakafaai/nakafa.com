import { ConnectOutcome } from "@repo/backend/confect/connectors/schema";
import { createFileRoute } from "@tanstack/react-router";
import { Schema } from "effect";
import { ConnectOutcomeContext } from "@/components/connectors/actions";
import { UserSettingsConnectors } from "@/components/user/settings/connectors";
import { privateHead } from "@/lib/account/head";
import { connectorsScreenFn } from "@/lib/account/settings.functions";

/** What the connect callback appends when the browser comes back: how the connect ended. */
const ConnectorsSearch = Schema.Struct({
  connect: Schema.optionalKey(ConnectOutcome.fields.outcome),
});

/** The account's own Google connectors, which Nina reads for this account alone. */
export const Route = createFileRoute(
  "/$locale/_main/_app/_account/user/settings/connectors"
)({
  validateSearch: Schema.toStandardSchemaV1(ConnectorsSearch),
  loader: ({ params }) =>
    connectorsScreenFn({ data: { locale: params.locale } }),
  head: ({ loaderData }) =>
    loaderData === undefined ? {} : privateHead(loaderData.seo),
  component: ConnectorsPage,
});

function ConnectorsPage() {
  const { connect } = Route.useSearch();
  return (
    <ConnectOutcomeContext value={connect}>
      <UserSettingsConnectors />
    </ConnectOutcomeContext>
  );
}
