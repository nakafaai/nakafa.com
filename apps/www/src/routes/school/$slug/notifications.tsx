import { createFileRoute } from "@tanstack/react-router";
import { Schema } from "effect";
import type { ReactElement } from "react";
import { SchoolInboxAddressTopic } from "@/components/notifications/topic";
import { SchoolNotifications } from "@/components/tenant/inbox/page";

/**
 * Which schools' rows the page shows, this school's unless the filter asks for every school's, and which tab, All
 * unless the address names another.
 */
const NotificationsSearch = Schema.Struct({
  schools: Schema.optionalKey(Schema.Literal("all")),
  topic: Schema.optionalKey(SchoolInboxAddressTopic),
});

/** The account's notifications on the school's host. */
export const Route = createFileRoute("/school/$slug/notifications")({
  validateSearch: Schema.toStandardSchemaV1(NotificationsSearch),
  component: SchoolNotificationsPage,
});

function SchoolNotificationsPage(): ReactElement {
  const { schools } = Route.useSearch();
  return <SchoolNotifications all={schools === "all"} />;
}
