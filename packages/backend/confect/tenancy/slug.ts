import { HashSet, Schema } from "effect";

/** One DNS label of lowercase letters and digits with single inner hyphens, so never `xn--`. */
const label = /^[a-z0-9](?:[a-z0-9]|-(?!-))*[a-z0-9]$/;

/**
 * A stored tenant address, also the `slug.nakafa.com` label and the
 * `/[locale]/school/[slug]` route segment. It holds only rules that never
 * change, because Confect decodes stored documents: a reservation added here
 * later would make an existing tenant unreadable.
 */
export const TenantSlug = Schema.String.check(
  Schema.isMinLength(2),
  Schema.isMaxLength(63),
  Schema.isPattern(label)
).pipe(Schema.brand("@Nakafa/TenantSlug"));
export type TenantSlug = typeof TenantSlug.Type;

/**
 * Labels that never name a tenant: live Nakafa hosts, product and account
 * words, application locales, and static segments under `/[locale]/school`.
 * Single-letter hosts such as the analytics proxy `t` already fail the length
 * rule. A new `*.nakafa.com` host or School route segment is added here first.
 */
export const reservedSlugs = HashSet.fromIterable([
  "api",
  "cas",
  "cdn",
  "docs",
  "local",
  "mcp",
  "notifications",
  "origin",
  "status",
  "www",
  "account",
  "accounts",
  "admin",
  "aksara",
  "app",
  "apps",
  "assets",
  "auth",
  "billing",
  "blog",
  "console",
  "dashboard",
  "dev",
  "email",
  "files",
  "help",
  "images",
  "login",
  "logout",
  "mail",
  "media",
  "nakafa",
  "nina",
  "oauth",
  "operator",
  "operators",
  "parent",
  "pay",
  "preview",
  "school",
  "schools",
  "sekolah",
  "signin",
  "signup",
  "sso",
  "staging",
  "static",
  "support",
  "test",
  "verify",
  "webmail",
  "de",
  "en",
  "id",
  "onboarding",
  "select",
]);

/**
 * A label that can name a tenant: a valid slug outside the reservation. New
 * tenants take one, and the subdomain proxy routes only these labels.
 */
export const NewTenantSlug = TenantSlug.check(
  Schema.makeFilter(
    (slug) => !HashSet.has(reservedSlugs, slug) || "This address is reserved."
  )
);
