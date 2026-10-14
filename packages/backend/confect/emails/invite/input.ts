import type { GenericId } from "@confect/core";
import type { ActiveAppLocaleCode } from "@nakafa/aksara-contracts/locale";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import { resolveLegalLinks } from "@repo/backend/confect/emails/legal";
import { readSiteUrl } from "@repo/backend/confect/site/config";
import { publicationLayer } from "@repo/backend/content/publication/confect";
import { readPageCatalog } from "@repo/backend/content/publication/page";
import { Effect } from "effect";

/**
 * What an invitation says: the organisation that invited, where to sign in,
 * and the legal links of the email's language from the signed Pages. It names
 * no person. An invite that was revoked or has expired reads as nothing, so
 * nothing is sent.
 */
export const readInviteInput = Effect.fn("emails.invite.readInput")(function* (
  inviteId: GenericId.GenericId<"tenantInvites">,
  locale: ActiveAppLocaleCode
) {
  const reader = yield* DatabaseReader;
  const invite = yield* reader
    .table("tenantInvites")
    .get(inviteId)
    .pipe(Effect.orDie);
  if (invite.state.status === "revoked" || invite.state.status === "expired") {
    return null;
  }
  const tenant = yield* reader
    .table("tenants")
    .get(invite.tenantId)
    .pipe(Effect.orDie);
  const siteUrl = yield* readSiteUrl();
  const links = yield* resolveLegalLinks(
    yield* readPageCatalog().pipe(Effect.provide(publicationLayer)),
    locale,
    siteUrl
  );
  return {
    locale,
    organisation: tenant.name,
    privacyPolicyUrl: links.privacyPolicyUrl,
    signInUrl: new URL(`/${locale}/auth`, siteUrl).href,
    termsOfServiceUrl: links.termsOfServiceUrl,
  };
});
