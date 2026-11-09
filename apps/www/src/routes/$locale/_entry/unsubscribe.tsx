import { createFileRoute } from "@tanstack/react-router";
import { Schema } from "effect";
import type { ReactElement } from "react";
import { UnsubscribePage } from "@/components/unsubscribe/page";

/** The address of the unsubscribe page: the token the email's link carried, if it carried one. */
const UnsubscribeSearch = Schema.Struct({
  token: Schema.optionalKey(Schema.String),
});

/**
 * The page an email's unsubscribe link opens (RFC 8058 names the one-click post; this is the page the footer's link
 * opens). It is no public page, so no search engine lists it.
 */
export const Route = createFileRoute("/$locale/_entry/unsubscribe")({
  validateSearch: Schema.toStandardSchemaV1(UnsubscribeSearch),
  head: () => ({ meta: [{ content: "noindex", name: "robots" }] }),
  component: UnsubscribeRoute,
});

function UnsubscribeRoute(): ReactElement {
  const { token } = Route.useSearch();
  return <UnsubscribePage token={token} />;
}
