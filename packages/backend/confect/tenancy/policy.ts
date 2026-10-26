import { MAX_CREDITS_PER_RESPONSE } from "@repo/backend/confect/credits/constants";
import {
  Array as Arr,
  Equal,
  Equivalence,
  HashSet,
  Predicate,
  Schema,
  String as Str,
  Struct,
} from "effect";

/** Email domains one tenant may allow. The list sits on the tenant row, which every member function already reads. */
export const EMAIL_DOMAIN_LIMIT = 16;

/** A lowercase host name such as `harapan.example.test`: dot-separated DNS labels. */
const EmailDomain = Schema.String.check(
  Schema.isMaxLength(253),
  Schema.isPattern(
    /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/u
  )
);

/** Two lists name the same domains when each holds every domain of the other, whatever their order. */
const sameDomains = Equivalence.make<readonly string[]>((self, that) =>
  Equal.equals(HashSet.fromIterable(self), HashSet.fromIterable(that))
);

/** The allowed domains are a set: a list that only reorders them is the same choice. */
const EmailDomains = Schema.Array(EmailDomain)
  .check(Schema.isMaxLength(EMAIL_DOMAIN_LIMIT), Schema.isUnique())
  .annotate({ toEquivalence: () => sameDomains });

/** The most Nina credits a school may let one member draw from its pool in a day: twenty answers at the cap. */
const NINA_DAILY_CREDITS_LIMIT = 1000;

/** What one member draws from the pool a day while the school sets no cap of its own: one answer at the cap. */
export const DEFAULT_NINA_DAILY_CREDITS = MAX_CREDITS_PER_RESPONSE;

/** The Nina credits one member may draw from the school's shared pool in a day (K46). */
export const NinaDailyCredits = Schema.Int.check(
  Schema.isBetween({ maximum: NINA_DAILY_CREDITS_LIMIT, minimum: 0 })
);

/**
 * The choices an Owner makes for the whole tenant. An empty list of email
 * domains admits every address into the tenant; a longer list admits only the
 * addresses on those domains, and a claim checks it before it binds a Person to
 * an account. Nina and student threads are stored for the School features that
 * they switch. `ninaDailyCredits` caps what one member draws from the school's
 * Nina pool a day; a school that never set it draws at the default cap.
 */
export const TenantPolicies = Schema.Struct({
  emailDomains: EmailDomains,
  nina: Schema.Boolean,
  ninaDailyCredits: Schema.optionalKey(NinaDailyCredits),
  studentThreads: Schema.Boolean,
});

/** The name of one policy. A journal entry of a policy change holds only this, never the value, so no email domain reaches the journal (ADR 0011). */
export const PolicyKey = Schema.Literals(Struct.keys(TenantPolicies.fields));

/** What a new tenant starts with: Nina and student threads off, and no limit on email domains, until its Owner chooses. */
export const NEW_TENANT_POLICIES: typeof TenantPolicies.Type = {
  emailDomains: [],
  nina: false,
  studentThreads: false,
};

/** One policy of a tenant and its new value, in the schema the tenant stores it with. */
const policyOf = <Key extends keyof typeof TenantPolicies.fields>(key: Key) =>
  Schema.Struct({
    key: Schema.Literal(key),
    value: TenantPolicies.fields[key],
  });

/** One policy and its new value, so two Owners changing different policies never overwrite each other. */
export const Policy = Schema.Union([
  policyOf("emailDomains"),
  policyOf("nina"),
  Schema.Struct({
    key: Schema.Literal("ninaDailyCredits"),
    value: NinaDailyCredits,
  }),
  policyOf("studentThreads"),
]).pipe(Schema.toTaggedUnion("key"));

/** The policies of a tenant with one of them changed. */
export const applyPolicy = (
  policies: typeof TenantPolicies.Type,
  policy: typeof Policy.Type
): typeof TenantPolicies.Type =>
  Policy.match(policy, {
    emailDomains: ({ value }) => ({ ...policies, emailDomains: value }),
    nina: ({ value }) => ({ ...policies, nina: value }),
    ninaDailyCredits: ({ value }) => ({ ...policies, ninaDailyCredits: value }),
    studentThreads: ({ value }) => ({ ...policies, studentThreads: value }),
  });

/**
 * Whether the tenant admits an address: every address while its list of email
 * domains is empty, and otherwise only an address whose domain is exactly one
 * of them, so a subdomain needs its own entry. An address is one local part,
 * `@`, and a lowercase domain, as `Email` writes it.
 */
export const admitsAddress = (
  policies: typeof TenantPolicies.Type,
  address: string
) =>
  Arr.isReadonlyArrayEmpty(policies.emailDomains) ||
  Arr.contains(
    policies.emailDomains,
    Arr.lastNonEmpty(Str.split(address, "@"))
  );

/**
 * Whether the tenant admits an account by its Google sign-ins (ADR 0009): every
 * account while its list of email domains is empty, and otherwise only an
 * account that holds a Google account, each of whose latest sign-ins carried a
 * hosted domain claim (`hd`) that is one of them. Only a Google Workspace
 * account carries the claim, so a personal Google account made on a school
 * address, and an account that never signed in with Google, are not admitted.
 */
export const admitsHostedDomains = (
  policies: typeof TenantPolicies.Type,
  hostedDomains: readonly (string | null)[]
) =>
  Arr.isReadonlyArrayEmpty(policies.emailDomains) ||
  (Arr.isReadonlyArrayNonEmpty(hostedDomains) &&
    Arr.every(
      hostedDomains,
      (domain) =>
        Predicate.isNotNull(domain) &&
        Arr.contains(policies.emailDomains, domain)
    ));
