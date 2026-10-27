import { ConnectOutcome } from "@repo/backend/confect/connectors/schema";
import { createFileRoute } from "@tanstack/react-router";
import { Schema } from "effect";
import type { ReactElement } from "react";
import { ConnectOutcomeContext } from "@/components/connectors/actions";
import { SchoolConnectionsSettings } from "@/components/tenant/connectors/page";

/** What the connect callback appends when the browser comes back: how the connect ended. */
const ConnectionsSearch = Schema.Struct({
  connect: Schema.optionalKey(ConnectOutcome.fields.outcome),
});

/** The school's Google connections and its Classroom import. */
export const Route = createFileRoute("/school/$slug/settings/connections")({
  validateSearch: Schema.toStandardSchemaV1(ConnectionsSearch),
  component: SchoolConnectionsPage,
});

function SchoolConnectionsPage(): ReactElement {
  const { connect } = Route.useSearch();
  return (
    <ConnectOutcomeContext value={connect}>
      <SchoolConnectionsSettings />
    </ConnectOutcomeContext>
  );
}
