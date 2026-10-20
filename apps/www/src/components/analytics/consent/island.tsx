import { ConvexProvider, type ConvexReactClient } from "convex/react";
import {
  AccountConsentControls,
  AccountConsentEffects,
  AccountConsentFooterItem,
} from "@/components/analytics/consent/account";

/** The signed-in prompt on a marketing page: the page's one Convex client around the account. */
export function IslandConsentControls({
  client,
}: {
  client: ConvexReactClient;
}) {
  return (
    <ConvexProvider client={client}>
      <AccountConsentControls />
    </ConvexProvider>
  );
}

/** The signed-in footer item on a marketing page, on the page's one Convex client. */
export function IslandConsentFooterItem({
  client,
}: {
  client: ConvexReactClient;
}) {
  return (
    <ConvexProvider client={client}>
      <AccountConsentFooterItem />
    </ConvexProvider>
  );
}

/** The signed-in consent effects of a marketing page, on the page's one Convex client. */
export function IslandConsentEffects({
  client,
}: {
  client: ConvexReactClient;
}) {
  return (
    <ConvexProvider client={client}>
      <AccountConsentEffects />
    </ConvexProvider>
  );
}
