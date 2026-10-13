import { Schema } from "effect";

/** Email domains one tenant may allow. The list sits on the tenant row, which every member function already reads. */
export const EMAIL_DOMAIN_LIMIT = 16;

/** A lowercase host name such as `harapan.example.test`: dot-separated DNS labels. */
const EmailDomain = Schema.String.check(
  Schema.isMaxLength(253),
  Schema.isPattern(
    /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/u
  )
);
const EmailDomains = Schema.Array(EmailDomain).check(
  Schema.isMaxLength(EMAIL_DOMAIN_LIMIT),
  Schema.isUnique()
);

/**
 * The choices an Owner makes for the whole tenant. An empty list of email
 * domains puts no limit on the addresses that invites and Google sign-in
 * accept; a longer list limits them to those domains.
 */
export const TenantPolicies = Schema.Struct({
  emailDomains: EmailDomains,
  nina: Schema.Boolean,
  studentThreads: Schema.Boolean,
});

/** What a new tenant starts with: Nina and student threads off, and no limit on email domains, until its Owner chooses. */
export const NEW_TENANT_POLICIES: typeof TenantPolicies.Type = {
  emailDomains: [],
  nina: false,
  studentThreads: false,
};

/** One policy and its new value, so two Owners changing different policies never overwrite each other. */
export const Policy = Schema.Union([
  Schema.Struct({
    key: Schema.Literal("emailDomains"),
    value: EmailDomains,
  }),
  Schema.Struct({ key: Schema.Literal("nina"), value: Schema.Boolean }),
  Schema.Struct({
    key: Schema.Literal("studentThreads"),
    value: Schema.Boolean,
  }),
]).pipe(Schema.toTaggedUnion("key"));

/** The policies of a tenant with one of them changed. */
export const applyPolicy = (
  policies: typeof TenantPolicies.Type,
  policy: typeof Policy.Type
): typeof TenantPolicies.Type =>
  Policy.match(policy, {
    emailDomains: ({ value }) => ({ ...policies, emailDomains: value }),
    nina: ({ value }) => ({ ...policies, nina: value }),
    studentThreads: ({ value }) => ({ ...policies, studentThreads: value }),
  });
