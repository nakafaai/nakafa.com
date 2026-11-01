import { createFileRoute } from "@tanstack/react-router";
import { Schema } from "effect";
import type { ReactElement } from "react";
import { ConnectOutcomeContext } from "@/components/connectors/actions";
import { ConnectSearch } from "@/components/connectors/outcome";
import { SchoolConnectionsSettings } from "@/components/tenant/connectors/page";

/** The school's Google connections and its Classroom import. */
export const Route = createFileRoute("/school/$slug/settings/connections")({
  validateSearch: Schema.toStandardSchemaV1(ConnectSearch),
  component: SchoolConnectionsPage,
});

function SchoolConnectionsPage(): ReactElement {
  const search = Route.useSearch();
  return (
    <ConnectOutcomeContext value={search}>
      <SchoolConnectionsSettings />
    </ConnectOutcomeContext>
  );
}
