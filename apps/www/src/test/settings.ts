import type { Ref } from "@confect/core";
import { Id } from "@repo/backend/confect/_generated/id";
import type tenancy from "@repo/backend/confect/_generated/refs/tenancy";
import { Email } from "@repo/backend/confect/tenancy/schema";
import { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { forSeed } from "@repo/mascot/seed";
import { Schema } from "effect";
import type {
  Client,
  Cohort,
  Grant,
  Invite,
  Login,
  Period,
  Person,
  Unit,
} from "@/components/tenant/settings/state";

type Viewer = Ref.Returns<typeof tenancy.viewer.get>;

export const slug = Schema.decodeSync(TenantSlug)("nf");
export const otherSlug = Schema.decodeSync(TenantSlug)("other");
export const paging = { cursor: null, numItems: 25 };
export const later = { cursor: "later", numItems: 25 };
const mascot = forSeed("nf");
const personId = Schema.decodeUnknownSync(Id("tenantPeople"))("person-admin");
export const grantedPersonId = Schema.decodeUnknownSync(Id("tenantPeople"))(
  "person-two"
);
export const smp = Schema.decodeUnknownSync(Id("tenantUnits"))("unit-smp");
export const sma = Schema.decodeUnknownSync(Id("tenantUnits"))("unit-sma");

/** One period as the periods list shows it. */
export function period(
  id: string,
  start: string,
  status: Period["status"]
): Period {
  return {
    end: "2027-06-30",
    id: Schema.decodeUnknownSync(Id("tenantPeriods"))(id),
    name: id,
    start,
    status,
  };
}

/** One cohort, a rombel, as the cohorts list of a period shows it. */
export function cohort(
  id: string,
  name: string,
  grade: number,
  status: Cohort["status"] = "active"
): Cohort {
  return {
    grade,
    id: Schema.decodeUnknownSync(Id("tenantCohorts"))(id),
    name,
    status,
  };
}

/** One unit as the units list shows it, without a national school number. */
export function unit(id: Unit["id"]): Unit {
  return {
    contentLanguage: "id",
    id,
    level: "smp",
    name: "SMP Nakafa",
    npsn: null,
    status: "active",
    timeZone: "Asia/Jakarta",
  };
}

/** One pending invite as the invites list shows it. */
export function invite(id: string): Invite {
  return {
    email: Schema.decodeSync(Email)("guru@example.com"),
    expiresAt: 1_800_000_000_000,
    id: Schema.decodeUnknownSync(Id("tenantInvites"))(id),
    name: id,
    personId,
    roles: [],
    status: "pending",
  };
}

/** One integration client as the clients list shows it. */
export function client(id: string): Client {
  return {
    actions: ["integration.view"],
    createdAt: 1,
    id: Schema.decodeUnknownSync(Id("integrationClients"))(id),
    name: id,
    revokedAt: null,
    rotatedAt: 1,
    scope: { kind: "tenant" },
    status: "active",
  };
}

/** One active grant of the school, with the Person who holds it. */
export function grant(
  id: string,
  role: Grant["role"]["key"] = "teacher"
): Grant {
  return {
    id: Schema.decodeUnknownSync(Id("tenantGrants"))(id),
    person: { id: personId, name: "Admin" },
    revocable: true,
    role: { key: role, kind: "builtin" },
    scope: { kind: "tenant" },
  };
}

/** One Person of the school as the people list shows them. */
export function person(id: string, name: string): Person {
  return {
    account: "unclaimed",
    id: Schema.decodeUnknownSync(Id("tenantPeople"))(id),
    kind: "member",
    name,
    status: "active",
  };
}

/** One school login as the logins list shows it, issued at the given time. */
export function login(loginName: string, issuedAt = 1_800_000_000_000): Login {
  return {
    issuedAt,
    loginName,
    person: {
      id: Schema.decodeUnknownSync(Id("tenantPeople"))(`p-${loginName}`),
      name: `Siswa ${loginName}`,
    },
  };
}

/** The viewer of the school, as the settings pages read it. */
export function viewer(): Viewer {
  return {
    account: { mascot, name: "Admin" },
    can: ["tenant.manage"],
    grants: [],
    person: { id: personId, kind: "member", name: "Admin" },
    tenant: {
      country: "ID",
      currency: "IDR",
      id: Schema.decodeUnknownSync(Id("tenants"))("tenant-nf"),
      kind: "school",
      logo: "stored-logo",
      mascot,
      name: "Nakafa",
      policies: { emailDomains: [], nina: false, studentThreads: false },
      slug,
      status: "active",
    },
    units: [
      {
        can: ["unit.view", "unit.manage", "period.view", "period.manage"],
        contentLanguage: "id",
        id: smp,
        level: "smp",
        name: "SMP Nakafa",
        status: "active",
        timeZone: "Asia/Jakarta",
      },
    ],
  };
}

/** One loaded page of rows, as the server answers a paginated list. */
export const pageOf = <Item>(page: Item[]) => ({
  continueCursor: "next",
  isDone: true,
  page,
});
