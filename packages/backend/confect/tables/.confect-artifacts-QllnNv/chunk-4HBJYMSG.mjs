import {
  AssignmentKind
} from "./chunk-2BD4RPKF.mjs";
import {
  ConnectorKind
} from "./chunk-AC2Z5QU3.mjs";
import {
  AccessDenied,
  PromotionReturnReason,
  PromotionStep
} from "./chunk-4EUWDRNC.mjs";
import {
  SchoolSize
} from "./chunk-2WEGUCCA.mjs";
import {
  VisitEndReason,
  VisitMinutes,
  VisitReason
} from "./chunk-MFJDTABH.mjs";
import {
  ClaimMethod,
  Currency,
  Npsn,
  PersonReason,
  PolicyKey,
  TenantName,
  TimeZone
} from "./chunk-TS53CRLE.mjs";
import {
  GrantEndReason,
  GrantScope,
  GrantTerm,
  RoleRef,
  Rule
} from "./chunk-SJTH73RA.mjs";
import {
  Minutes,
  ReasonCode
} from "./chunk-7AEMBM5Y.mjs";
import {
  Id
} from "./chunk-ZFJF5VII.mjs";

// ../access/kind.ts
import { Array as Arr, Schema, Struct } from "file:///Users/nabilfatih/Code/nakafa-worktrees/topup/node_modules/.bun/effect@4.0.5/node_modules/effect/dist/index.js";
var Extension = Schema.Struct({
  actions: Schema.Record(Schema.String, Rule),
  changes: Schema.Array(Schema.declare(Schema.isSchema)),
  published: Schema.Array(Schema.String)
});
var Declaration = Extension.mapFields(
  Struct.assign({ relations: Schema.Array(Schema.String) })
);
var Entry = Extension.mapFields(
  Struct.assign({
    action: Schema.declare(Schema.isSchema),
    kind: Schema.String
  })
);
var make = (kind, table, declaration) => ({
  ...declaration,
  action: Schema.Literals(Struct.keys(Struct.get(declaration, "actions"))),
  kind,
  ref: Schema.Struct({ id: Id(table), kind: Schema.Literal(kind) }),
  table
});
var extend = (base, extension) => ({
  ...extension,
  action: Schema.Literals(Struct.keys(Struct.get(extension, "actions"))),
  kind: Struct.get(base, "kind")
});
var of = (entries2, kind) => Arr.filter(
  entries2,
  (entry) => entry.kind === kind
);
var actions = (entries2, kind) => Schema.Union(Arr.map(of(entries2, kind), (entry) => entry.action));
var changes = (entries2, kind) => Schema.Union(
  Arr.flatten(Arr.map(of(entries2, kind), (entry) => entry.changes))
);
var options = (entries2, kind) => Schema.Struct({ action: actions(entries2, kind), arg: Schema.String });
var spec = (options2) => ({
  error: () => AccessDenied,
  functionTypes: { action: false, mutation: true, query: true },
  options: options2
});
var middleware = (entries2, kind) => spec(() => options(entries2, kind));
var Kind = {
  actions,
  changes,
  extend,
  make,
  middleware,
  of,
  options,
  spec
};

// ../tenancy/kinds.ts
import { CountryCodeSchema } from "file:///Users/nabilfatih/Code/nakafa-worktrees/topup/node_modules/.bun/@nakafa+aksara-contracts@1.0.0+23d53938ecc4ddad/node_modules/@nakafa/aksara-contracts/dist/country.js";
import { AppLocaleCodeSchema } from "file:///Users/nabilfatih/Code/nakafa-worktrees/topup/node_modules/.bun/@nakafa+aksara-contracts@1.0.0+23d53938ecc4ddad/node_modules/@nakafa/aksara-contracts/dist/locale.js";

// ../tenancy/contract.ts
import { Schema as Schema2 } from "file:///Users/nabilfatih/Code/nakafa-worktrees/topup/node_modules/.bun/effect@4.0.5/node_modules/effect/dist/index.js";
var DocumentVersion = Schema2.String.check(
  Schema2.isPattern(/^[A-Za-z0-9][A-Za-z0-9._-]{0,31}$/u)
);
var Contract = Schema2.Struct({
  contentLicense: DocumentVersion,
  dpaVersion: DocumentVersion,
  modules: Schema2.Array(
    Schema2.Literals(["classes", "exams", "bank", "grades", "reports"])
  ).check(Schema2.isMinLength(1), Schema2.isUnique()),
  plan: Schema2.Literals(["tenant", "unit"])
});

// ../tenancy/kinds.ts
import { Schema as Schema3 } from "file:///Users/nabilfatih/Code/nakafa-worktrees/topup/node_modules/.bun/effect@4.0.5/node_modules/effect/dist/index.js";
var planReaders = [
  "admin",
  "principal",
  "deputy",
  "staff",
  "auditor",
  "integration"
];
var personReaders = [
  "admin",
  "principal",
  "deputy",
  "counselor",
  "staff",
  "auditor",
  "integration"
];
var tenant = Kind.make("tenant", "tenants", {
  actions: {
    "audit.view": {
      access: "read",
      grantedBy: "roles",
      relations: [],
      roles: ["admin", "principal", "auditor"]
    },
    "tenant.manage": {
      access: "write",
      grantedBy: "roles",
      relations: [],
      roles: ["admin"]
    },
    "tenant.view": {
      access: "read",
      grantedBy: "roles",
      relations: ["member"],
      roles: ["admin", "auditor"]
    }
  },
  changes: [
    Schema3.Struct({
      contract: Contract,
      type: Schema3.Literal("tenant.provisioned")
    }),
    Schema3.Struct({
      size: SchoolSize,
      type: Schema3.Literal("tenant.founded")
    }),
    Schema3.Struct({
      country: CountryCodeSchema,
      currency: Currency,
      type: Schema3.Literal("tenant.locale.set")
    }),
    Schema3.Struct({ type: Schema3.Literal("tenant.logo.removed") }),
    Schema3.Struct({ type: Schema3.Literal("tenant.logo.set") }),
    Schema3.Struct({
      key: PolicyKey,
      type: Schema3.Literal("tenant.policy.set")
    }),
    Schema3.Struct({
      name: TenantName,
      type: Schema3.Literal("tenant.name.set")
    })
  ],
  published: [],
  relations: ["member"]
});
var unit = Kind.make("unit", "tenantUnits", {
  actions: {
    "unit.manage": {
      access: "write",
      grantedBy: "roles",
      relations: [],
      roles: ["admin"]
    },
    "unit.view": {
      access: "read",
      grantedBy: "roles",
      relations: ["member"],
      roles: ["admin", "auditor"]
    }
  },
  changes: [
    Schema3.Struct({ type: Schema3.Literal("unit.created") }),
    Schema3.Struct({
      contentLanguage: AppLocaleCodeSchema,
      timeZone: TimeZone,
      type: Schema3.Literal("unit.locale.set")
    }),
    Schema3.Struct({ type: Schema3.Literal("unit.archived") }),
    Schema3.Struct({ type: Schema3.Literal("unit.unarchived") }),
    Schema3.Struct({
      npsn: Npsn,
      type: Schema3.Literal("unit.npsn.set")
    })
  ],
  published: ["unit.created"],
  relations: ["member"]
});
var person = Kind.make("person", "tenantPeople", {
  actions: {
    "card.issue": {
      access: "write",
      grantedBy: "roles",
      relations: [],
      roles: ["admin"]
    },
    "person.invite": {
      access: "write",
      grantedBy: "roles",
      relations: [],
      roles: ["admin"]
    },
    "person.manage": {
      access: "write",
      grantedBy: "roles",
      relations: [],
      roles: ["admin"]
    },
    "person.view": {
      access: "read",
      grantedBy: "roles",
      relations: ["self"],
      roles: personReaders
    }
  },
  changes: [
    Schema3.Struct({ type: Schema3.Literal("person.created") }),
    Schema3.Struct({
      invite: Id("tenantInvites"),
      reason: Schema3.optionalKey(PersonReason),
      type: Schema3.Literal("person.invited")
    }),
    Schema3.Struct({
      method: ClaimMethod,
      type: Schema3.Literal("person.claimed")
    }),
    Schema3.Struct({ type: Schema3.Literal("person.released") }),
    Schema3.Struct({
      reason: Schema3.optionalKey(PersonReason),
      type: Schema3.Literal("person.removed")
    }),
    Schema3.Struct({ type: Schema3.Literal("person.renamed") }),
    Schema3.Struct({
      cohort: Id("tenantCohorts"),
      type: Schema3.Literal("person.placed")
    }),
    Schema3.Struct({
      from: Id("tenantCohorts"),
      to: Id("tenantCohorts"),
      type: Schema3.Literal("person.moved")
    }),
    Schema3.Struct({
      promotion: Id("tenantPromotions"),
      type: Schema3.Literal("person.graduated")
    }),
    Schema3.Struct({
      invite: Id("tenantInvites"),
      type: Schema3.Literal("invite.expired")
    }),
    Schema3.Struct({
      invite: Id("tenantInvites"),
      type: Schema3.Literal("invite.resent")
    }),
    Schema3.Struct({
      invite: Id("tenantInvites"),
      type: Schema3.Literal("invite.revoked")
    }),
    Schema3.Struct({
      card: Id("loginCards"),
      type: Schema3.Literal("card.issued")
    }),
    Schema3.Struct({
      card: Id("loginCards"),
      type: Schema3.Literal("card.reissued")
    }),
    Schema3.Struct({
      card: Id("loginCards"),
      type: Schema3.Literal("card.redeemed")
    }),
    Schema3.Struct({
      card: Id("loginCards"),
      type: Schema3.Literal("card.printed")
    })
  ],
  published: [
    "person.created",
    "person.invited",
    "person.claimed",
    "person.released",
    "person.removed",
    "card.redeemed"
  ],
  relations: ["self"]
});
var period = Kind.make("period", "tenantPeriods", {
  actions: {
    "period.manage": {
      access: "write",
      grantedBy: "roles",
      relations: [],
      roles: ["admin"]
    },
    "period.view": {
      access: "read",
      grantedBy: "roles",
      relations: [],
      roles: planReaders
    }
  },
  changes: [
    Schema3.Struct({ type: Schema3.Literal("period.created") }),
    Schema3.Struct({ type: Schema3.Literal("period.opened") }),
    Schema3.Struct({ type: Schema3.Literal("period.archived") }),
    Schema3.Struct({ type: Schema3.Literal("period.restored") }),
    Schema3.Struct({ type: Schema3.Literal("period.rename") })
  ],
  published: [],
  relations: []
});
var cohort = Kind.make("cohort", "tenantCohorts", {
  actions: {
    "cohort.manage": {
      access: "write",
      grantedBy: "roles",
      relations: [],
      roles: ["admin"]
    },
    "cohort.view": {
      access: "read",
      grantedBy: "roles",
      relations: ["cohortMember", "homeroom"],
      roles: planReaders
    }
  },
  changes: [
    Schema3.Struct({ type: Schema3.Literal("cohort.created") }),
    Schema3.Struct({ type: Schema3.Literal("cohort.renamed") }),
    Schema3.Struct({ type: Schema3.Literal("cohort.archived") }),
    Schema3.Struct({ type: Schema3.Literal("cohort.restored") }),
    Schema3.Struct({
      assignment: AssignmentKind,
      person: Id("tenantPeople"),
      type: Schema3.Literal("assignment.created")
    }),
    Schema3.Struct({
      assignment: AssignmentKind,
      person: Id("tenantPeople"),
      type: Schema3.Literal("assignment.removed")
    })
  ],
  published: [],
  relations: ["cohortMember", "homeroom"]
});
var tenantPeople = Kind.extend(tenant, {
  actions: {
    "invite.view": {
      access: "read",
      grantedBy: "roles",
      relations: [],
      roles: ["admin"]
    },
    "person.manage": {
      access: "write",
      grantedBy: "roles",
      relations: [],
      roles: ["admin"]
    },
    "person.view": {
      access: "read",
      grantedBy: "roles",
      relations: [],
      roles: personReaders
    }
  },
  changes: [],
  published: []
});
var unitPeriods = Kind.extend(unit, {
  actions: {
    "period.manage": {
      access: "write",
      grantedBy: "roles",
      relations: [],
      roles: ["admin"]
    },
    "period.view": {
      access: "read",
      grantedBy: "roles",
      relations: [],
      roles: planReaders
    }
  },
  changes: [],
  published: []
});
var periodCohorts = Kind.extend(period, {
  actions: {
    "cohort.manage": {
      access: "write",
      grantedBy: "roles",
      relations: [],
      roles: ["admin"]
    }
  },
  changes: [],
  published: []
});
var promotion = Kind.make("promotion", "tenantPromotions", {
  actions: {
    "promotion.apply": {
      access: "write",
      grantedBy: "roles",
      relations: [],
      roles: ["admin"]
    },
    "promotion.approve": {
      access: "write",
      grantedBy: "roles",
      relations: [],
      roles: ["principal"]
    },
    "promotion.prepare": {
      access: "write",
      grantedBy: "roles",
      relations: [],
      roles: ["admin"]
    },
    "promotion.view": {
      access: "read",
      grantedBy: "roles",
      relations: [],
      roles: ["admin", "principal", "deputy", "staff", "auditor"]
    }
  },
  changes: [
    Schema3.Struct({ type: Schema3.Literal("promotion.applied") }),
    Schema3.Struct({ type: Schema3.Literal("promotion.approved") }),
    Schema3.Struct({ type: Schema3.Literal("promotion.cancelled") }),
    Schema3.Struct({ type: Schema3.Literal("promotion.created") }),
    Schema3.Struct({ type: Schema3.Literal("promotion.opened") }),
    Schema3.Struct({ type: Schema3.Literal("promotion.planned") }),
    Schema3.Struct({
      person: Id("tenantPeople"),
      type: Schema3.Literal("promotion.studentPlanned")
    }),
    Schema3.Struct({ type: Schema3.Literal("promotion.submitted") }),
    Schema3.Struct({
      reason: PromotionReturnReason,
      type: Schema3.Literal("promotion.returned")
    }),
    Schema3.Struct({
      step: PromotionStep,
      type: Schema3.Literal("promotion.undone")
    })
  ],
  published: [],
  relations: []
});
var tenancy = {
  extensions: [tenantPeople, unitPeriods, periodCohorts],
  kinds: [tenant, unit, person, period, cohort, promotion]
};

// ../classroom/kinds.ts
import { Schema as Schema4 } from "file:///Users/nabilfatih/Code/nakafa-worktrees/topup/node_modules/.bun/effect@4.0.5/node_modules/effect/dist/index.js";
var classReaders = ["admin", "principal", "deputy"];
var classKind = Kind.make("class", "classes", {
  actions: {
    "class.manage": {
      access: "write",
      grantedBy: "roles",
      relations: [],
      roles: ["admin"]
    },
    "class.view": {
      access: "read",
      grantedBy: "roles",
      relations: ["classMember", "subjectTeacher"],
      roles: classReaders
    },
    "forum.manage": {
      access: "write",
      grantedBy: "roles",
      relations: ["subjectTeacher"],
      roles: ["admin"]
    },
    "forum.read": {
      access: "read",
      grantedBy: "roles",
      relations: ["classMember", "subjectTeacher"],
      roles: classReaders
    }
  },
  changes: [
    Schema4.Struct({ type: Schema4.Literal("class.created") }),
    Schema4.Struct({ type: Schema4.Literal("class.renamed") }),
    Schema4.Struct({ type: Schema4.Literal("class.archived") }),
    Schema4.Struct({
      teacher: Id("tenantPeople"),
      type: Schema4.Literal("class.teacherAssigned")
    }),
    Schema4.Struct({
      teacher: Id("tenantPeople"),
      type: Schema4.Literal("class.teacherRemoved")
    })
  ],
  published: [],
  relations: ["classMember", "subjectTeacher"]
});
var cohortClasses = Kind.extend(cohort, {
  actions: {
    "class.create": {
      access: "write",
      grantedBy: "roles",
      relations: [],
      roles: ["admin"]
    }
  },
  changes: [],
  published: []
});
var periodClasses = Kind.extend(period, {
  actions: {
    "class.list": {
      access: "read",
      grantedBy: "roles",
      relations: [],
      roles: classReaders
    }
  },
  changes: [],
  published: []
});
var classroom = {
  extensions: [cohortClasses, periodClasses],
  kinds: [classKind]
};

// ../connectors/kinds.ts
import { Schema as Schema5 } from "file:///Users/nabilfatih/Code/nakafa-worktrees/topup/node_modules/.bun/effect@4.0.5/node_modules/effect/dist/index.js";
var connection = Kind.make("connection", "connectorConnections", {
  actions: {
    "connection.manage": {
      access: "transition",
      grantedBy: "roles",
      relations: [],
      roles: ["admin"]
    },
    "connection.view": {
      access: "read",
      grantedBy: "roles",
      relations: [],
      roles: ["admin"]
    }
  },
  changes: [
    Schema5.Struct({
      connection: Id("connectorConnections"),
      connector: ConnectorKind,
      type: Schema5.Literal("connection.connected")
    }),
    Schema5.Struct({
      connection: Id("connectorConnections"),
      connector: ConnectorKind,
      type: Schema5.Literal("connection.disconnected")
    }),
    Schema5.Struct({
      connection: Id("connectorConnections"),
      connector: ConnectorKind,
      type: Schema5.Literal("connection.reconnect")
    })
  ],
  published: [],
  relations: []
});
var tenantConnections = Kind.extend(tenant, {
  actions: {
    "connection.view": {
      access: "read",
      grantedBy: "roles",
      relations: [],
      roles: ["admin"]
    }
  },
  changes: [],
  published: []
});
var connectors = {
  extensions: [tenantConnections],
  kinds: [connection]
};

// ../exams/results/kinds.ts
import { Schema as Schema6 } from "file:///Users/nabilfatih/Code/nakafa-worktrees/topup/node_modules/.bun/effect@4.0.5/node_modules/effect/dist/index.js";
var resultViewers = [
  "admin",
  "teacher",
  "principal"
];
var resultReleasers = ["admin"];
var resultKind = Kind.make("result", "examSittings", {
  actions: {
    "result.release": {
      access: "write",
      grantedBy: "roles",
      relations: ["examAuthor"],
      roles: resultReleasers
    },
    "result.view": {
      access: "read",
      grantedBy: "roles",
      relations: ["examAuthor"],
      roles: resultViewers
    }
  },
  changes: [Schema6.Struct({ type: Schema6.Literal("exam.results.released") })],
  published: [],
  relations: ["examAuthor"]
});
var results = { extensions: [], kinds: [resultKind] };

// ../exams/sittings/kinds.ts
import { Schema as Schema7 } from "file:///Users/nabilfatih/Code/nakafa-worktrees/topup/node_modules/.bun/effect@4.0.5/node_modules/effect/dist/index.js";
var sittingProctors = ["teacher", "admin"];
var sittingViewers = [
  "teacher",
  "admin",
  "principal",
  "deputy"
];
var sittingKind = Kind.make("sitting", "examSittings", {
  actions: {
    "sitting.proctor": {
      access: "write",
      grantedBy: "roles",
      relations: ["examAuthor"],
      roles: sittingProctors
    },
    "sitting.view": {
      access: "read",
      grantedBy: "roles",
      relations: ["examAuthor"],
      roles: sittingViewers
    }
  },
  changes: [
    Schema7.Struct({ type: Schema7.Literal("sitting.schedule") }),
    Schema7.Struct({
      attempt: Id("examAttempts"),
      reason: ReasonCode,
      type: Schema7.Literal("sitting.lock")
    }),
    Schema7.Struct({
      attempt: Id("examAttempts"),
      reason: ReasonCode,
      type: Schema7.Literal("sitting.unlock")
    }),
    Schema7.Struct({
      attempt: Id("examAttempts"),
      minutes: Minutes,
      reason: ReasonCode,
      type: Schema7.Literal("sitting.addMinutes")
    }),
    Schema7.Struct({ type: Schema7.Literal("sitting.changeToken") }),
    Schema7.Struct({
      attempt: Id("examAttempts"),
      type: Schema7.Literal("sitting.allowDevice")
    }),
    Schema7.Struct({
      attempt: Id("examAttempts"),
      type: Schema7.Literal("sitting.finish")
    }),
    Schema7.Struct({ type: Schema7.Literal("sitting.close") }),
    Schema7.Struct({ type: Schema7.Literal("sitting.cancel") })
  ],
  published: [],
  relations: ["examAuthor"]
});
var sitting = { extensions: [], kinds: [sittingKind] };

// ../integrations/kinds.ts
import { Schema as Schema8 } from "file:///Users/nabilfatih/Code/nakafa-worktrees/topup/node_modules/.bun/effect@4.0.5/node_modules/effect/dist/index.js";
var integration = Kind.make("integration", "integrationClients", {
  actions: {
    "integration.manage": {
      access: "write",
      grantedBy: "roles",
      relations: [],
      roles: ["admin"]
    },
    "integration.view": {
      access: "read",
      grantedBy: "roles",
      relations: [],
      roles: ["admin"]
    }
  },
  changes: [
    Schema8.Struct({
      client: Id("integrationClients"),
      scope: GrantScope,
      type: Schema8.Literal("integration.created")
    }),
    Schema8.Struct({
      client: Id("integrationClients"),
      type: Schema8.Literal("integration.rotated")
    }),
    Schema8.Struct({
      client: Id("integrationClients"),
      type: Schema8.Literal("integration.revoked")
    })
  ],
  published: [],
  relations: []
});
var tenantIntegrations = Kind.extend(tenant, {
  actions: {
    "integration.manage": {
      access: "write",
      grantedBy: "roles",
      relations: [],
      roles: ["admin"]
    },
    "integration.view": {
      access: "read",
      grantedBy: "roles",
      relations: [],
      roles: ["admin"]
    }
  },
  changes: [],
  published: []
});
var unitIntegrations = Kind.extend(unit, {
  actions: {
    "integration.manage": {
      access: "write",
      grantedBy: "roles",
      relations: [],
      roles: ["admin"]
    }
  },
  changes: [],
  published: []
});
var integrations = {
  extensions: [tenantIntegrations, unitIntegrations],
  kinds: [integration]
};

// ../operators/kinds.ts
import { Schema as Schema9 } from "file:///Users/nabilfatih/Code/nakafa-worktrees/topup/node_modules/.bun/effect@4.0.5/node_modules/effect/dist/index.js";
var visit = Kind.make("visit", "tenantVisits", {
  actions: {
    "visit.end": {
      access: "transition",
      grantedBy: "roles",
      relations: ["visitor"],
      roles: ["admin"]
    }
  },
  changes: [
    Schema9.Struct({
      minutes: VisitMinutes,
      reason: VisitReason,
      type: Schema9.Literal("visit.requested")
    }),
    Schema9.Struct({
      grant: Id("tenantGrants"),
      person: Id("tenantPeople"),
      type: Schema9.Literal("visit.approved")
    }),
    Schema9.Struct({ type: Schema9.Literal("visit.declined") }),
    Schema9.Struct({
      reason: VisitEndReason,
      type: Schema9.Literal("visit.ended")
    })
  ],
  published: [],
  relations: ["visitor"]
});
var tenantOperators = Kind.extend(tenant, {
  actions: {
    "visit.approve": {
      access: "write",
      grantedBy: "roles",
      relations: [],
      roles: ["admin"]
    }
  },
  changes: [
    Schema9.Struct({ type: Schema9.Literal("tenant.suspended") }),
    Schema9.Struct({ type: Schema9.Literal("tenant.reactivated") })
  ],
  published: []
});
var personOperators = Kind.extend(person, {
  actions: {},
  changes: [
    Schema9.Struct({ type: Schema9.Literal("person.reactivated") }),
    Schema9.Struct({ type: Schema9.Literal("person.suspended") })
  ],
  published: []
});
var operators = {
  extensions: [tenantOperators, personOperators],
  kinds: [visit]
};

// ../records/kinds.ts
import { Schema as Schema10 } from "file:///Users/nabilfatih/Code/nakafa-worktrees/topup/node_modules/.bun/effect@4.0.5/node_modules/effect/dist/index.js";
var gradeKind = Kind.make("grade", "classGrades", {
  actions: {
    "grade.release": {
      access: "write",
      grantedBy: "relations",
      relations: ["subjectTeacher"]
    },
    "grade.view": {
      access: "read",
      grantedBy: "relations",
      relations: ["classMember", "subjectTeacher"]
    }
  },
  changes: [
    Schema10.Struct({
      classId: Id("classes"),
      periodId: Id("tenantPeriods"),
      personId: Id("tenantPeople"),
      state: Schema10.Literal("released"),
      type: Schema10.Literal("grade.released")
    })
  ],
  published: ["grade.released"],
  relations: ["classMember", "subjectTeacher"]
});
var classGrades = Kind.extend(classKind, {
  actions: {
    "grade.enter": {
      access: "write",
      grantedBy: "relations",
      relations: ["subjectTeacher"]
    },
    "grade.list": {
      access: "read",
      grantedBy: "relations",
      relations: ["subjectTeacher"]
    }
  },
  changes: [],
  published: []
});
var tenantSchemes = Kind.extend(tenant, {
  actions: {
    "scheme.manage": {
      access: "write",
      grantedBy: "roles",
      relations: [],
      roles: ["admin"]
    }
  },
  changes: [
    Schema10.Struct({
      scheme: Id("gradingSchemes"),
      type: Schema10.Literal("scheme.stored")
    })
  ],
  published: []
});
var records = {
  extensions: [classGrades, tenantSchemes],
  kinds: [gradeKind]
};

// ../access/kinds.ts
import { Schema as Schema11 } from "file:///Users/nabilfatih/Code/nakafa-worktrees/topup/node_modules/.bun/effect@4.0.5/node_modules/effect/dist/index.js";
var grant = Kind.make("grant", "tenantGrants", {
  actions: {
    "grant.revoke": {
      access: "write",
      grantedBy: "roles",
      relations: [],
      roles: ["admin"]
    },
    "grant.view": {
      access: "read",
      grantedBy: "roles",
      relations: ["holder"],
      roles: ["admin", "principal", "auditor"]
    }
  },
  changes: [],
  published: [],
  relations: ["holder"]
});
var tenantGrants = Kind.extend(tenant, {
  actions: {
    "grant.manage": {
      access: "write",
      grantedBy: "roles",
      relations: [],
      roles: ["admin"]
    },
    "owner.manage": {
      access: "write",
      grantedBy: "roles",
      relations: [],
      roles: []
    }
  },
  changes: [],
  published: []
});
var unitGrants = Kind.extend(unit, {
  actions: {
    "grant.manage": {
      access: "write",
      grantedBy: "roles",
      relations: [],
      roles: ["admin"]
    }
  },
  changes: [],
  published: []
});
var personGrants = Kind.extend(person, {
  actions: {},
  changes: [
    Schema11.Struct({
      grant: Id("tenantGrants"),
      role: RoleRef,
      scope: GrantScope,
      term: GrantTerm,
      type: Schema11.Literal("grant.created")
    }),
    Schema11.Struct({
      grant: Id("tenantGrants"),
      reason: GrantEndReason,
      type: Schema11.Literal("grant.ended")
    })
  ],
  published: ["grant.created", "grant.ended"]
});
var access = {
  extensions: [tenantGrants, unitGrants, personGrants],
  kinds: [grant]
};

// ../editor/kinds.ts
var documentEditors = ["admin", "teacher"];
var documentEdit = {
  access: "write",
  grantedBy: "roles",
  relations: [],
  roles: documentEditors
};
var documentKind = Kind.make("document", "editorDocuments", {
  actions: {
    "document.edit": documentEdit,
    "document.view": {
      access: "read",
      grantedBy: "roles",
      relations: [],
      roles: documentEditors
    }
  },
  changes: [],
  published: [],
  relations: []
});
var tenantDocuments = Kind.extend(tenant, {
  actions: { "document.edit": documentEdit },
  changes: [],
  published: []
});
var unitDocuments = Kind.extend(unit, {
  actions: { "document.edit": documentEdit },
  changes: [],
  published: []
});
var editor = {
  extensions: [tenantDocuments, unitDocuments],
  kinds: [documentKind]
};

// ../exams/kinds.ts
var examEditors = ["admin", "teacher"];
var roomViewers = [
  "admin",
  "teacher",
  "principal",
  "deputy"
];
var examKind = Kind.make("exam", "exams", {
  actions: {
    "exam.edit": {
      access: "write",
      grantedBy: "roles",
      relations: [],
      roles: examEditors
    },
    "exam.rooms": {
      access: "read",
      grantedBy: "roles",
      relations: [],
      roles: roomViewers
    },
    "exam.view": {
      access: "read",
      grantedBy: "roles",
      relations: [],
      roles: examEditors
    }
  },
  changes: [],
  published: [],
  relations: []
});
var tenantExams = Kind.extend(tenant, {
  actions: {
    "exam.edit": {
      access: "write",
      grantedBy: "roles",
      relations: [],
      roles: examEditors
    },
    "exam.rooms": {
      access: "read",
      grantedBy: "roles",
      relations: [],
      roles: roomViewers
    },
    "exam.view": {
      access: "read",
      grantedBy: "roles",
      relations: [],
      roles: examEditors
    }
  },
  changes: [],
  published: []
});
var unitExams = Kind.extend(unit, {
  actions: {
    "exam.edit": {
      access: "write",
      grantedBy: "roles",
      relations: [],
      roles: examEditors
    },
    "exam.rooms": {
      access: "read",
      grantedBy: "roles",
      relations: [],
      roles: roomViewers
    },
    "exam.view": {
      access: "read",
      grantedBy: "roles",
      relations: [],
      roles: examEditors
    }
  },
  changes: [],
  published: []
});
var exam = {
  extensions: [tenantExams, unitExams],
  kinds: [examKind]
};

// ../access/catalog.ts
import { Array as Arr2, Record, Schema as Schema12, SchemaGetter, Struct as Struct2 } from "file:///Users/nabilfatih/Code/nakafa-worktrees/topup/node_modules/.bun/effect@4.0.5/node_modules/effect/dist/index.js";
var kinds = [
  ...tenancy.kinds,
  ...access.kinds,
  ...integrations.kinds,
  ...connectors.kinds,
  ...classroom.kinds,
  ...records.kinds,
  ...operators.kinds,
  ...editor.kinds,
  ...exam.kinds,
  ...sitting.kinds,
  ...results.kinds
];
var extensions = [
  ...tenancy.extensions,
  ...access.extensions,
  ...integrations.extensions,
  ...connectors.extensions,
  ...classroom.extensions,
  ...records.extensions,
  ...operators.extensions,
  ...editor.extensions,
  ...exam.extensions,
  ...sitting.extensions,
  ...results.extensions
];
var entries = [...kinds, ...extensions];
var ObjectRef = Schema12.Union(Arr2.map(kinds, (kind) => kind.ref)).pipe(
  Schema12.toTaggedUnion("kind")
);
var Action = Schema12.Union(
  Arr2.map(
    Arr2.filter(entries, (entry) => Struct2.keys(entry.actions).length > 0),
    (entry) => entry.action
  )
);
var TenantAction = Kind.actions(entries, "tenant");
var UnitAction = Kind.actions(entries, "unit");
var capabilitiesOf = (action) => Schema12.Array(Schema12.String).pipe(
  Schema12.decodeTo(Schema12.Array(action), {
    decode: SchemaGetter.transform(Arr2.filter(Schema12.is(action))),
    encode: SchemaGetter.passthroughSubtype()
  })
);
var TenantCapabilities = capabilitiesOf(TenantAction);
var UnitCapabilities = capabilitiesOf(UnitAction);

export {
  Kind,
  tenant,
  unit,
  person,
  period,
  cohort,
  promotion,
  classKind,
  connection,
  resultKind,
  sittingKind,
  integration,
  visit,
  gradeKind,
  entries,
  ObjectRef,
  Action
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vVXNlcnMvbmFiaWxmYXRpaC9Db2RlL25ha2FmYS13b3JrdHJlZXMvdG9wdXAvcGFja2FnZXMvYmFja2VuZC9jb25mZWN0L2FjY2Vzcy9raW5kLnRzIiwgIi4uLy4uLy4uLy4uLy4uLy4uLy4uL1VzZXJzL25hYmlsZmF0aWgvQ29kZS9uYWthZmEtd29ya3RyZWVzL3RvcHVwL3BhY2thZ2VzL2JhY2tlbmQvY29uZmVjdC90ZW5hbmN5L2tpbmRzLnRzIiwgIi4uLy4uLy4uLy4uLy4uLy4uLy4uL1VzZXJzL25hYmlsZmF0aWgvQ29kZS9uYWthZmEtd29ya3RyZWVzL3RvcHVwL3BhY2thZ2VzL2JhY2tlbmQvY29uZmVjdC90ZW5hbmN5L2NvbnRyYWN0LnRzIiwgIi4uLy4uLy4uLy4uLy4uLy4uLy4uL1VzZXJzL25hYmlsZmF0aWgvQ29kZS9uYWthZmEtd29ya3RyZWVzL3RvcHVwL3BhY2thZ2VzL2JhY2tlbmQvY29uZmVjdC9jbGFzc3Jvb20va2luZHMudHMiLCAiLi4vLi4vLi4vLi4vLi4vLi4vLi4vVXNlcnMvbmFiaWxmYXRpaC9Db2RlL25ha2FmYS13b3JrdHJlZXMvdG9wdXAvcGFja2FnZXMvYmFja2VuZC9jb25mZWN0L2Nvbm5lY3RvcnMva2luZHMudHMiLCAiLi4vLi4vLi4vLi4vLi4vLi4vLi4vVXNlcnMvbmFiaWxmYXRpaC9Db2RlL25ha2FmYS13b3JrdHJlZXMvdG9wdXAvcGFja2FnZXMvYmFja2VuZC9jb25mZWN0L2V4YW1zL3Jlc3VsdHMva2luZHMudHMiLCAiLi4vLi4vLi4vLi4vLi4vLi4vLi4vVXNlcnMvbmFiaWxmYXRpaC9Db2RlL25ha2FmYS13b3JrdHJlZXMvdG9wdXAvcGFja2FnZXMvYmFja2VuZC9jb25mZWN0L2V4YW1zL3NpdHRpbmdzL2tpbmRzLnRzIiwgIi4uLy4uLy4uLy4uLy4uLy4uLy4uL1VzZXJzL25hYmlsZmF0aWgvQ29kZS9uYWthZmEtd29ya3RyZWVzL3RvcHVwL3BhY2thZ2VzL2JhY2tlbmQvY29uZmVjdC9pbnRlZ3JhdGlvbnMva2luZHMudHMiLCAiLi4vLi4vLi4vLi4vLi4vLi4vLi4vVXNlcnMvbmFiaWxmYXRpaC9Db2RlL25ha2FmYS13b3JrdHJlZXMvdG9wdXAvcGFja2FnZXMvYmFja2VuZC9jb25mZWN0L29wZXJhdG9ycy9raW5kcy50cyIsICIuLi8uLi8uLi8uLi8uLi8uLi8uLi9Vc2Vycy9uYWJpbGZhdGloL0NvZGUvbmFrYWZhLXdvcmt0cmVlcy90b3B1cC9wYWNrYWdlcy9iYWNrZW5kL2NvbmZlY3QvcmVjb3Jkcy9raW5kcy50cyIsICIuLi8uLi8uLi8uLi8uLi8uLi8uLi9Vc2Vycy9uYWJpbGZhdGloL0NvZGUvbmFrYWZhLXdvcmt0cmVlcy90b3B1cC9wYWNrYWdlcy9iYWNrZW5kL2NvbmZlY3QvYWNjZXNzL2tpbmRzLnRzIiwgIi4uLy4uLy4uLy4uLy4uLy4uLy4uL1VzZXJzL25hYmlsZmF0aWgvQ29kZS9uYWthZmEtd29ya3RyZWVzL3RvcHVwL3BhY2thZ2VzL2JhY2tlbmQvY29uZmVjdC9lZGl0b3Iva2luZHMudHMiLCAiLi4vLi4vLi4vLi4vLi4vLi4vLi4vVXNlcnMvbmFiaWxmYXRpaC9Db2RlL25ha2FmYS13b3JrdHJlZXMvdG9wdXAvcGFja2FnZXMvYmFja2VuZC9jb25mZWN0L2V4YW1zL2tpbmRzLnRzIiwgIi4uLy4uLy4uLy4uLy4uLy4uLy4uL1VzZXJzL25hYmlsZmF0aWgvQ29kZS9uYWthZmEtd29ya3RyZWVzL3RvcHVwL3BhY2thZ2VzL2JhY2tlbmQvY29uZmVjdC9hY2Nlc3MvY2F0YWxvZy50cyJdLAogICJzb3VyY2VSb290IjogImZpbGU6Ly8vdmFyL2ZvbGRlcnMvZ3ovcm5tNHpuX3M0dHoyNm40bTl5YjIxMWIwMDAwMGduL1QvY29uZmVjdC1jb250ZXh0LXFjTmxsRS9vdXRwdXQvIiwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9faW5qZWN0ZWRfZmlsZW5hbWVfXyA9IFwiL1VzZXJzL25hYmlsZmF0aWgvQ29kZS9uYWthZmEtd29ya3RyZWVzL3RvcHVwL3BhY2thZ2VzL2JhY2tlbmQvY29uZmVjdC9hY2Nlc3Mva2luZC50c1wiO2NvbnN0IF9faW5qZWN0ZWRfZGlybmFtZV9fID0gXCIvVXNlcnMvbmFiaWxmYXRpaC9Db2RlL25ha2FmYS13b3JrdHJlZXMvdG9wdXAvcGFja2FnZXMvYmFja2VuZC9jb25mZWN0L2FjY2Vzc1wiO2NvbnN0IF9faW5qZWN0ZWRfaW1wb3J0X21ldGFfdXJsX18gPSBcImZpbGU6Ly8vVXNlcnMvbmFiaWxmYXRpaC9Db2RlL25ha2FmYS13b3JrdHJlZXMvdG9wdXAvcGFja2FnZXMvYmFja2VuZC9jb25mZWN0L2FjY2Vzcy9raW5kLnRzXCI7aW1wb3J0IHsgSWQsIHR5cGUgVGFibGVOYW1lcyB9IGZyb20gXCJAcmVwby9iYWNrZW5kL2NvbmZlY3QvX2dlbmVyYXRlZC9pZFwiO1xuaW1wb3J0IHsgQWNjZXNzRGVuaWVkIH0gZnJvbSBcIkByZXBvL2JhY2tlbmQvY29uZmVjdC9hY2Nlc3MvZXJyb3JzXCI7XG5pbXBvcnQgeyBSdWxlIH0gZnJvbSBcIkByZXBvL2JhY2tlbmQvY29uZmVjdC9hY2Nlc3Mvc2NoZW1hXCI7XG5pbXBvcnQgeyBBcnJheSBhcyBBcnIsIHR5cGUgUmVjb3JkLCBTY2hlbWEsIFN0cnVjdCB9IGZyb20gXCJlZmZlY3RcIjtcblxuLyoqXG4gKiBXaGF0IGEgbGFuZSBhZGRzIHRvIGEga2luZDogdGhlIGBzb3VyY2UudmVyYmAgYWN0aW9ucyBldmFsdWF0ZWQgb24gaXRzXG4gKiBzdWJqZWN0cyB3aXRoIHRoZWlyIHJ1bGVzLCBhbmQgaXRzIGF1ZGl0ZWQgY2hhbmdlcywgZWFjaCBhIHN0cnVjdCB3aG9zZVxuICogYHR5cGVgIGxpdGVyYWwgbmFtZXMgdGhlIGV2ZW50IGFuZCB3aG9zZSBkZXRhaWxzIGhvbGQgSURzLCBlbnVtcywgYW5kXG4gKiByZWFzb24gY29kZXMgb25seSwgd2l0aCB0aGUgY2hhbmdlIHR5cGVzIGNvbnN1bWVycyBtYXkgc3Vic2NyaWJlIHRvLlxuICovXG5jb25zdCBFeHRlbnNpb24gPSBTY2hlbWEuU3RydWN0KHtcbiAgYWN0aW9uczogU2NoZW1hLlJlY29yZChTY2hlbWEuU3RyaW5nLCBSdWxlKSxcbiAgY2hhbmdlczogU2NoZW1hLkFycmF5KFNjaGVtYS5kZWNsYXJlKFNjaGVtYS5pc1NjaGVtYSkpLFxuICBwdWJsaXNoZWQ6IFNjaGVtYS5BcnJheShTY2hlbWEuU3RyaW5nKSxcbn0pO1xuXG4vKiogQSBraW5kJ3Mgb3duIGRlY2xhcmF0aW9uIGFsc28gbmFtZXMgdGhlIHJlbGF0aW9ucyBhIFBlcnNvbiBjYW4gaG9sZCB0byBpdHMgc3ViamVjdHMuICovXG5jb25zdCBEZWNsYXJhdGlvbiA9IEV4dGVuc2lvbi5tYXBGaWVsZHMoXG4gIFN0cnVjdC5hc3NpZ24oeyByZWxhdGlvbnM6IFNjaGVtYS5BcnJheShTY2hlbWEuU3RyaW5nKSB9KVxuKTtcblxuLyoqIE9uZSBjYXRhbG9nIGVudHJ5LCBhIGRlY2xhcmF0aW9uIG9yIGFuIGV4dGVuc2lvbjogdGhlIGtpbmQgaXQgcnVsZXMgYW5kIGl0cyBhY3Rpb25zIGFzIG9uZSBzY2hlbWEuICovXG5jb25zdCBFbnRyeSA9IEV4dGVuc2lvbi5tYXBGaWVsZHMoXG4gIFN0cnVjdC5hc3NpZ24oe1xuICAgIGFjdGlvbjogU2NoZW1hLmRlY2xhcmUoU2NoZW1hLmlzU2NoZW1hKSxcbiAgICBraW5kOiBTY2hlbWEuU3RyaW5nLFxuICB9KVxuKTtcblxuLyoqIERlY2xhcmVzIG9uZSBraW5kIG9uY2UsIGluIGl0cyBsYW5lOiB0aGUgdGFibGUgaXRzIHN1YmplY3RzIGxpdmUgaW4gYW5kIHdoYXQgaXMgZGVjaWRlZCBhbmQgcmVjb3JkZWQgYWJvdXQgdGhlbS4gKi9cbmNvbnN0IG1ha2UgPSA8XG4gIGNvbnN0IEsgZXh0ZW5kcyBzdHJpbmcsXG4gIGNvbnN0IFQgZXh0ZW5kcyBUYWJsZU5hbWVzLFxuICBjb25zdCBEIGV4dGVuZHMgdHlwZW9mIERlY2xhcmF0aW9uLlR5cGUsXG4+KFxuICBraW5kOiBLLFxuICB0YWJsZTogVCxcbiAgZGVjbGFyYXRpb246IERcbikgPT4gKHtcbiAgLi4uZGVjbGFyYXRpb24sXG4gIGFjdGlvbjogU2NoZW1hLkxpdGVyYWxzKFN0cnVjdC5rZXlzKFN0cnVjdC5nZXQoZGVjbGFyYXRpb24sIFwiYWN0aW9uc1wiKSkpLFxuICBraW5kLFxuICByZWY6IFNjaGVtYS5TdHJ1Y3QoeyBpZDogSWQodGFibGUpLCBraW5kOiBTY2hlbWEuTGl0ZXJhbChraW5kKSB9KSxcbiAgdGFibGUsXG59KTtcblxuLyoqXG4gKiBBZGRzIGFjdGlvbnMgb3IgY2hhbmdlcyB0byBhbm90aGVyIGxhbmUncyBraW5kLCBydWxlZCBieSB0aGF0IGtpbmQnc1xuICogcmVsYXRpb25zOiBgZ3JhbnQubWFuYWdlYCBpcyBldmFsdWF0ZWQgb24gdGhlIHVuaXQgYSBncmFudCBjb3ZlcnMsIHNvIHRoZVxuICogYWNjZXNzIGxhbmUgZXh0ZW5kcyB0aGUgdW5pdCBraW5kLlxuICovXG5jb25zdCBleHRlbmQgPSA8XG4gIGNvbnN0IEIgZXh0ZW5kcyB0eXBlb2YgRW50cnkuVHlwZSxcbiAgY29uc3QgRCBleHRlbmRzIHR5cGVvZiBFeHRlbnNpb24uVHlwZSxcbj4oXG4gIGJhc2U6IEIsXG4gIGV4dGVuc2lvbjogRFxuKSA9PiAoe1xuICAuLi5leHRlbnNpb24sXG4gIGFjdGlvbjogU2NoZW1hLkxpdGVyYWxzKFN0cnVjdC5rZXlzKFN0cnVjdC5nZXQoZXh0ZW5zaW9uLCBcImFjdGlvbnNcIikpKSxcbiAga2luZDogU3RydWN0LmdldChiYXNlLCBcImtpbmRcIiksXG59KTtcblxuLyoqIEEga2luZCdzIGVudHJpZXM6IGl0cyBkZWNsYXJhdGlvbiBhbmQgZXZlcnkgbGFuZSdzIGV4dGVuc2lvbiBvZiBpdC4gKi9cbmNvbnN0IG9mID0gPFxuICBjb25zdCBFIGV4dGVuZHMgcmVhZG9ubHkgKHR5cGVvZiBFbnRyeS5UeXBlKVtdLFxuICBLIGV4dGVuZHMgRVtudW1iZXJdW1wia2luZFwiXSxcbj4oXG4gIGVudHJpZXM6IEUsXG4gIGtpbmQ6IEtcbikgPT5cbiAgQXJyLmZpbHRlcihcbiAgICBlbnRyaWVzLFxuICAgIChlbnRyeSk6IGVudHJ5IGlzIEV4dHJhY3Q8RVtudW1iZXJdLCBSZWNvcmQuUmVhZG9ubHlSZWNvcmQ8XCJraW5kXCIsIEs+PiA9PlxuICAgICAgZW50cnkua2luZCA9PT0ga2luZFxuICApO1xuXG4vKipcbiAqIEV2ZXJ5IGFjdGlvbiBhIGtpbmQncyBkZWNsYXJhdGlvbiBhbmQgaXRzIGV4dGVuc2lvbnMgcnVsZSBvbi4gVGhlIHJldHVyblxuICogdHlwZSBzcGVsbHMgdGhlIHBlci1raW5kIHNlbGVjdGlvbiwgd2hpY2ggdGhlIGNvbXBpbGVyIGNhbm5vdCBpbmZlciBmcm9tXG4gKiB0aGUgZmlsdGVyZWQgZW50cmllcy5cbiAqL1xuY29uc3QgYWN0aW9ucyA9IDxcbiAgY29uc3QgRSBleHRlbmRzIHJlYWRvbmx5ICh0eXBlb2YgRW50cnkuVHlwZSlbXSxcbiAgSyBleHRlbmRzIEVbbnVtYmVyXVtcImtpbmRcIl0sXG4+KFxuICBlbnRyaWVzOiBFLFxuICBraW5kOiBLXG4pOiBTY2hlbWEuVW5pb248XG4gIHJlYWRvbmx5IEV4dHJhY3Q8RVtudW1iZXJdLCBSZWNvcmQuUmVhZG9ubHlSZWNvcmQ8XCJraW5kXCIsIEs+PltcImFjdGlvblwiXVtdXG4+ID0+IFNjaGVtYS5VbmlvbihBcnIubWFwKG9mKGVudHJpZXMsIGtpbmQpLCAoZW50cnkpID0+IGVudHJ5LmFjdGlvbikpO1xuXG4vKiogRXZlcnkgY2hhbmdlIGEga2luZCdzIGRlY2xhcmF0aW9uIGFuZCBpdHMgZXh0ZW5zaW9ucyBkZWNsYXJlLiAqL1xuY29uc3QgY2hhbmdlcyA9IDxcbiAgY29uc3QgRSBleHRlbmRzIHJlYWRvbmx5ICh0eXBlb2YgRW50cnkuVHlwZSlbXSxcbiAgSyBleHRlbmRzIEVbbnVtYmVyXVtcImtpbmRcIl0sXG4+KFxuICBlbnRyaWVzOiBFLFxuICBraW5kOiBLXG4pOiBTY2hlbWEuVW5pb248XG4gIHJlYWRvbmx5IEV4dHJhY3Q8XG4gICAgRVtudW1iZXJdLFxuICAgIFJlY29yZC5SZWFkb25seVJlY29yZDxcImtpbmRcIiwgSz5cbiAgPltcImNoYW5nZXNcIl1bbnVtYmVyXVtdXG4+ID0+XG4gIFNjaGVtYS5VbmlvbihcbiAgICBBcnIuZmxhdHRlbihBcnIubWFwKG9mKGVudHJpZXMsIGtpbmQpLCAoZW50cnkpID0+IGVudHJ5LmNoYW5nZXMpKVxuICApO1xuXG4vKipcbiAqIFRoZSBvcHRpb25zIG9mIGFuIG9iamVjdCBraW5kJ3MgYWNjZXNzIHNwZWM6IGBhY3Rpb25gIGlzIHR5cGVkIGZyb20gdGhlXG4gKiBjYXRhbG9nLCBzbyBhbiBhY3Rpb24gb2YgYW5vdGhlciBraW5kIGRvZXMgbm90IGNvbXBpbGUsIGFuZCBgYXJnYCBuYW1lc1xuICogdGhlIGFyZ3VtZW50IGhvbGRpbmcgdGhlIHN1YmplY3QncyBJRC5cbiAqL1xuY29uc3Qgb3B0aW9ucyA9IDxcbiAgY29uc3QgRSBleHRlbmRzIHJlYWRvbmx5ICh0eXBlb2YgRW50cnkuVHlwZSlbXSxcbiAgSyBleHRlbmRzIEVbbnVtYmVyXVtcImtpbmRcIl0sXG4+KFxuICBlbnRyaWVzOiBFLFxuICBraW5kOiBLXG4pID0+IFNjaGVtYS5TdHJ1Y3QoeyBhY3Rpb246IGFjdGlvbnMoZW50cmllcywga2luZCksIGFyZzogU2NoZW1hLlN0cmluZyB9KTtcblxuLyoqXG4gKiBUaGUgY2xpZW50LXNhZmUgaGFsZiBvZiBldmVyeSBhY2Nlc3Mgc3BlYzogaXQgcmVmdXNlcyB3aXRoIGBBY2Nlc3NEZW5pZWRgLFxuICogcnVucyBpbiBxdWVyaWVzIGFuZCBtdXRhdGlvbnMgKHRoZSBmaXJzdCBsYW5lIHRoYXQgYXR0YWNoZXMgb25lIHRvIGEgQ29udmV4XG4gKiBhY3Rpb24gdHVybnMgYGFjdGlvbmAgb24gaGVyZSksIGFuZCBidWlsZHMgaXRzIG9wdGlvbnMgb24gZmlyc3QgdXNlLlxuICovXG5jb25zdCBzcGVjID0gPFMgZXh0ZW5kcyBTY2hlbWEuVG9wPihvcHRpb25zOiAoKSA9PiBTKSA9PiAoe1xuICBlcnJvcjogKCkgPT4gQWNjZXNzRGVuaWVkLFxuICBmdW5jdGlvblR5cGVzOiB7IGFjdGlvbjogZmFsc2UsIG11dGF0aW9uOiB0cnVlLCBxdWVyeTogdHJ1ZSB9IGFzIGNvbnN0LFxuICBvcHRpb25zLFxufSk7XG5cbi8qKiBUaGUgY2xpZW50LXNhZmUgaGFsZiBvZiBhbiBvYmplY3Qga2luZCdzIGFjY2VzcyBzcGVjLiAqL1xuY29uc3QgbWlkZGxld2FyZSA9IDxcbiAgY29uc3QgRSBleHRlbmRzIHJlYWRvbmx5ICh0eXBlb2YgRW50cnkuVHlwZSlbXSxcbiAgSyBleHRlbmRzIEVbbnVtYmVyXVtcImtpbmRcIl0sXG4+KFxuICBlbnRyaWVzOiBFLFxuICBraW5kOiBLXG4pID0+IHNwZWMoKCkgPT4gb3B0aW9ucyhlbnRyaWVzLCBraW5kKSk7XG5cbi8qKiBEZWNsYXJlcyBhY2Nlc3Mga2luZHMgb25jZSBwZXIgbGFuZSBhbmQgZGVyaXZlcyBlYWNoIGtpbmQncyBzY2hlbWFzIGZyb20gZXZlcnkgbGFuZSdzIGVudHJpZXMuICovXG5leHBvcnQgY29uc3QgS2luZCA9IHtcbiAgYWN0aW9ucyxcbiAgY2hhbmdlcyxcbiAgZXh0ZW5kLFxuICBtYWtlLFxuICBtaWRkbGV3YXJlLFxuICBvZixcbiAgb3B0aW9ucyxcbiAgc3BlYyxcbn07XG4iLCAiY29uc3QgX19pbmplY3RlZF9maWxlbmFtZV9fID0gXCIvVXNlcnMvbmFiaWxmYXRpaC9Db2RlL25ha2FmYS13b3JrdHJlZXMvdG9wdXAvcGFja2FnZXMvYmFja2VuZC9jb25mZWN0L3RlbmFuY3kva2luZHMudHNcIjtjb25zdCBfX2luamVjdGVkX2Rpcm5hbWVfXyA9IFwiL1VzZXJzL25hYmlsZmF0aWgvQ29kZS9uYWthZmEtd29ya3RyZWVzL3RvcHVwL3BhY2thZ2VzL2JhY2tlbmQvY29uZmVjdC90ZW5hbmN5XCI7Y29uc3QgX19pbmplY3RlZF9pbXBvcnRfbWV0YV91cmxfXyA9IFwiZmlsZTovLy9Vc2Vycy9uYWJpbGZhdGloL0NvZGUvbmFrYWZhLXdvcmt0cmVlcy90b3B1cC9wYWNrYWdlcy9iYWNrZW5kL2NvbmZlY3QvdGVuYW5jeS9raW5kcy50c1wiO2ltcG9ydCB7IENvdW50cnlDb2RlU2NoZW1hIH0gZnJvbSBcIkBuYWthZmEvYWtzYXJhLWNvbnRyYWN0cy9jb3VudHJ5XCI7XG5pbXBvcnQgeyBBcHBMb2NhbGVDb2RlU2NoZW1hIH0gZnJvbSBcIkBuYWthZmEvYWtzYXJhLWNvbnRyYWN0cy9sb2NhbGVcIjtcbmltcG9ydCB7IElkIH0gZnJvbSBcIkByZXBvL2JhY2tlbmQvY29uZmVjdC9fZ2VuZXJhdGVkL2lkXCI7XG5pbXBvcnQgeyBLaW5kIH0gZnJvbSBcIkByZXBvL2JhY2tlbmQvY29uZmVjdC9hY2Nlc3Mva2luZFwiO1xuaW1wb3J0IHR5cGUgeyBSdWxlUm9sZSB9IGZyb20gXCJAcmVwby9iYWNrZW5kL2NvbmZlY3QvYWNjZXNzL3NjaGVtYVwiO1xuaW1wb3J0IHsgQXNzaWdubWVudEtpbmQgfSBmcm9tIFwiQHJlcG8vYmFja2VuZC9jb25mZWN0L3RlbmFuY3kvYXNzaWdubWVudFwiO1xuaW1wb3J0IHsgQ29udHJhY3QgfSBmcm9tIFwiQHJlcG8vYmFja2VuZC9jb25mZWN0L3RlbmFuY3kvY29udHJhY3RcIjtcbmltcG9ydCB7IEN1cnJlbmN5LCBUaW1lWm9uZSB9IGZyb20gXCJAcmVwby9iYWNrZW5kL2NvbmZlY3QvdGVuYW5jeS9sb2NhbGVcIjtcbmltcG9ydCB7IFBvbGljeUtleSB9IGZyb20gXCJAcmVwby9iYWNrZW5kL2NvbmZlY3QvdGVuYW5jeS9wb2xpY3lcIjtcbmltcG9ydCB7XG4gIFByb21vdGlvblJldHVyblJlYXNvbixcbiAgUHJvbW90aW9uU3RlcCxcbn0gZnJvbSBcIkByZXBvL2JhY2tlbmQvY29uZmVjdC90ZW5hbmN5L3Byb21vdGlvbi9zY2hlbWFcIjtcbmltcG9ydCB7XG4gIENsYWltTWV0aG9kLFxuICBOcHNuLFxuICBQZXJzb25SZWFzb24sXG4gIFRlbmFudE5hbWUsXG59IGZyb20gXCJAcmVwby9iYWNrZW5kL2NvbmZlY3QvdGVuYW5jeS9zY2hlbWFcIjtcbmltcG9ydCB7IFNjaG9vbFNpemUgfSBmcm9tIFwiQHJlcG8vYmFja2VuZC9jb25mZWN0L3RlbmFuY3kvc3RhcnRcIjtcbmltcG9ydCB7IFNjaGVtYSB9IGZyb20gXCJlZmZlY3RcIjtcblxuLyoqXG4gKiBUaGUgc2Nob29sIHJvbGVzIGFuZCBpbnRlZ3JhdGlvbiBjbGllbnRzIHRoYXQgcmVhZCB0aGUgcGVyaW9kcyBhbmQgY29ob3J0c1xuICogb2YgdGhlaXIgc2Nob29sLiBBIGNsaWVudCBob2xkcyBhIHJlYWQgb25seSB3aGVuIGl0cyBhY3Rpb24gbGlzdCBuYW1lcyBpdC5cbiAqL1xuY29uc3QgcGxhblJlYWRlcnM6ICh0eXBlb2YgUnVsZVJvbGUuVHlwZSlbXSA9IFtcbiAgXCJhZG1pblwiLFxuICBcInByaW5jaXBhbFwiLFxuICBcImRlcHV0eVwiLFxuICBcInN0YWZmXCIsXG4gIFwiYXVkaXRvclwiLFxuICBcImludGVncmF0aW9uXCIsXG5dO1xuXG4vKiogVGhlIHNjaG9vbCByb2xlcyBhbmQgaW50ZWdyYXRpb24gY2xpZW50cyB0aGF0IHJlYWQgdGhlIHBlb3BsZSBvZiB0aGVpciBzY2hvb2wuICovXG5jb25zdCBwZXJzb25SZWFkZXJzOiAodHlwZW9mIFJ1bGVSb2xlLlR5cGUpW10gPSBbXG4gIFwiYWRtaW5cIixcbiAgXCJwcmluY2lwYWxcIixcbiAgXCJkZXB1dHlcIixcbiAgXCJjb3Vuc2Vsb3JcIixcbiAgXCJzdGFmZlwiLFxuICBcImF1ZGl0b3JcIixcbiAgXCJpbnRlZ3JhdGlvblwiLFxuXTtcblxuLyoqXG4gKiBUaGUgdGVuYW50IGl0c2VsZi4gRXZlcnkgYWN0aXZlIG1lbWJlciBQZXJzb24gcmVhY2hlcyB0aGUgU2Nob29sIHNoZWxsXG4gKiB0aHJvdWdoIHRoZSBgbWVtYmVyYCByZWxhdGlvbjsgb3BlcmF0b3IgUGVyc29ucyBhY3Qgb25seSB0aHJvdWdoIHRoZWlyXG4gKiBhdWRpdGVkIGdyYW50cy5cbiAqL1xuZXhwb3J0IGNvbnN0IHRlbmFudCA9IEtpbmQubWFrZShcInRlbmFudFwiLCBcInRlbmFudHNcIiwge1xuICBhY3Rpb25zOiB7XG4gICAgXCJhdWRpdC52aWV3XCI6IHtcbiAgICAgIGFjY2VzczogXCJyZWFkXCIsXG4gICAgICBncmFudGVkQnk6IFwicm9sZXNcIixcbiAgICAgIHJlbGF0aW9uczogW10sXG4gICAgICByb2xlczogW1wiYWRtaW5cIiwgXCJwcmluY2lwYWxcIiwgXCJhdWRpdG9yXCJdLFxuICAgIH0sXG4gICAgXCJ0ZW5hbnQubWFuYWdlXCI6IHtcbiAgICAgIGFjY2VzczogXCJ3cml0ZVwiLFxuICAgICAgZ3JhbnRlZEJ5OiBcInJvbGVzXCIsXG4gICAgICByZWxhdGlvbnM6IFtdLFxuICAgICAgcm9sZXM6IFtcImFkbWluXCJdLFxuICAgIH0sXG4gICAgXCJ0ZW5hbnQudmlld1wiOiB7XG4gICAgICBhY2Nlc3M6IFwicmVhZFwiLFxuICAgICAgZ3JhbnRlZEJ5OiBcInJvbGVzXCIsXG4gICAgICByZWxhdGlvbnM6IFtcIm1lbWJlclwiXSxcbiAgICAgIHJvbGVzOiBbXCJhZG1pblwiLCBcImF1ZGl0b3JcIl0sXG4gICAgfSxcbiAgfSxcbiAgY2hhbmdlczogW1xuICAgIFNjaGVtYS5TdHJ1Y3Qoe1xuICAgICAgY29udHJhY3Q6IENvbnRyYWN0LFxuICAgICAgdHlwZTogU2NoZW1hLkxpdGVyYWwoXCJ0ZW5hbnQucHJvdmlzaW9uZWRcIiksXG4gICAgfSksXG4gICAgU2NoZW1hLlN0cnVjdCh7XG4gICAgICBzaXplOiBTY2hvb2xTaXplLFxuICAgICAgdHlwZTogU2NoZW1hLkxpdGVyYWwoXCJ0ZW5hbnQuZm91bmRlZFwiKSxcbiAgICB9KSxcbiAgICBTY2hlbWEuU3RydWN0KHtcbiAgICAgIGNvdW50cnk6IENvdW50cnlDb2RlU2NoZW1hLFxuICAgICAgY3VycmVuY3k6IEN1cnJlbmN5LFxuICAgICAgdHlwZTogU2NoZW1hLkxpdGVyYWwoXCJ0ZW5hbnQubG9jYWxlLnNldFwiKSxcbiAgICB9KSxcbiAgICBTY2hlbWEuU3RydWN0KHsgdHlwZTogU2NoZW1hLkxpdGVyYWwoXCJ0ZW5hbnQubG9nby5yZW1vdmVkXCIpIH0pLFxuICAgIFNjaGVtYS5TdHJ1Y3QoeyB0eXBlOiBTY2hlbWEuTGl0ZXJhbChcInRlbmFudC5sb2dvLnNldFwiKSB9KSxcbiAgICBTY2hlbWEuU3RydWN0KHtcbiAgICAgIGtleTogUG9saWN5S2V5LFxuICAgICAgdHlwZTogU2NoZW1hLkxpdGVyYWwoXCJ0ZW5hbnQucG9saWN5LnNldFwiKSxcbiAgICB9KSxcbiAgICBTY2hlbWEuU3RydWN0KHtcbiAgICAgIG5hbWU6IFRlbmFudE5hbWUsXG4gICAgICB0eXBlOiBTY2hlbWEuTGl0ZXJhbChcInRlbmFudC5uYW1lLnNldFwiKSxcbiAgICB9KSxcbiAgXSxcbiAgcHVibGlzaGVkOiBbXSxcbiAgcmVsYXRpb25zOiBbXCJtZW1iZXJcIl0sXG59KTtcblxuLyoqIE9uZSBzY2hvb2wgKFNELCBTTVAsIFNNQSkgaW5zaWRlIGEgdGVuYW50OyB1bml0IGdyYW50cyBjb3ZlciBpdHMgc3ViamVjdHMuICovXG5leHBvcnQgY29uc3QgdW5pdCA9IEtpbmQubWFrZShcInVuaXRcIiwgXCJ0ZW5hbnRVbml0c1wiLCB7XG4gIGFjdGlvbnM6IHtcbiAgICBcInVuaXQubWFuYWdlXCI6IHtcbiAgICAgIGFjY2VzczogXCJ3cml0ZVwiLFxuICAgICAgZ3JhbnRlZEJ5OiBcInJvbGVzXCIsXG4gICAgICByZWxhdGlvbnM6IFtdLFxuICAgICAgcm9sZXM6IFtcImFkbWluXCJdLFxuICAgIH0sXG4gICAgXCJ1bml0LnZpZXdcIjoge1xuICAgICAgYWNjZXNzOiBcInJlYWRcIixcbiAgICAgIGdyYW50ZWRCeTogXCJyb2xlc1wiLFxuICAgICAgcmVsYXRpb25zOiBbXCJtZW1iZXJcIl0sXG4gICAgICByb2xlczogW1wiYWRtaW5cIiwgXCJhdWRpdG9yXCJdLFxuICAgIH0sXG4gIH0sXG4gIGNoYW5nZXM6IFtcbiAgICBTY2hlbWEuU3RydWN0KHsgdHlwZTogU2NoZW1hLkxpdGVyYWwoXCJ1bml0LmNyZWF0ZWRcIikgfSksXG4gICAgU2NoZW1hLlN0cnVjdCh7XG4gICAgICBjb250ZW50TGFuZ3VhZ2U6IEFwcExvY2FsZUNvZGVTY2hlbWEsXG4gICAgICB0aW1lWm9uZTogVGltZVpvbmUsXG4gICAgICB0eXBlOiBTY2hlbWEuTGl0ZXJhbChcInVuaXQubG9jYWxlLnNldFwiKSxcbiAgICB9KSxcbiAgICBTY2hlbWEuU3RydWN0KHsgdHlwZTogU2NoZW1hLkxpdGVyYWwoXCJ1bml0LmFyY2hpdmVkXCIpIH0pLFxuICAgIFNjaGVtYS5TdHJ1Y3QoeyB0eXBlOiBTY2hlbWEuTGl0ZXJhbChcInVuaXQudW5hcmNoaXZlZFwiKSB9KSxcbiAgICBTY2hlbWEuU3RydWN0KHtcbiAgICAgIG5wc246IE5wc24sXG4gICAgICB0eXBlOiBTY2hlbWEuTGl0ZXJhbChcInVuaXQubnBzbi5zZXRcIiksXG4gICAgfSksXG4gIF0sXG4gIHB1Ymxpc2hlZDogW1widW5pdC5jcmVhdGVkXCJdLFxuICByZWxhdGlvbnM6IFtcIm1lbWJlclwiXSxcbn0pO1xuXG4vKiogQSBQZXJzb246IHRoZSBzY2hvb2wncyByZWNvcmQgb2Ygc29tZW9uZSwgY2xhaW1lZCBieSBhdCBtb3N0IG9uZSBhY2NvdW50LiAqL1xuZXhwb3J0IGNvbnN0IHBlcnNvbiA9IEtpbmQubWFrZShcInBlcnNvblwiLCBcInRlbmFudFBlb3BsZVwiLCB7XG4gIGFjdGlvbnM6IHtcbiAgICBcImNhcmQuaXNzdWVcIjoge1xuICAgICAgYWNjZXNzOiBcIndyaXRlXCIsXG4gICAgICBncmFudGVkQnk6IFwicm9sZXNcIixcbiAgICAgIHJlbGF0aW9uczogW10sXG4gICAgICByb2xlczogW1wiYWRtaW5cIl0sXG4gICAgfSxcbiAgICBcInBlcnNvbi5pbnZpdGVcIjoge1xuICAgICAgYWNjZXNzOiBcIndyaXRlXCIsXG4gICAgICBncmFudGVkQnk6IFwicm9sZXNcIixcbiAgICAgIHJlbGF0aW9uczogW10sXG4gICAgICByb2xlczogW1wiYWRtaW5cIl0sXG4gICAgfSxcbiAgICBcInBlcnNvbi5tYW5hZ2VcIjoge1xuICAgICAgYWNjZXNzOiBcIndyaXRlXCIsXG4gICAgICBncmFudGVkQnk6IFwicm9sZXNcIixcbiAgICAgIHJlbGF0aW9uczogW10sXG4gICAgICByb2xlczogW1wiYWRtaW5cIl0sXG4gICAgfSxcbiAgICBcInBlcnNvbi52aWV3XCI6IHtcbiAgICAgIGFjY2VzczogXCJyZWFkXCIsXG4gICAgICBncmFudGVkQnk6IFwicm9sZXNcIixcbiAgICAgIHJlbGF0aW9uczogW1wic2VsZlwiXSxcbiAgICAgIHJvbGVzOiBwZXJzb25SZWFkZXJzLFxuICAgIH0sXG4gIH0sXG4gIGNoYW5nZXM6IFtcbiAgICBTY2hlbWEuU3RydWN0KHsgdHlwZTogU2NoZW1hLkxpdGVyYWwoXCJwZXJzb24uY3JlYXRlZFwiKSB9KSxcbiAgICBTY2hlbWEuU3RydWN0KHtcbiAgICAgIGludml0ZTogSWQoXCJ0ZW5hbnRJbnZpdGVzXCIpLFxuICAgICAgcmVhc29uOiBTY2hlbWEub3B0aW9uYWxLZXkoUGVyc29uUmVhc29uKSxcbiAgICAgIHR5cGU6IFNjaGVtYS5MaXRlcmFsKFwicGVyc29uLmludml0ZWRcIiksXG4gICAgfSksXG4gICAgU2NoZW1hLlN0cnVjdCh7XG4gICAgICBtZXRob2Q6IENsYWltTWV0aG9kLFxuICAgICAgdHlwZTogU2NoZW1hLkxpdGVyYWwoXCJwZXJzb24uY2xhaW1lZFwiKSxcbiAgICB9KSxcbiAgICBTY2hlbWEuU3RydWN0KHsgdHlwZTogU2NoZW1hLkxpdGVyYWwoXCJwZXJzb24ucmVsZWFzZWRcIikgfSksXG4gICAgU2NoZW1hLlN0cnVjdCh7XG4gICAgICByZWFzb246IFNjaGVtYS5vcHRpb25hbEtleShQZXJzb25SZWFzb24pLFxuICAgICAgdHlwZTogU2NoZW1hLkxpdGVyYWwoXCJwZXJzb24ucmVtb3ZlZFwiKSxcbiAgICB9KSxcbiAgICBTY2hlbWEuU3RydWN0KHsgdHlwZTogU2NoZW1hLkxpdGVyYWwoXCJwZXJzb24ucmVuYW1lZFwiKSB9KSxcbiAgICBTY2hlbWEuU3RydWN0KHtcbiAgICAgIGNvaG9ydDogSWQoXCJ0ZW5hbnRDb2hvcnRzXCIpLFxuICAgICAgdHlwZTogU2NoZW1hLkxpdGVyYWwoXCJwZXJzb24ucGxhY2VkXCIpLFxuICAgIH0pLFxuICAgIFNjaGVtYS5TdHJ1Y3Qoe1xuICAgICAgZnJvbTogSWQoXCJ0ZW5hbnRDb2hvcnRzXCIpLFxuICAgICAgdG86IElkKFwidGVuYW50Q29ob3J0c1wiKSxcbiAgICAgIHR5cGU6IFNjaGVtYS5MaXRlcmFsKFwicGVyc29uLm1vdmVkXCIpLFxuICAgIH0pLFxuICAgIFNjaGVtYS5TdHJ1Y3Qoe1xuICAgICAgcHJvbW90aW9uOiBJZChcInRlbmFudFByb21vdGlvbnNcIiksXG4gICAgICB0eXBlOiBTY2hlbWEuTGl0ZXJhbChcInBlcnNvbi5ncmFkdWF0ZWRcIiksXG4gICAgfSksXG4gICAgU2NoZW1hLlN0cnVjdCh7XG4gICAgICBpbnZpdGU6IElkKFwidGVuYW50SW52aXRlc1wiKSxcbiAgICAgIHR5cGU6IFNjaGVtYS5MaXRlcmFsKFwiaW52aXRlLmV4cGlyZWRcIiksXG4gICAgfSksXG4gICAgU2NoZW1hLlN0cnVjdCh7XG4gICAgICBpbnZpdGU6IElkKFwidGVuYW50SW52aXRlc1wiKSxcbiAgICAgIHR5cGU6IFNjaGVtYS5MaXRlcmFsKFwiaW52aXRlLnJlc2VudFwiKSxcbiAgICB9KSxcbiAgICBTY2hlbWEuU3RydWN0KHtcbiAgICAgIGludml0ZTogSWQoXCJ0ZW5hbnRJbnZpdGVzXCIpLFxuICAgICAgdHlwZTogU2NoZW1hLkxpdGVyYWwoXCJpbnZpdGUucmV2b2tlZFwiKSxcbiAgICB9KSxcbiAgICBTY2hlbWEuU3RydWN0KHtcbiAgICAgIGNhcmQ6IElkKFwibG9naW5DYXJkc1wiKSxcbiAgICAgIHR5cGU6IFNjaGVtYS5MaXRlcmFsKFwiY2FyZC5pc3N1ZWRcIiksXG4gICAgfSksXG4gICAgU2NoZW1hLlN0cnVjdCh7XG4gICAgICBjYXJkOiBJZChcImxvZ2luQ2FyZHNcIiksXG4gICAgICB0eXBlOiBTY2hlbWEuTGl0ZXJhbChcImNhcmQucmVpc3N1ZWRcIiksXG4gICAgfSksXG4gICAgU2NoZW1hLlN0cnVjdCh7XG4gICAgICBjYXJkOiBJZChcImxvZ2luQ2FyZHNcIiksXG4gICAgICB0eXBlOiBTY2hlbWEuTGl0ZXJhbChcImNhcmQucmVkZWVtZWRcIiksXG4gICAgfSksXG4gICAgU2NoZW1hLlN0cnVjdCh7XG4gICAgICBjYXJkOiBJZChcImxvZ2luQ2FyZHNcIiksXG4gICAgICB0eXBlOiBTY2hlbWEuTGl0ZXJhbChcImNhcmQucHJpbnRlZFwiKSxcbiAgICB9KSxcbiAgXSxcbiAgcHVibGlzaGVkOiBbXG4gICAgXCJwZXJzb24uY3JlYXRlZFwiLFxuICAgIFwicGVyc29uLmludml0ZWRcIixcbiAgICBcInBlcnNvbi5jbGFpbWVkXCIsXG4gICAgXCJwZXJzb24ucmVsZWFzZWRcIixcbiAgICBcInBlcnNvbi5yZW1vdmVkXCIsXG4gICAgXCJjYXJkLnJlZGVlbWVkXCIsXG4gIF0sXG4gIHJlbGF0aW9uczogW1wic2VsZlwiXSxcbn0pO1xuXG4vKiogT25lIHBlcmlvZCBvZiBhIHNjaG9vbCAoYSBzZW1lc3RlciBvciBhIHNjaG9vbCB5ZWFyKTogcGxhbm5lZCwgYWN0aXZlLCB0aGVuIGFyY2hpdmVkLiAqL1xuZXhwb3J0IGNvbnN0IHBlcmlvZCA9IEtpbmQubWFrZShcInBlcmlvZFwiLCBcInRlbmFudFBlcmlvZHNcIiwge1xuICBhY3Rpb25zOiB7XG4gICAgXCJwZXJpb2QubWFuYWdlXCI6IHtcbiAgICAgIGFjY2VzczogXCJ3cml0ZVwiLFxuICAgICAgZ3JhbnRlZEJ5OiBcInJvbGVzXCIsXG4gICAgICByZWxhdGlvbnM6IFtdLFxuICAgICAgcm9sZXM6IFtcImFkbWluXCJdLFxuICAgIH0sXG4gICAgXCJwZXJpb2Qudmlld1wiOiB7XG4gICAgICBhY2Nlc3M6IFwicmVhZFwiLFxuICAgICAgZ3JhbnRlZEJ5OiBcInJvbGVzXCIsXG4gICAgICByZWxhdGlvbnM6IFtdLFxuICAgICAgcm9sZXM6IHBsYW5SZWFkZXJzLFxuICAgIH0sXG4gIH0sXG4gIGNoYW5nZXM6IFtcbiAgICBTY2hlbWEuU3RydWN0KHsgdHlwZTogU2NoZW1hLkxpdGVyYWwoXCJwZXJpb2QuY3JlYXRlZFwiKSB9KSxcbiAgICBTY2hlbWEuU3RydWN0KHsgdHlwZTogU2NoZW1hLkxpdGVyYWwoXCJwZXJpb2Qub3BlbmVkXCIpIH0pLFxuICAgIFNjaGVtYS5TdHJ1Y3QoeyB0eXBlOiBTY2hlbWEuTGl0ZXJhbChcInBlcmlvZC5hcmNoaXZlZFwiKSB9KSxcbiAgICBTY2hlbWEuU3RydWN0KHsgdHlwZTogU2NoZW1hLkxpdGVyYWwoXCJwZXJpb2QucmVzdG9yZWRcIikgfSksXG4gICAgU2NoZW1hLlN0cnVjdCh7IHR5cGU6IFNjaGVtYS5MaXRlcmFsKFwicGVyaW9kLnJlbmFtZVwiKSB9KSxcbiAgXSxcbiAgcHVibGlzaGVkOiBbXSxcbiAgcmVsYXRpb25zOiBbXSxcbn0pO1xuXG4vKipcbiAqIE9uZSBjb2hvcnQgKGEgY2xhc3MgZ3JvdXApIG9mIGEgcGVyaW9kLiBBIFBlcnNvbiBwbGFjZWQgaW4gaXQgaG9sZHMgdGhlXG4gKiBgY29ob3J0TWVtYmVyYCByZWxhdGlvbiwgd2hpY2ggb3BlbnMgdGhlIGNvaG9ydCB0byB0aGVtIGFuZCB0byBub2JvZHkgZWxzZVxuICogdGhyb3VnaCB0aGF0IHJlbGF0aW9uLlxuICovXG5leHBvcnQgY29uc3QgY29ob3J0ID0gS2luZC5tYWtlKFwiY29ob3J0XCIsIFwidGVuYW50Q29ob3J0c1wiLCB7XG4gIGFjdGlvbnM6IHtcbiAgICBcImNvaG9ydC5tYW5hZ2VcIjoge1xuICAgICAgYWNjZXNzOiBcIndyaXRlXCIsXG4gICAgICBncmFudGVkQnk6IFwicm9sZXNcIixcbiAgICAgIHJlbGF0aW9uczogW10sXG4gICAgICByb2xlczogW1wiYWRtaW5cIl0sXG4gICAgfSxcbiAgICBcImNvaG9ydC52aWV3XCI6IHtcbiAgICAgIGFjY2VzczogXCJyZWFkXCIsXG4gICAgICBncmFudGVkQnk6IFwicm9sZXNcIixcbiAgICAgIHJlbGF0aW9uczogW1wiY29ob3J0TWVtYmVyXCIsIFwiaG9tZXJvb21cIl0sXG4gICAgICByb2xlczogcGxhblJlYWRlcnMsXG4gICAgfSxcbiAgfSxcbiAgY2hhbmdlczogW1xuICAgIFNjaGVtYS5TdHJ1Y3QoeyB0eXBlOiBTY2hlbWEuTGl0ZXJhbChcImNvaG9ydC5jcmVhdGVkXCIpIH0pLFxuICAgIFNjaGVtYS5TdHJ1Y3QoeyB0eXBlOiBTY2hlbWEuTGl0ZXJhbChcImNvaG9ydC5yZW5hbWVkXCIpIH0pLFxuICAgIFNjaGVtYS5TdHJ1Y3QoeyB0eXBlOiBTY2hlbWEuTGl0ZXJhbChcImNvaG9ydC5hcmNoaXZlZFwiKSB9KSxcbiAgICBTY2hlbWEuU3RydWN0KHsgdHlwZTogU2NoZW1hLkxpdGVyYWwoXCJjb2hvcnQucmVzdG9yZWRcIikgfSksXG4gICAgU2NoZW1hLlN0cnVjdCh7XG4gICAgICBhc3NpZ25tZW50OiBBc3NpZ25tZW50S2luZCxcbiAgICAgIHBlcnNvbjogSWQoXCJ0ZW5hbnRQZW9wbGVcIiksXG4gICAgICB0eXBlOiBTY2hlbWEuTGl0ZXJhbChcImFzc2lnbm1lbnQuY3JlYXRlZFwiKSxcbiAgICB9KSxcbiAgICBTY2hlbWEuU3RydWN0KHtcbiAgICAgIGFzc2lnbm1lbnQ6IEFzc2lnbm1lbnRLaW5kLFxuICAgICAgcGVyc29uOiBJZChcInRlbmFudFBlb3BsZVwiKSxcbiAgICAgIHR5cGU6IFNjaGVtYS5MaXRlcmFsKFwiYXNzaWdubWVudC5yZW1vdmVkXCIpLFxuICAgIH0pLFxuICBdLFxuICBwdWJsaXNoZWQ6IFtdLFxuICByZWxhdGlvbnM6IFtcImNvaG9ydE1lbWJlclwiLCBcImhvbWVyb29tXCJdLFxufSk7XG5cbi8qKlxuICogUGVvcGxlIGFuZCBpbnZpdGVzIGFyZSB0ZW5hbnQtd2lkZTogYW4gQWRtaW4gaW52aXRlcyBhbnlvbmUsIGFuZCB0aGVcbiAqIHRlbmFudC1sZXZlbCByZWFkcyBsaXN0IHRoZSBwZW9wbGUgYW5kIHRoZSBwZW5kaW5nIGludml0ZXMgb2YgdGhlIHNjaG9vbC5cbiAqL1xuY29uc3QgdGVuYW50UGVvcGxlID0gS2luZC5leHRlbmQodGVuYW50LCB7XG4gIGFjdGlvbnM6IHtcbiAgICBcImludml0ZS52aWV3XCI6IHtcbiAgICAgIGFjY2VzczogXCJyZWFkXCIsXG4gICAgICBncmFudGVkQnk6IFwicm9sZXNcIixcbiAgICAgIHJlbGF0aW9uczogW10sXG4gICAgICByb2xlczogW1wiYWRtaW5cIl0sXG4gICAgfSxcbiAgICBcInBlcnNvbi5tYW5hZ2VcIjoge1xuICAgICAgYWNjZXNzOiBcIndyaXRlXCIsXG4gICAgICBncmFudGVkQnk6IFwicm9sZXNcIixcbiAgICAgIHJlbGF0aW9uczogW10sXG4gICAgICByb2xlczogW1wiYWRtaW5cIl0sXG4gICAgfSxcbiAgICBcInBlcnNvbi52aWV3XCI6IHtcbiAgICAgIGFjY2VzczogXCJyZWFkXCIsXG4gICAgICBncmFudGVkQnk6IFwicm9sZXNcIixcbiAgICAgIHJlbGF0aW9uczogW10sXG4gICAgICByb2xlczogcGVyc29uUmVhZGVycyxcbiAgICB9LFxuICB9LFxuICBjaGFuZ2VzOiBbXSxcbiAgcHVibGlzaGVkOiBbXSxcbn0pO1xuXG4vKipcbiAqIFBlcmlvZHMgYXJlIGxpc3RlZCBhbmQgY3JlYXRlZCBvbiB0aGVpciBzY2hvb2wsIHNvIGEgc2Nob29sJ3MgQWRtaW4gY3JlYXRlc1xuICogYSBwZXJpb2QgaW4gdGhlIHNjaG9vbCBhbmQgYW4gYXJjaGl2ZWQgc2Nob29sIHJlZnVzZXMgaXQuXG4gKi9cbmNvbnN0IHVuaXRQZXJpb2RzID0gS2luZC5leHRlbmQodW5pdCwge1xuICBhY3Rpb25zOiB7XG4gICAgXCJwZXJpb2QubWFuYWdlXCI6IHtcbiAgICAgIGFjY2VzczogXCJ3cml0ZVwiLFxuICAgICAgZ3JhbnRlZEJ5OiBcInJvbGVzXCIsXG4gICAgICByZWxhdGlvbnM6IFtdLFxuICAgICAgcm9sZXM6IFtcImFkbWluXCJdLFxuICAgIH0sXG4gICAgXCJwZXJpb2Qudmlld1wiOiB7XG4gICAgICBhY2Nlc3M6IFwicmVhZFwiLFxuICAgICAgZ3JhbnRlZEJ5OiBcInJvbGVzXCIsXG4gICAgICByZWxhdGlvbnM6IFtdLFxuICAgICAgcm9sZXM6IHBsYW5SZWFkZXJzLFxuICAgIH0sXG4gIH0sXG4gIGNoYW5nZXM6IFtdLFxuICBwdWJsaXNoZWQ6IFtdLFxufSk7XG5cbi8qKiBDb2hvcnRzIGFyZSBjcmVhdGVkIGluIHRoZWlyIHBlcmlvZCwgc28gYSBwZXJpb2QgdGhhdCBpcyBhcmNoaXZlZCByZWZ1c2VzIHRoZW0uICovXG5jb25zdCBwZXJpb2RDb2hvcnRzID0gS2luZC5leHRlbmQocGVyaW9kLCB7XG4gIGFjdGlvbnM6IHtcbiAgICBcImNvaG9ydC5tYW5hZ2VcIjoge1xuICAgICAgYWNjZXNzOiBcIndyaXRlXCIsXG4gICAgICBncmFudGVkQnk6IFwicm9sZXNcIixcbiAgICAgIHJlbGF0aW9uczogW10sXG4gICAgICByb2xlczogW1wiYWRtaW5cIl0sXG4gICAgfSxcbiAgfSxcbiAgY2hhbmdlczogW10sXG4gIHB1Ymxpc2hlZDogW10sXG59KTtcblxuLyoqXG4gKiBPbmUgcHJvbW90aW9uIG9mIGEgc2Nob29sJ3Mgc3R1ZGVudHMgdG8gaXRzIG5leHQgcGVyaW9kLiBUaGUgQWRtaW4gcHJlcGFyZXNcbiAqIGFuZCBhcHBsaWVzIGl0LCBhbmQgdGhlIHByaW5jaXBhbCBhcHByb3ZlcyBpdC4gRWFjaCB3cml0ZSB0aGF0IGFwcGx5aW5nIGl0XG4gKiBtYWtlcyBpcyBqb3VybmFsZWQgb24gaXRzIG93biBzdWJqZWN0OiB0aGUgYXJjaGl2ZWQgcGVyaW9kLCB0aGUgbmV3IGNvaG9ydHMsXG4gKiB0aGUgcGxhY2VtZW50cyBhbmQgZ3JhZHVhdGlvbnMgb2Ygc3R1ZGVudHMsIGFuZCB0aGUgY29waWVkIGhvbWVyb29tIHRlYWNoZXJzLlxuICovXG5leHBvcnQgY29uc3QgcHJvbW90aW9uID0gS2luZC5tYWtlKFwicHJvbW90aW9uXCIsIFwidGVuYW50UHJvbW90aW9uc1wiLCB7XG4gIGFjdGlvbnM6IHtcbiAgICBcInByb21vdGlvbi5hcHBseVwiOiB7XG4gICAgICBhY2Nlc3M6IFwid3JpdGVcIixcbiAgICAgIGdyYW50ZWRCeTogXCJyb2xlc1wiLFxuICAgICAgcmVsYXRpb25zOiBbXSxcbiAgICAgIHJvbGVzOiBbXCJhZG1pblwiXSxcbiAgICB9LFxuICAgIFwicHJvbW90aW9uLmFwcHJvdmVcIjoge1xuICAgICAgYWNjZXNzOiBcIndyaXRlXCIsXG4gICAgICBncmFudGVkQnk6IFwicm9sZXNcIixcbiAgICAgIHJlbGF0aW9uczogW10sXG4gICAgICByb2xlczogW1wicHJpbmNpcGFsXCJdLFxuICAgIH0sXG4gICAgXCJwcm9tb3Rpb24ucHJlcGFyZVwiOiB7XG4gICAgICBhY2Nlc3M6IFwid3JpdGVcIixcbiAgICAgIGdyYW50ZWRCeTogXCJyb2xlc1wiLFxuICAgICAgcmVsYXRpb25zOiBbXSxcbiAgICAgIHJvbGVzOiBbXCJhZG1pblwiXSxcbiAgICB9LFxuICAgIFwicHJvbW90aW9uLnZpZXdcIjoge1xuICAgICAgYWNjZXNzOiBcInJlYWRcIixcbiAgICAgIGdyYW50ZWRCeTogXCJyb2xlc1wiLFxuICAgICAgcmVsYXRpb25zOiBbXSxcbiAgICAgIHJvbGVzOiBbXCJhZG1pblwiLCBcInByaW5jaXBhbFwiLCBcImRlcHV0eVwiLCBcInN0YWZmXCIsIFwiYXVkaXRvclwiXSxcbiAgICB9LFxuICB9LFxuICBjaGFuZ2VzOiBbXG4gICAgU2NoZW1hLlN0cnVjdCh7IHR5cGU6IFNjaGVtYS5MaXRlcmFsKFwicHJvbW90aW9uLmFwcGxpZWRcIikgfSksXG4gICAgU2NoZW1hLlN0cnVjdCh7IHR5cGU6IFNjaGVtYS5MaXRlcmFsKFwicHJvbW90aW9uLmFwcHJvdmVkXCIpIH0pLFxuICAgIFNjaGVtYS5TdHJ1Y3QoeyB0eXBlOiBTY2hlbWEuTGl0ZXJhbChcInByb21vdGlvbi5jYW5jZWxsZWRcIikgfSksXG4gICAgU2NoZW1hLlN0cnVjdCh7IHR5cGU6IFNjaGVtYS5MaXRlcmFsKFwicHJvbW90aW9uLmNyZWF0ZWRcIikgfSksXG4gICAgU2NoZW1hLlN0cnVjdCh7IHR5cGU6IFNjaGVtYS5MaXRlcmFsKFwicHJvbW90aW9uLm9wZW5lZFwiKSB9KSxcbiAgICBTY2hlbWEuU3RydWN0KHsgdHlwZTogU2NoZW1hLkxpdGVyYWwoXCJwcm9tb3Rpb24ucGxhbm5lZFwiKSB9KSxcbiAgICBTY2hlbWEuU3RydWN0KHtcbiAgICAgIHBlcnNvbjogSWQoXCJ0ZW5hbnRQZW9wbGVcIiksXG4gICAgICB0eXBlOiBTY2hlbWEuTGl0ZXJhbChcInByb21vdGlvbi5zdHVkZW50UGxhbm5lZFwiKSxcbiAgICB9KSxcbiAgICBTY2hlbWEuU3RydWN0KHsgdHlwZTogU2NoZW1hLkxpdGVyYWwoXCJwcm9tb3Rpb24uc3VibWl0dGVkXCIpIH0pLFxuICAgIFNjaGVtYS5TdHJ1Y3Qoe1xuICAgICAgcmVhc29uOiBQcm9tb3Rpb25SZXR1cm5SZWFzb24sXG4gICAgICB0eXBlOiBTY2hlbWEuTGl0ZXJhbChcInByb21vdGlvbi5yZXR1cm5lZFwiKSxcbiAgICB9KSxcbiAgICBTY2hlbWEuU3RydWN0KHtcbiAgICAgIHN0ZXA6IFByb21vdGlvblN0ZXAsXG4gICAgICB0eXBlOiBTY2hlbWEuTGl0ZXJhbChcInByb21vdGlvbi51bmRvbmVcIiksXG4gICAgfSksXG4gIF0sXG4gIHB1Ymxpc2hlZDogW10sXG4gIHJlbGF0aW9uczogW10sXG59KTtcblxuZXhwb3J0IGNvbnN0IHRlbmFuY3kgPSB7XG4gIGV4dGVuc2lvbnM6IFt0ZW5hbnRQZW9wbGUsIHVuaXRQZXJpb2RzLCBwZXJpb2RDb2hvcnRzXSxcbiAga2luZHM6IFt0ZW5hbnQsIHVuaXQsIHBlcnNvbiwgcGVyaW9kLCBjb2hvcnQsIHByb21vdGlvbl0sXG59IGFzIGNvbnN0O1xuIiwgImNvbnN0IF9faW5qZWN0ZWRfZmlsZW5hbWVfXyA9IFwiL1VzZXJzL25hYmlsZmF0aWgvQ29kZS9uYWthZmEtd29ya3RyZWVzL3RvcHVwL3BhY2thZ2VzL2JhY2tlbmQvY29uZmVjdC90ZW5hbmN5L2NvbnRyYWN0LnRzXCI7Y29uc3QgX19pbmplY3RlZF9kaXJuYW1lX18gPSBcIi9Vc2Vycy9uYWJpbGZhdGloL0NvZGUvbmFrYWZhLXdvcmt0cmVlcy90b3B1cC9wYWNrYWdlcy9iYWNrZW5kL2NvbmZlY3QvdGVuYW5jeVwiO2NvbnN0IF9faW5qZWN0ZWRfaW1wb3J0X21ldGFfdXJsX18gPSBcImZpbGU6Ly8vVXNlcnMvbmFiaWxmYXRpaC9Db2RlL25ha2FmYS13b3JrdHJlZXMvdG9wdXAvcGFja2FnZXMvYmFja2VuZC9jb25mZWN0L3RlbmFuY3kvY29udHJhY3QudHNcIjtpbXBvcnQgeyBTY2hlbWEgfSBmcm9tIFwiZWZmZWN0XCI7XG5cbi8qKiBUaGUgbGFiZWwgb2Ygb25lIHNpZ25lZCBkb2N1bWVudCB2ZXJzaW9uLCBzdWNoIGFzIGAyMDI2LTEwYCBvciBgMS4wYC4gKi9cbmNvbnN0IERvY3VtZW50VmVyc2lvbiA9IFNjaGVtYS5TdHJpbmcuY2hlY2soXG4gIFNjaGVtYS5pc1BhdHRlcm4oL15bQS1aYS16MC05XVtBLVphLXowLTkuXy1dezAsMzF9JC91KVxuKTtcblxuLyoqXG4gKiBXaGF0IGEgc2Nob29sIHNpZ25lZCB3aXRoIE5ha2FmYSB3aGVuIGl0IHdhcyBvcGVuZWQsIGFzIHRoZSBqb3VybmFsIHJlY29yZHNcbiAqIGl0LiBUaGUgbGljZW5jZSBjb3ZlcnMgdGhlIHdob2xlIHRlbmFudCBvciBvbmUgdW5pdCwgdGhlIG1vZHVsZXMgYXJlIHRoZVxuICogcGFydHMgb2YgTmFrYWZhIFNjaG9vbCB0aGUgY29udHJhY3Qgc3dpdGNoZXMgb24sIGFuZCB0aGUgdHdvIHZlcnNpb25zIG5hbWVcbiAqIHRoZSBkYXRhIHByb2Nlc3NpbmcgYWdyZWVtZW50IGFuZCB0aGUgY29udGVudCBsaWNlbmNlIHRoZSBzY2hvb2wgYWNjZXB0ZWQuXG4gKi9cbmV4cG9ydCBjb25zdCBDb250cmFjdCA9IFNjaGVtYS5TdHJ1Y3Qoe1xuICBjb250ZW50TGljZW5zZTogRG9jdW1lbnRWZXJzaW9uLFxuICBkcGFWZXJzaW9uOiBEb2N1bWVudFZlcnNpb24sXG4gIG1vZHVsZXM6IFNjaGVtYS5BcnJheShcbiAgICBTY2hlbWEuTGl0ZXJhbHMoW1wiY2xhc3Nlc1wiLCBcImV4YW1zXCIsIFwiYmFua1wiLCBcImdyYWRlc1wiLCBcInJlcG9ydHNcIl0pXG4gICkuY2hlY2soU2NoZW1hLmlzTWluTGVuZ3RoKDEpLCBTY2hlbWEuaXNVbmlxdWUoKSksXG4gIHBsYW46IFNjaGVtYS5MaXRlcmFscyhbXCJ0ZW5hbnRcIiwgXCJ1bml0XCJdKSxcbn0pO1xuIiwgImNvbnN0IF9faW5qZWN0ZWRfZmlsZW5hbWVfXyA9IFwiL1VzZXJzL25hYmlsZmF0aWgvQ29kZS9uYWthZmEtd29ya3RyZWVzL3RvcHVwL3BhY2thZ2VzL2JhY2tlbmQvY29uZmVjdC9jbGFzc3Jvb20va2luZHMudHNcIjtjb25zdCBfX2luamVjdGVkX2Rpcm5hbWVfXyA9IFwiL1VzZXJzL25hYmlsZmF0aWgvQ29kZS9uYWthZmEtd29ya3RyZWVzL3RvcHVwL3BhY2thZ2VzL2JhY2tlbmQvY29uZmVjdC9jbGFzc3Jvb21cIjtjb25zdCBfX2luamVjdGVkX2ltcG9ydF9tZXRhX3VybF9fID0gXCJmaWxlOi8vL1VzZXJzL25hYmlsZmF0aWgvQ29kZS9uYWthZmEtd29ya3RyZWVzL3RvcHVwL3BhY2thZ2VzL2JhY2tlbmQvY29uZmVjdC9jbGFzc3Jvb20va2luZHMudHNcIjtpbXBvcnQgeyBJZCB9IGZyb20gXCJAcmVwby9iYWNrZW5kL2NvbmZlY3QvX2dlbmVyYXRlZC9pZFwiO1xuaW1wb3J0IHsgS2luZCB9IGZyb20gXCJAcmVwby9iYWNrZW5kL2NvbmZlY3QvYWNjZXNzL2tpbmRcIjtcbmltcG9ydCB0eXBlIHsgUnVsZVJvbGUgfSBmcm9tIFwiQHJlcG8vYmFja2VuZC9jb25mZWN0L2FjY2Vzcy9zY2hlbWFcIjtcbmltcG9ydCB7IGNvaG9ydCwgcGVyaW9kIH0gZnJvbSBcIkByZXBvL2JhY2tlbmQvY29uZmVjdC90ZW5hbmN5L2tpbmRzXCI7XG5pbXBvcnQgeyBTY2hlbWEgfSBmcm9tIFwiZWZmZWN0XCI7XG5cbi8qKiBUaGUgc2Nob29sIHJvbGVzIHRoYXQgcmVhZCB0aGUgY2xhc3NlcyBvZiB0aGVpciBzY2hvb2wuICovXG5jb25zdCBjbGFzc1JlYWRlcnM6ICh0eXBlb2YgUnVsZVJvbGUuVHlwZSlbXSA9IFtcImFkbWluXCIsIFwicHJpbmNpcGFsXCIsIFwiZGVwdXR5XCJdO1xuXG4vKipcbiAqIE9uZSBjbGFzczogb25lIHN1YmplY3QgdGF1Z2h0IHRvIG9uZSBjb2hvcnQgaW4gb25lIHBlcmlvZC4gVGhlIEFkbWluIGNyZWF0ZXMsXG4gKiByZW5hbWVzLCBhcmNoaXZlcywgYW5kIGFzc2lnbnMgaXRzIHN1YmplY3QgdGVhY2hlcnMuIFRoZSBsZWFkZXJzIG9mIHRoZSBzY2hvb2xcbiAqIHJlYWQgaXQsIGEgc3ViamVjdCB0ZWFjaGVyIHJlYWRzIGl0IHRocm91Z2ggYHN1YmplY3RUZWFjaGVyYCwgYW5kIGEgc3R1ZGVudFxuICogcGxhY2VkIGluIGl0cyBjb2hvcnQsIHdobyBob2xkcyBhIHN0dWRlbnQgZ3JhbnQgb3ZlciBpdHMgdW5pdCwgcmVhZHMgaXQgdGhyb3VnaFxuICogYGNsYXNzTWVtYmVyYC4gQW4gYXJjaGl2ZWQgY29ob3J0LCBwZXJpb2QsIG9yIHVuaXQgbG9ja3MgdGhlIGNsYXNzLlxuICpcbiAqIEl0cyBmb3J1bSByZWFkcyBmb2xsb3cgdGhlIGNsYXNzJ3MgcmVhZGVycy4gQSB0b3BpYyBjaGFubmVsIGlzIGFkZGVkIGJ5IGFuXG4gKiBBZG1pbiBvciBieSBhIHN1YmplY3QgdGVhY2hlciBvZiB0aGUgY2xhc3MsIGFuZCBhIGxvY2tlZCBjbGFzcyByZWZ1c2VzIGl0LCBzbyBhblxuICogYXJjaGl2ZWQgY2xhc3Mga2VlcHMgaXRzIGNoYW5uZWxzIHJlYWRhYmxlIGFuZCB0YWtlcyBubyBuZXcgb25lLlxuICovXG5leHBvcnQgY29uc3QgY2xhc3NLaW5kID0gS2luZC5tYWtlKFwiY2xhc3NcIiwgXCJjbGFzc2VzXCIsIHtcbiAgYWN0aW9uczoge1xuICAgIFwiY2xhc3MubWFuYWdlXCI6IHtcbiAgICAgIGFjY2VzczogXCJ3cml0ZVwiLFxuICAgICAgZ3JhbnRlZEJ5OiBcInJvbGVzXCIsXG4gICAgICByZWxhdGlvbnM6IFtdLFxuICAgICAgcm9sZXM6IFtcImFkbWluXCJdLFxuICAgIH0sXG4gICAgXCJjbGFzcy52aWV3XCI6IHtcbiAgICAgIGFjY2VzczogXCJyZWFkXCIsXG4gICAgICBncmFudGVkQnk6IFwicm9sZXNcIixcbiAgICAgIHJlbGF0aW9uczogW1wiY2xhc3NNZW1iZXJcIiwgXCJzdWJqZWN0VGVhY2hlclwiXSxcbiAgICAgIHJvbGVzOiBjbGFzc1JlYWRlcnMsXG4gICAgfSxcbiAgICBcImZvcnVtLm1hbmFnZVwiOiB7XG4gICAgICBhY2Nlc3M6IFwid3JpdGVcIixcbiAgICAgIGdyYW50ZWRCeTogXCJyb2xlc1wiLFxuICAgICAgcmVsYXRpb25zOiBbXCJzdWJqZWN0VGVhY2hlclwiXSxcbiAgICAgIHJvbGVzOiBbXCJhZG1pblwiXSxcbiAgICB9LFxuICAgIFwiZm9ydW0ucmVhZFwiOiB7XG4gICAgICBhY2Nlc3M6IFwicmVhZFwiLFxuICAgICAgZ3JhbnRlZEJ5OiBcInJvbGVzXCIsXG4gICAgICByZWxhdGlvbnM6IFtcImNsYXNzTWVtYmVyXCIsIFwic3ViamVjdFRlYWNoZXJcIl0sXG4gICAgICByb2xlczogY2xhc3NSZWFkZXJzLFxuICAgIH0sXG4gIH0sXG4gIGNoYW5nZXM6IFtcbiAgICBTY2hlbWEuU3RydWN0KHsgdHlwZTogU2NoZW1hLkxpdGVyYWwoXCJjbGFzcy5jcmVhdGVkXCIpIH0pLFxuICAgIFNjaGVtYS5TdHJ1Y3QoeyB0eXBlOiBTY2hlbWEuTGl0ZXJhbChcImNsYXNzLnJlbmFtZWRcIikgfSksXG4gICAgU2NoZW1hLlN0cnVjdCh7IHR5cGU6IFNjaGVtYS5MaXRlcmFsKFwiY2xhc3MuYXJjaGl2ZWRcIikgfSksXG4gICAgU2NoZW1hLlN0cnVjdCh7XG4gICAgICB0ZWFjaGVyOiBJZChcInRlbmFudFBlb3BsZVwiKSxcbiAgICAgIHR5cGU6IFNjaGVtYS5MaXRlcmFsKFwiY2xhc3MudGVhY2hlckFzc2lnbmVkXCIpLFxuICAgIH0pLFxuICAgIFNjaGVtYS5TdHJ1Y3Qoe1xuICAgICAgdGVhY2hlcjogSWQoXCJ0ZW5hbnRQZW9wbGVcIiksXG4gICAgICB0eXBlOiBTY2hlbWEuTGl0ZXJhbChcImNsYXNzLnRlYWNoZXJSZW1vdmVkXCIpLFxuICAgIH0pLFxuICBdLFxuICBwdWJsaXNoZWQ6IFtdLFxuICByZWxhdGlvbnM6IFtcImNsYXNzTWVtYmVyXCIsIFwic3ViamVjdFRlYWNoZXJcIl0sXG59KTtcblxuLyoqIEEgY2xhc3MgaXMgY3JlYXRlZCBpbiBpdHMgY29ob3J0LCBzbyBhbiBhcmNoaXZlZCBjb2hvcnQsIHBlcmlvZCwgb3IgdW5pdCByZWZ1c2VzIGl0LiAqL1xuY29uc3QgY29ob3J0Q2xhc3NlcyA9IEtpbmQuZXh0ZW5kKGNvaG9ydCwge1xuICBhY3Rpb25zOiB7XG4gICAgXCJjbGFzcy5jcmVhdGVcIjoge1xuICAgICAgYWNjZXNzOiBcIndyaXRlXCIsXG4gICAgICBncmFudGVkQnk6IFwicm9sZXNcIixcbiAgICAgIHJlbGF0aW9uczogW10sXG4gICAgICByb2xlczogW1wiYWRtaW5cIl0sXG4gICAgfSxcbiAgfSxcbiAgY2hhbmdlczogW10sXG4gIHB1Ymxpc2hlZDogW10sXG59KTtcblxuLyoqIEEgcGVyaW9kJ3MgY2xhc3NlcyBhcmUgbGlzdGVkIG9uIHRoZSBwZXJpb2QsIHNvIG9ubHkgdGhlIHNjaG9vbCdzIGxlYWRlcnMgbGlzdCB0aGVtLiAqL1xuY29uc3QgcGVyaW9kQ2xhc3NlcyA9IEtpbmQuZXh0ZW5kKHBlcmlvZCwge1xuICBhY3Rpb25zOiB7XG4gICAgXCJjbGFzcy5saXN0XCI6IHtcbiAgICAgIGFjY2VzczogXCJyZWFkXCIsXG4gICAgICBncmFudGVkQnk6IFwicm9sZXNcIixcbiAgICAgIHJlbGF0aW9uczogW10sXG4gICAgICByb2xlczogY2xhc3NSZWFkZXJzLFxuICAgIH0sXG4gIH0sXG4gIGNoYW5nZXM6IFtdLFxuICBwdWJsaXNoZWQ6IFtdLFxufSk7XG5cbi8qKiBUaGUgY2xhc3Nyb29tIG1vZHVsZSdzIGtpbmRzIGZvciB0aGUgYWNjZXNzIGNhdGFsb2c6IHRoZSBjbGFzcywgYW5kIGl0cyBleHRlbnNpb25zIG9uIHRoZSBjb2hvcnQgYW5kIHRoZSBwZXJpb2QuICovXG5leHBvcnQgY29uc3QgY2xhc3Nyb29tID0ge1xuICBleHRlbnNpb25zOiBbY29ob3J0Q2xhc3NlcywgcGVyaW9kQ2xhc3Nlc10sXG4gIGtpbmRzOiBbY2xhc3NLaW5kXSxcbn07XG4iLCAiY29uc3QgX19pbmplY3RlZF9maWxlbmFtZV9fID0gXCIvVXNlcnMvbmFiaWxmYXRpaC9Db2RlL25ha2FmYS13b3JrdHJlZXMvdG9wdXAvcGFja2FnZXMvYmFja2VuZC9jb25mZWN0L2Nvbm5lY3RvcnMva2luZHMudHNcIjtjb25zdCBfX2luamVjdGVkX2Rpcm5hbWVfXyA9IFwiL1VzZXJzL25hYmlsZmF0aWgvQ29kZS9uYWthZmEtd29ya3RyZWVzL3RvcHVwL3BhY2thZ2VzL2JhY2tlbmQvY29uZmVjdC9jb25uZWN0b3JzXCI7Y29uc3QgX19pbmplY3RlZF9pbXBvcnRfbWV0YV91cmxfXyA9IFwiZmlsZTovLy9Vc2Vycy9uYWJpbGZhdGloL0NvZGUvbmFrYWZhLXdvcmt0cmVlcy90b3B1cC9wYWNrYWdlcy9iYWNrZW5kL2NvbmZlY3QvY29ubmVjdG9ycy9raW5kcy50c1wiO2ltcG9ydCB7IElkIH0gZnJvbSBcIkByZXBvL2JhY2tlbmQvY29uZmVjdC9fZ2VuZXJhdGVkL2lkXCI7XG5pbXBvcnQgeyBLaW5kIH0gZnJvbSBcIkByZXBvL2JhY2tlbmQvY29uZmVjdC9hY2Nlc3Mva2luZFwiO1xuaW1wb3J0IHsgQ29ubmVjdG9yS2luZCB9IGZyb20gXCJAcmVwby9iYWNrZW5kL2NvbmZlY3QvY29ubmVjdG9ycy9zY2hlbWFcIjtcbmltcG9ydCB7IHRlbmFudCB9IGZyb20gXCJAcmVwby9iYWNrZW5kL2NvbmZlY3QvdGVuYW5jeS9raW5kc1wiO1xuaW1wb3J0IHsgU2NoZW1hIH0gZnJvbSBcImVmZmVjdFwiO1xuXG4vKipcbiAqIE9uZSBjb25uZWN0aW9uIG9mIGEgc2Nob29sIG9yIGFuIGFjY291bnQuIEEgc2Nob29sIGNvbm5lY3Rpb24gaXMgZGVjaWRlZCBvbiBpdHNcbiAqIHJvdyBmb3IgaXRzIE93bmVyIGFuZCBBZG1pbiAoYGNvbm5lY3RvcnMvYXV0aG9yaXR5YCkuIEVuZGluZyBhIGNvbm5lY3Rpb24gaXMgYVxuICogdHJhbnNpdGlvbiwgc28gYSBzdXNwZW5kZWQgc2Nob29sIGFuZCBhIGxvY2tlZCByb3cgc3RpbGwgbGV0IGl0cyBPd25lciBvciBBZG1pblxuICogZGlzY29ubmVjdCBpdCwgYXMgQURSIDAwMTIgYWxsb3dzLiBJdHMgYXVkaXRlZCBjaGFuZ2VzIGhvbGQgSURzIGFuZCBlbnVtcyBvbmx5LFxuICogc28gYSB0b2tlbiBhbmQgYSBHb29nbGUgYWNjb3VudCBuZXZlciByZWFjaCB0aGUgam91cm5hbC4gQSBwZXJzb25hbCBjb25uZWN0aW9uXG4gKiBpcyBub3QgYSByb3cgb2YgYW55IHNjaG9vbCwgc28gbm8gdGVuYW50IGRlY2lkZXMgaXQ6IGl0cyBvd25lciBjaGVja3MgdGhlIHNpZ25lZC1pblxuICogYWNjb3VudCBpbnN0ZWFkIChgY29ubmVjdG9ycy9jb25uZWN0aW9uYCkuXG4gKi9cbmV4cG9ydCBjb25zdCBjb25uZWN0aW9uID0gS2luZC5tYWtlKFwiY29ubmVjdGlvblwiLCBcImNvbm5lY3RvckNvbm5lY3Rpb25zXCIsIHtcbiAgYWN0aW9uczoge1xuICAgIFwiY29ubmVjdGlvbi5tYW5hZ2VcIjoge1xuICAgICAgYWNjZXNzOiBcInRyYW5zaXRpb25cIixcbiAgICAgIGdyYW50ZWRCeTogXCJyb2xlc1wiLFxuICAgICAgcmVsYXRpb25zOiBbXSxcbiAgICAgIHJvbGVzOiBbXCJhZG1pblwiXSxcbiAgICB9LFxuICAgIFwiY29ubmVjdGlvbi52aWV3XCI6IHtcbiAgICAgIGFjY2VzczogXCJyZWFkXCIsXG4gICAgICBncmFudGVkQnk6IFwicm9sZXNcIixcbiAgICAgIHJlbGF0aW9uczogW10sXG4gICAgICByb2xlczogW1wiYWRtaW5cIl0sXG4gICAgfSxcbiAgfSxcbiAgY2hhbmdlczogW1xuICAgIFNjaGVtYS5TdHJ1Y3Qoe1xuICAgICAgY29ubmVjdGlvbjogSWQoXCJjb25uZWN0b3JDb25uZWN0aW9uc1wiKSxcbiAgICAgIGNvbm5lY3RvcjogQ29ubmVjdG9yS2luZCxcbiAgICAgIHR5cGU6IFNjaGVtYS5MaXRlcmFsKFwiY29ubmVjdGlvbi5jb25uZWN0ZWRcIiksXG4gICAgfSksXG4gICAgU2NoZW1hLlN0cnVjdCh7XG4gICAgICBjb25uZWN0aW9uOiBJZChcImNvbm5lY3RvckNvbm5lY3Rpb25zXCIpLFxuICAgICAgY29ubmVjdG9yOiBDb25uZWN0b3JLaW5kLFxuICAgICAgdHlwZTogU2NoZW1hLkxpdGVyYWwoXCJjb25uZWN0aW9uLmRpc2Nvbm5lY3RlZFwiKSxcbiAgICB9KSxcbiAgICBTY2hlbWEuU3RydWN0KHtcbiAgICAgIGNvbm5lY3Rpb246IElkKFwiY29ubmVjdG9yQ29ubmVjdGlvbnNcIiksXG4gICAgICBjb25uZWN0b3I6IENvbm5lY3RvcktpbmQsXG4gICAgICB0eXBlOiBTY2hlbWEuTGl0ZXJhbChcImNvbm5lY3Rpb24ucmVjb25uZWN0XCIpLFxuICAgIH0pLFxuICBdLFxuICBwdWJsaXNoZWQ6IFtdLFxuICByZWxhdGlvbnM6IFtdLFxufSk7XG5cbi8qKiBBIHNjaG9vbCdzIGNvbm5lY3Rpb25zIGFyZSBsaXN0ZWQgb24gaXRzIHRlbmFudCwgZm9yIGl0cyBPd25lciBhbmQgQWRtaW4uICovXG5jb25zdCB0ZW5hbnRDb25uZWN0aW9ucyA9IEtpbmQuZXh0ZW5kKHRlbmFudCwge1xuICBhY3Rpb25zOiB7XG4gICAgXCJjb25uZWN0aW9uLnZpZXdcIjoge1xuICAgICAgYWNjZXNzOiBcInJlYWRcIixcbiAgICAgIGdyYW50ZWRCeTogXCJyb2xlc1wiLFxuICAgICAgcmVsYXRpb25zOiBbXSxcbiAgICAgIHJvbGVzOiBbXCJhZG1pblwiXSxcbiAgICB9LFxuICB9LFxuICBjaGFuZ2VzOiBbXSxcbiAgcHVibGlzaGVkOiBbXSxcbn0pO1xuXG4vKipcbiAqIFRoZSBjb25uZWN0b3JzIG1vZHVsZSdzIGtpbmRzIGZvciB0aGUgYWNjZXNzIGNhdGFsb2c6IHRoZSBjb25uZWN0aW9uLCBhbmQgaXRzXG4gKiBleHRlbnNpb24gb2YgdGhlIHRlbmFudC5cbiAqL1xuZXhwb3J0IGNvbnN0IGNvbm5lY3RvcnMgPSB7XG4gIGV4dGVuc2lvbnM6IFt0ZW5hbnRDb25uZWN0aW9uc10sXG4gIGtpbmRzOiBbY29ubmVjdGlvbl0sXG59O1xuIiwgImNvbnN0IF9faW5qZWN0ZWRfZmlsZW5hbWVfXyA9IFwiL1VzZXJzL25hYmlsZmF0aWgvQ29kZS9uYWthZmEtd29ya3RyZWVzL3RvcHVwL3BhY2thZ2VzL2JhY2tlbmQvY29uZmVjdC9leGFtcy9yZXN1bHRzL2tpbmRzLnRzXCI7Y29uc3QgX19pbmplY3RlZF9kaXJuYW1lX18gPSBcIi9Vc2Vycy9uYWJpbGZhdGloL0NvZGUvbmFrYWZhLXdvcmt0cmVlcy90b3B1cC9wYWNrYWdlcy9iYWNrZW5kL2NvbmZlY3QvZXhhbXMvcmVzdWx0c1wiO2NvbnN0IF9faW5qZWN0ZWRfaW1wb3J0X21ldGFfdXJsX18gPSBcImZpbGU6Ly8vVXNlcnMvbmFiaWxmYXRpaC9Db2RlL25ha2FmYS13b3JrdHJlZXMvdG9wdXAvcGFja2FnZXMvYmFja2VuZC9jb25mZWN0L2V4YW1zL3Jlc3VsdHMva2luZHMudHNcIjtpbXBvcnQgeyBLaW5kIH0gZnJvbSBcIkByZXBvL2JhY2tlbmQvY29uZmVjdC9hY2Nlc3Mva2luZFwiO1xuaW1wb3J0IHR5cGUgeyBSdWxlUm9sZSB9IGZyb20gXCJAcmVwby9iYWNrZW5kL2NvbmZlY3QvYWNjZXNzL3NjaGVtYVwiO1xuaW1wb3J0IHsgU2NoZW1hIH0gZnJvbSBcImVmZmVjdFwiO1xuXG4vKipcbiAqIFRoZSBzY2hvb2wgcm9sZXMgdGhhdCByZWFkIGEgc2l0dGluZydzIHJlc3VsdHM6IGl0cyBBZG1pbiwgaXRzIHRlYWNoZXIsIGFuZCBpdHMgcHJpbmNpcGFsICh0aGUgZXhhbSdzXG4gKiBhdXRob3IgYW5kIHRoZSBPd25lciByZWFkIHRoZW0gdG9vKS4gQW4gQWRtaW4gcmVhZHMgdGhlIHJlc3VsdHMgdGhhdCBhbiBBZG1pbiByZWxlYXNlcy5cbiAqL1xuY29uc3QgcmVzdWx0Vmlld2VyczogKHR5cGVvZiBSdWxlUm9sZS5UeXBlKVtdID0gW1xuICBcImFkbWluXCIsXG4gIFwidGVhY2hlclwiLFxuICBcInByaW5jaXBhbFwiLFxuXTtcblxuLyoqIFRoZSBzY2hvb2wgcm9sZXMgdGhhdCByZWxlYXNlIGEgc2l0dGluZydzIHJlc3VsdHM6IHRoZSBzY2hvb2wncyBBZG1pbiAodGhlIGV4YW0ncyBhdXRob3IgYW5kIHRoZSBPd25lciByZWxlYXNlIHRoZW0gdG9vKS4gKi9cbmNvbnN0IHJlc3VsdFJlbGVhc2VyczogKHR5cGVvZiBSdWxlUm9sZS5UeXBlKVtdID0gW1wiYWRtaW5cIl07XG5cbi8qKlxuICogVGhlIHJlc3VsdHMgb2Ygb25lIHNpdHRpbmcsIHdpdGggdGhlIHNpdHRpbmcgcm93IGFzIGl0cyBzdWJqZWN0LiBBIHJlc3VsdCBpcyBub3QgYSB3cml0ZSB0byB0aGVcbiAqIGNsb3NlZCBzaXR0aW5nLCBiZWNhdXNlIHJlbGVhc2luZyBmb2xsb3dzIHRoZSBjbG9zZTogb25seSBhIHN1c3BlbmRlZCBzY2hvb2wgYW5kIGFuIGFyY2hpdmVkIHVuaXRcbiAqIHJlZnVzZSB0aGUgcmVsZWFzZSAoQURSIDAwMTIsIGRlY2lzaW9uIDMpLiBUaGUgcmVsZWFzZSBpcyBqb3VybmFsZWQgb24gdGhlIHNpdHRpbmcuXG4gKi9cbmV4cG9ydCBjb25zdCByZXN1bHRLaW5kID0gS2luZC5tYWtlKFwicmVzdWx0XCIsIFwiZXhhbVNpdHRpbmdzXCIsIHtcbiAgYWN0aW9uczoge1xuICAgIFwicmVzdWx0LnJlbGVhc2VcIjoge1xuICAgICAgYWNjZXNzOiBcIndyaXRlXCIsXG4gICAgICBncmFudGVkQnk6IFwicm9sZXNcIixcbiAgICAgIHJlbGF0aW9uczogW1wiZXhhbUF1dGhvclwiXSxcbiAgICAgIHJvbGVzOiByZXN1bHRSZWxlYXNlcnMsXG4gICAgfSxcbiAgICBcInJlc3VsdC52aWV3XCI6IHtcbiAgICAgIGFjY2VzczogXCJyZWFkXCIsXG4gICAgICBncmFudGVkQnk6IFwicm9sZXNcIixcbiAgICAgIHJlbGF0aW9uczogW1wiZXhhbUF1dGhvclwiXSxcbiAgICAgIHJvbGVzOiByZXN1bHRWaWV3ZXJzLFxuICAgIH0sXG4gIH0sXG4gIGNoYW5nZXM6IFtTY2hlbWEuU3RydWN0KHsgdHlwZTogU2NoZW1hLkxpdGVyYWwoXCJleGFtLnJlc3VsdHMucmVsZWFzZWRcIikgfSldLFxuICBwdWJsaXNoZWQ6IFtdLFxuICByZWxhdGlvbnM6IFtcImV4YW1BdXRob3JcIl0sXG59KTtcblxuLyoqIFRoZSByZXN1bHRzIG1vZHVsZSdzIGtpbmRzIGZvciB0aGUgYWNjZXNzIGNhdGFsb2cuICovXG5leHBvcnQgY29uc3QgcmVzdWx0cyA9IHsgZXh0ZW5zaW9uczogW10sIGtpbmRzOiBbcmVzdWx0S2luZF0gfTtcbiIsICJjb25zdCBfX2luamVjdGVkX2ZpbGVuYW1lX18gPSBcIi9Vc2Vycy9uYWJpbGZhdGloL0NvZGUvbmFrYWZhLXdvcmt0cmVlcy90b3B1cC9wYWNrYWdlcy9iYWNrZW5kL2NvbmZlY3QvZXhhbXMvc2l0dGluZ3Mva2luZHMudHNcIjtjb25zdCBfX2luamVjdGVkX2Rpcm5hbWVfXyA9IFwiL1VzZXJzL25hYmlsZmF0aWgvQ29kZS9uYWthZmEtd29ya3RyZWVzL3RvcHVwL3BhY2thZ2VzL2JhY2tlbmQvY29uZmVjdC9leGFtcy9zaXR0aW5nc1wiO2NvbnN0IF9faW5qZWN0ZWRfaW1wb3J0X21ldGFfdXJsX18gPSBcImZpbGU6Ly8vVXNlcnMvbmFiaWxmYXRpaC9Db2RlL25ha2FmYS13b3JrdHJlZXMvdG9wdXAvcGFja2FnZXMvYmFja2VuZC9jb25mZWN0L2V4YW1zL3NpdHRpbmdzL2tpbmRzLnRzXCI7aW1wb3J0IHsgSWQgfSBmcm9tIFwiQHJlcG8vYmFja2VuZC9jb25mZWN0L19nZW5lcmF0ZWQvaWRcIjtcbmltcG9ydCB7IEtpbmQgfSBmcm9tIFwiQHJlcG8vYmFja2VuZC9jb25mZWN0L2FjY2Vzcy9raW5kXCI7XG5pbXBvcnQgdHlwZSB7IFJ1bGVSb2xlIH0gZnJvbSBcIkByZXBvL2JhY2tlbmQvY29uZmVjdC9hY2Nlc3Mvc2NoZW1hXCI7XG5pbXBvcnQge1xuICBNaW51dGVzLFxuICBSZWFzb25Db2RlLFxufSBmcm9tIFwiQHJlcG8vYmFja2VuZC9jb25mZWN0L2V4YW1zL3NpdHRpbmdzL3NjaGVtYVwiO1xuaW1wb3J0IHsgU2NoZW1hIH0gZnJvbSBcImVmZmVjdFwiO1xuXG4vKiogVGhlIHNjaG9vbCByb2xlcyB0aGF0IHByb2N0b3IgYSBzaXR0aW5nOiBpdHMgdGVhY2hlciBhbmQgdGhlIHNjaG9vbCdzIEFkbWluLiBUaGUgT3duZXIgaXMgaW1wbGljaXQuICovXG5jb25zdCBzaXR0aW5nUHJvY3RvcnM6ICh0eXBlb2YgUnVsZVJvbGUuVHlwZSlbXSA9IFtcInRlYWNoZXJcIiwgXCJhZG1pblwiXTtcblxuLyoqIFRoZSByb2xlcyB0aGF0IHZpZXcgYSBzaXR0aW5nJ3MgZGFzaGJvYXJkOiB0aGUgcHJvY3RvcnMsIGFuZCB0aGUgUHJpbmNpcGFsIGFuZCB0aGUgRGVwdXR5LCB3aG8gdGFrZSBubyBhY3Rpb24uICovXG5jb25zdCBzaXR0aW5nVmlld2VyczogKHR5cGVvZiBSdWxlUm9sZS5UeXBlKVtdID0gW1xuICBcInRlYWNoZXJcIixcbiAgXCJhZG1pblwiLFxuICBcInByaW5jaXBhbFwiLFxuICBcImRlcHV0eVwiLFxuXTtcblxuLyoqXG4gKiBPbmUgcHJvY3RvcmVkIHNpdHRpbmcuIEEgdGVhY2hlciBvciBhbiBBZG1pbiB3aG9zZSBncmFudCBjb3ZlcnMgaXRzIHVuaXQsIGV2ZXJ5IE93bmVyLFxuICogYW5kIHRoZSBhdXRob3Igb2YgaXRzIGV4YW0gbWF5IHByb2N0b3IgaXQsIHdoaWNoIGlzIHRoZSBgc2l0dGluZy5wcm9jdG9yYCBhY3Rpb24uIFRoZVxuICogc2FtZSBwZW9wbGUsIHdpdGggdGhlIFByaW5jaXBhbCBhbmQgdGhlIERlcHV0eSwgbWF5IHZpZXcgaXQsIHdoaWNoIGlzIGBzaXR0aW5nLnZpZXdgLlxuICogVGhlIHNlc3Npb24gcHJvY3RvciByZWxhdGlvbiBjb21lcyBsYXRlciAoQURSIDAwMTMpLiBBIHNpdHRpbmcgaW4gYSBjbG9zZWQgc3RhdGUgb3IgYW5cbiAqIGFyY2hpdmVkIHVuaXQgbG9ja3MgaXRzIHdyaXRlcy5cbiAqL1xuZXhwb3J0IGNvbnN0IHNpdHRpbmdLaW5kID0gS2luZC5tYWtlKFwic2l0dGluZ1wiLCBcImV4YW1TaXR0aW5nc1wiLCB7XG4gIGFjdGlvbnM6IHtcbiAgICBcInNpdHRpbmcucHJvY3RvclwiOiB7XG4gICAgICBhY2Nlc3M6IFwid3JpdGVcIixcbiAgICAgIGdyYW50ZWRCeTogXCJyb2xlc1wiLFxuICAgICAgcmVsYXRpb25zOiBbXCJleGFtQXV0aG9yXCJdLFxuICAgICAgcm9sZXM6IHNpdHRpbmdQcm9jdG9ycyxcbiAgICB9LFxuICAgIFwic2l0dGluZy52aWV3XCI6IHtcbiAgICAgIGFjY2VzczogXCJyZWFkXCIsXG4gICAgICBncmFudGVkQnk6IFwicm9sZXNcIixcbiAgICAgIHJlbGF0aW9uczogW1wiZXhhbUF1dGhvclwiXSxcbiAgICAgIHJvbGVzOiBzaXR0aW5nVmlld2VycyxcbiAgICB9LFxuICB9LFxuICBjaGFuZ2VzOiBbXG4gICAgU2NoZW1hLlN0cnVjdCh7IHR5cGU6IFNjaGVtYS5MaXRlcmFsKFwic2l0dGluZy5zY2hlZHVsZVwiKSB9KSxcbiAgICBTY2hlbWEuU3RydWN0KHtcbiAgICAgIGF0dGVtcHQ6IElkKFwiZXhhbUF0dGVtcHRzXCIpLFxuICAgICAgcmVhc29uOiBSZWFzb25Db2RlLFxuICAgICAgdHlwZTogU2NoZW1hLkxpdGVyYWwoXCJzaXR0aW5nLmxvY2tcIiksXG4gICAgfSksXG4gICAgU2NoZW1hLlN0cnVjdCh7XG4gICAgICBhdHRlbXB0OiBJZChcImV4YW1BdHRlbXB0c1wiKSxcbiAgICAgIHJlYXNvbjogUmVhc29uQ29kZSxcbiAgICAgIHR5cGU6IFNjaGVtYS5MaXRlcmFsKFwic2l0dGluZy51bmxvY2tcIiksXG4gICAgfSksXG4gICAgU2NoZW1hLlN0cnVjdCh7XG4gICAgICBhdHRlbXB0OiBJZChcImV4YW1BdHRlbXB0c1wiKSxcbiAgICAgIG1pbnV0ZXM6IE1pbnV0ZXMsXG4gICAgICByZWFzb246IFJlYXNvbkNvZGUsXG4gICAgICB0eXBlOiBTY2hlbWEuTGl0ZXJhbChcInNpdHRpbmcuYWRkTWludXRlc1wiKSxcbiAgICB9KSxcbiAgICBTY2hlbWEuU3RydWN0KHsgdHlwZTogU2NoZW1hLkxpdGVyYWwoXCJzaXR0aW5nLmNoYW5nZVRva2VuXCIpIH0pLFxuICAgIFNjaGVtYS5TdHJ1Y3Qoe1xuICAgICAgYXR0ZW1wdDogSWQoXCJleGFtQXR0ZW1wdHNcIiksXG4gICAgICB0eXBlOiBTY2hlbWEuTGl0ZXJhbChcInNpdHRpbmcuYWxsb3dEZXZpY2VcIiksXG4gICAgfSksXG4gICAgU2NoZW1hLlN0cnVjdCh7XG4gICAgICBhdHRlbXB0OiBJZChcImV4YW1BdHRlbXB0c1wiKSxcbiAgICAgIHR5cGU6IFNjaGVtYS5MaXRlcmFsKFwic2l0dGluZy5maW5pc2hcIiksXG4gICAgfSksXG4gICAgU2NoZW1hLlN0cnVjdCh7IHR5cGU6IFNjaGVtYS5MaXRlcmFsKFwic2l0dGluZy5jbG9zZVwiKSB9KSxcbiAgICBTY2hlbWEuU3RydWN0KHsgdHlwZTogU2NoZW1hLkxpdGVyYWwoXCJzaXR0aW5nLmNhbmNlbFwiKSB9KSxcbiAgXSxcbiAgcHVibGlzaGVkOiBbXSxcbiAgcmVsYXRpb25zOiBbXCJleGFtQXV0aG9yXCJdLFxufSk7XG5cbi8qKiBUaGUgc2l0dGluZyBsYW5lJ3Mga2luZHMgYW5kIGV4dGVuc2lvbnMsIGpvaW5lZCBpbnRvIHRoZSBhY2Nlc3MgY2F0YWxvZy4gKi9cbmV4cG9ydCBjb25zdCBzaXR0aW5nID0geyBleHRlbnNpb25zOiBbXSwga2luZHM6IFtzaXR0aW5nS2luZF0gfTtcbiIsICJjb25zdCBfX2luamVjdGVkX2ZpbGVuYW1lX18gPSBcIi9Vc2Vycy9uYWJpbGZhdGloL0NvZGUvbmFrYWZhLXdvcmt0cmVlcy90b3B1cC9wYWNrYWdlcy9iYWNrZW5kL2NvbmZlY3QvaW50ZWdyYXRpb25zL2tpbmRzLnRzXCI7Y29uc3QgX19pbmplY3RlZF9kaXJuYW1lX18gPSBcIi9Vc2Vycy9uYWJpbGZhdGloL0NvZGUvbmFrYWZhLXdvcmt0cmVlcy90b3B1cC9wYWNrYWdlcy9iYWNrZW5kL2NvbmZlY3QvaW50ZWdyYXRpb25zXCI7Y29uc3QgX19pbmplY3RlZF9pbXBvcnRfbWV0YV91cmxfXyA9IFwiZmlsZTovLy9Vc2Vycy9uYWJpbGZhdGloL0NvZGUvbmFrYWZhLXdvcmt0cmVlcy90b3B1cC9wYWNrYWdlcy9iYWNrZW5kL2NvbmZlY3QvaW50ZWdyYXRpb25zL2tpbmRzLnRzXCI7aW1wb3J0IHsgSWQgfSBmcm9tIFwiQHJlcG8vYmFja2VuZC9jb25mZWN0L19nZW5lcmF0ZWQvaWRcIjtcbmltcG9ydCB7IEtpbmQgfSBmcm9tIFwiQHJlcG8vYmFja2VuZC9jb25mZWN0L2FjY2Vzcy9raW5kXCI7XG5pbXBvcnQgeyBHcmFudFNjb3BlIH0gZnJvbSBcIkByZXBvL2JhY2tlbmQvY29uZmVjdC9hY2Nlc3Mvc2NoZW1hXCI7XG5pbXBvcnQgeyB0ZW5hbnQsIHVuaXQgfSBmcm9tIFwiQHJlcG8vYmFja2VuZC9jb25mZWN0L3RlbmFuY3kva2luZHNcIjtcbmltcG9ydCB7IFNjaGVtYSB9IGZyb20gXCJlZmZlY3RcIjtcblxuLyoqXG4gKiBPbmUgaW50ZWdyYXRpb24gY2xpZW50IG9mIGEgc2Nob29sOiBhbiBhcHAgb3IgYSBzeXN0ZW0gdGhhdCBjYWxscyB0aGUgc2Nob29sXG4gKiBBUEkgd2l0aCBpdHMgb3duIGNyZWRlbnRpYWwuIE93bmVycyBhbmQgQWRtaW5zIG1hbmFnZSBpdC4gSXRzIGF1ZGl0ZWQgY2hhbmdlc1xuICogaG9sZCBJRHMgYW5kIGVudW1zIG9ubHksIHNvIGEgY2xpZW50J3MgbmFtZSBuZXZlciByZWFjaGVzIHRoZSBqb3VybmFsLlxuICovXG5leHBvcnQgY29uc3QgaW50ZWdyYXRpb24gPSBLaW5kLm1ha2UoXCJpbnRlZ3JhdGlvblwiLCBcImludGVncmF0aW9uQ2xpZW50c1wiLCB7XG4gIGFjdGlvbnM6IHtcbiAgICBcImludGVncmF0aW9uLm1hbmFnZVwiOiB7XG4gICAgICBhY2Nlc3M6IFwid3JpdGVcIixcbiAgICAgIGdyYW50ZWRCeTogXCJyb2xlc1wiLFxuICAgICAgcmVsYXRpb25zOiBbXSxcbiAgICAgIHJvbGVzOiBbXCJhZG1pblwiXSxcbiAgICB9LFxuICAgIFwiaW50ZWdyYXRpb24udmlld1wiOiB7XG4gICAgICBhY2Nlc3M6IFwicmVhZFwiLFxuICAgICAgZ3JhbnRlZEJ5OiBcInJvbGVzXCIsXG4gICAgICByZWxhdGlvbnM6IFtdLFxuICAgICAgcm9sZXM6IFtcImFkbWluXCJdLFxuICAgIH0sXG4gIH0sXG4gIGNoYW5nZXM6IFtcbiAgICBTY2hlbWEuU3RydWN0KHtcbiAgICAgIGNsaWVudDogSWQoXCJpbnRlZ3JhdGlvbkNsaWVudHNcIiksXG4gICAgICBzY29wZTogR3JhbnRTY29wZSxcbiAgICAgIHR5cGU6IFNjaGVtYS5MaXRlcmFsKFwiaW50ZWdyYXRpb24uY3JlYXRlZFwiKSxcbiAgICB9KSxcbiAgICBTY2hlbWEuU3RydWN0KHtcbiAgICAgIGNsaWVudDogSWQoXCJpbnRlZ3JhdGlvbkNsaWVudHNcIiksXG4gICAgICB0eXBlOiBTY2hlbWEuTGl0ZXJhbChcImludGVncmF0aW9uLnJvdGF0ZWRcIiksXG4gICAgfSksXG4gICAgU2NoZW1hLlN0cnVjdCh7XG4gICAgICBjbGllbnQ6IElkKFwiaW50ZWdyYXRpb25DbGllbnRzXCIpLFxuICAgICAgdHlwZTogU2NoZW1hLkxpdGVyYWwoXCJpbnRlZ3JhdGlvbi5yZXZva2VkXCIpLFxuICAgIH0pLFxuICBdLFxuICBwdWJsaXNoZWQ6IFtdLFxuICByZWxhdGlvbnM6IFtdLFxufSk7XG5cbi8qKlxuICogQ3JlYXRpbmcgYSBjbGllbnQgaXMgZGVjaWRlZCBvbiB0aGUgc2NvcGUgaXQgY292ZXJzLCBhcyBhIGdyYW50IGlzOiB0aGVcbiAqIHRlbmFudCBmb3IgYSB0ZW5hbnQtd2lkZSBjbGllbnQsIHRoZSB1bml0IGZvciBhIHVuaXQgY2xpZW50LlxuICovXG5jb25zdCB0ZW5hbnRJbnRlZ3JhdGlvbnMgPSBLaW5kLmV4dGVuZCh0ZW5hbnQsIHtcbiAgYWN0aW9uczoge1xuICAgIFwiaW50ZWdyYXRpb24ubWFuYWdlXCI6IHtcbiAgICAgIGFjY2VzczogXCJ3cml0ZVwiLFxuICAgICAgZ3JhbnRlZEJ5OiBcInJvbGVzXCIsXG4gICAgICByZWxhdGlvbnM6IFtdLFxuICAgICAgcm9sZXM6IFtcImFkbWluXCJdLFxuICAgIH0sXG4gICAgXCJpbnRlZ3JhdGlvbi52aWV3XCI6IHtcbiAgICAgIGFjY2VzczogXCJyZWFkXCIsXG4gICAgICBncmFudGVkQnk6IFwicm9sZXNcIixcbiAgICAgIHJlbGF0aW9uczogW10sXG4gICAgICByb2xlczogW1wiYWRtaW5cIl0sXG4gICAgfSxcbiAgfSxcbiAgY2hhbmdlczogW10sXG4gIHB1Ymxpc2hlZDogW10sXG59KTtcblxuY29uc3QgdW5pdEludGVncmF0aW9ucyA9IEtpbmQuZXh0ZW5kKHVuaXQsIHtcbiAgYWN0aW9uczoge1xuICAgIFwiaW50ZWdyYXRpb24ubWFuYWdlXCI6IHtcbiAgICAgIGFjY2VzczogXCJ3cml0ZVwiLFxuICAgICAgZ3JhbnRlZEJ5OiBcInJvbGVzXCIsXG4gICAgICByZWxhdGlvbnM6IFtdLFxuICAgICAgcm9sZXM6IFtcImFkbWluXCJdLFxuICAgIH0sXG4gIH0sXG4gIGNoYW5nZXM6IFtdLFxuICBwdWJsaXNoZWQ6IFtdLFxufSk7XG5cbi8qKlxuICogVGhlIGludGVncmF0aW9uIG1vZHVsZSdzIGtpbmRzIGZvciB0aGUgYWNjZXNzIGNhdGFsb2c6IHRoZSBjbGllbnQsIGFuZCBpdHNcbiAqIGV4dGVuc2lvbnMgb24gdGhlIHRlbmFudCBhbmQgdGhlIHVuaXQuXG4gKi9cbmV4cG9ydCBjb25zdCBpbnRlZ3JhdGlvbnMgPSB7XG4gIGV4dGVuc2lvbnM6IFt0ZW5hbnRJbnRlZ3JhdGlvbnMsIHVuaXRJbnRlZ3JhdGlvbnNdLFxuICBraW5kczogW2ludGVncmF0aW9uXSxcbn07XG4iLCAiY29uc3QgX19pbmplY3RlZF9maWxlbmFtZV9fID0gXCIvVXNlcnMvbmFiaWxmYXRpaC9Db2RlL25ha2FmYS13b3JrdHJlZXMvdG9wdXAvcGFja2FnZXMvYmFja2VuZC9jb25mZWN0L29wZXJhdG9ycy9raW5kcy50c1wiO2NvbnN0IF9faW5qZWN0ZWRfZGlybmFtZV9fID0gXCIvVXNlcnMvbmFiaWxmYXRpaC9Db2RlL25ha2FmYS13b3JrdHJlZXMvdG9wdXAvcGFja2FnZXMvYmFja2VuZC9jb25mZWN0L29wZXJhdG9yc1wiO2NvbnN0IF9faW5qZWN0ZWRfaW1wb3J0X21ldGFfdXJsX18gPSBcImZpbGU6Ly8vVXNlcnMvbmFiaWxmYXRpaC9Db2RlL25ha2FmYS13b3JrdHJlZXMvdG9wdXAvcGFja2FnZXMvYmFja2VuZC9jb25mZWN0L29wZXJhdG9ycy9raW5kcy50c1wiO2ltcG9ydCB7IElkIH0gZnJvbSBcIkByZXBvL2JhY2tlbmQvY29uZmVjdC9fZ2VuZXJhdGVkL2lkXCI7XG5pbXBvcnQgeyBLaW5kIH0gZnJvbSBcIkByZXBvL2JhY2tlbmQvY29uZmVjdC9hY2Nlc3Mva2luZFwiO1xuaW1wb3J0IHtcbiAgVmlzaXRFbmRSZWFzb24sXG4gIFZpc2l0TWludXRlcyxcbiAgVmlzaXRSZWFzb24sXG59IGZyb20gXCJAcmVwby9iYWNrZW5kL2NvbmZlY3Qvb3BlcmF0b3JzL3NjaGVtYVwiO1xuaW1wb3J0IHsgcGVyc29uLCB0ZW5hbnQgfSBmcm9tIFwiQHJlcG8vYmFja2VuZC9jb25mZWN0L3RlbmFuY3kva2luZHNcIjtcbmltcG9ydCB7IFNjaGVtYSB9IGZyb20gXCJlZmZlY3RcIjtcblxuLyoqXG4gKiBPbmUgdmlzaXQgb2YgYW4gb3BlcmF0b3IgdG8gYSBzY2hvb2wuIFRoZSBzY2hvb2wncyBPd25lciBvciBBZG1pbiBlbmRzIGl0LCBhbmRcbiAqIHNvIGRvZXMgdGhlIG9wZXJhdG9yLCB3aG8gaXMgaXRzIHZpc2l0b3IuIEVuZGluZyBpcyBhIHRyYW5zaXRpb24sIHNvIGEgc2Nob29sXG4gKiB0aGF0IGlzIHN1c3BlbmRlZCBjYW4gc3RpbGwgZW5kIGEgdmlzaXQgKEFEUiAwMDEyKS5cbiAqL1xuZXhwb3J0IGNvbnN0IHZpc2l0ID0gS2luZC5tYWtlKFwidmlzaXRcIiwgXCJ0ZW5hbnRWaXNpdHNcIiwge1xuICBhY3Rpb25zOiB7XG4gICAgXCJ2aXNpdC5lbmRcIjoge1xuICAgICAgYWNjZXNzOiBcInRyYW5zaXRpb25cIixcbiAgICAgIGdyYW50ZWRCeTogXCJyb2xlc1wiLFxuICAgICAgcmVsYXRpb25zOiBbXCJ2aXNpdG9yXCJdLFxuICAgICAgcm9sZXM6IFtcImFkbWluXCJdLFxuICAgIH0sXG4gIH0sXG4gIGNoYW5nZXM6IFtcbiAgICBTY2hlbWEuU3RydWN0KHtcbiAgICAgIG1pbnV0ZXM6IFZpc2l0TWludXRlcyxcbiAgICAgIHJlYXNvbjogVmlzaXRSZWFzb24sXG4gICAgICB0eXBlOiBTY2hlbWEuTGl0ZXJhbChcInZpc2l0LnJlcXVlc3RlZFwiKSxcbiAgICB9KSxcbiAgICBTY2hlbWEuU3RydWN0KHtcbiAgICAgIGdyYW50OiBJZChcInRlbmFudEdyYW50c1wiKSxcbiAgICAgIHBlcnNvbjogSWQoXCJ0ZW5hbnRQZW9wbGVcIiksXG4gICAgICB0eXBlOiBTY2hlbWEuTGl0ZXJhbChcInZpc2l0LmFwcHJvdmVkXCIpLFxuICAgIH0pLFxuICAgIFNjaGVtYS5TdHJ1Y3QoeyB0eXBlOiBTY2hlbWEuTGl0ZXJhbChcInZpc2l0LmRlY2xpbmVkXCIpIH0pLFxuICAgIFNjaGVtYS5TdHJ1Y3Qoe1xuICAgICAgcmVhc29uOiBWaXNpdEVuZFJlYXNvbixcbiAgICAgIHR5cGU6IFNjaGVtYS5MaXRlcmFsKFwidmlzaXQuZW5kZWRcIiksXG4gICAgfSksXG4gIF0sXG4gIHB1Ymxpc2hlZDogW10sXG4gIHJlbGF0aW9uczogW1widmlzaXRvclwiXSxcbn0pO1xuXG4vKipcbiAqIFRoZSBzY2hvb2wncyBPd25lciBhbmQgQWRtaW4gZGVjaWRlIHdoZXRoZXIgYW4gb3BlcmF0b3IgbWF5IHZpc2l0LCBhbmQgdGhlXG4gKiB0ZW5hbnQgY2hhbmdlcyBhbiBvcGVyYXRvciBtYWtlczogc3VzcGVuZGluZyBhbmQgcmVhY3RpdmF0aW5nIGEgc2Nob29sLlxuICovXG5jb25zdCB0ZW5hbnRPcGVyYXRvcnMgPSBLaW5kLmV4dGVuZCh0ZW5hbnQsIHtcbiAgYWN0aW9uczoge1xuICAgIFwidmlzaXQuYXBwcm92ZVwiOiB7XG4gICAgICBhY2Nlc3M6IFwid3JpdGVcIixcbiAgICAgIGdyYW50ZWRCeTogXCJyb2xlc1wiLFxuICAgICAgcmVsYXRpb25zOiBbXSxcbiAgICAgIHJvbGVzOiBbXCJhZG1pblwiXSxcbiAgICB9LFxuICB9LFxuICBjaGFuZ2VzOiBbXG4gICAgU2NoZW1hLlN0cnVjdCh7IHR5cGU6IFNjaGVtYS5MaXRlcmFsKFwidGVuYW50LnN1c3BlbmRlZFwiKSB9KSxcbiAgICBTY2hlbWEuU3RydWN0KHsgdHlwZTogU2NoZW1hLkxpdGVyYWwoXCJ0ZW5hbnQucmVhY3RpdmF0ZWRcIikgfSksXG4gIF0sXG4gIHB1Ymxpc2hlZDogW10sXG59KTtcblxuLyoqIEFuIG9wZXJhdG9yJ3MgUGVyc29uIGlzIHN1c3BlbmRlZCBiZXR3ZWVuIHZpc2l0cyBhbmQgcmVhY3RpdmF0ZWQgZm9yIHRoZSBuZXh0IG9uZS4gKi9cbmNvbnN0IHBlcnNvbk9wZXJhdG9ycyA9IEtpbmQuZXh0ZW5kKHBlcnNvbiwge1xuICBhY3Rpb25zOiB7fSxcbiAgY2hhbmdlczogW1xuICAgIFNjaGVtYS5TdHJ1Y3QoeyB0eXBlOiBTY2hlbWEuTGl0ZXJhbChcInBlcnNvbi5yZWFjdGl2YXRlZFwiKSB9KSxcbiAgICBTY2hlbWEuU3RydWN0KHsgdHlwZTogU2NoZW1hLkxpdGVyYWwoXCJwZXJzb24uc3VzcGVuZGVkXCIpIH0pLFxuICBdLFxuICBwdWJsaXNoZWQ6IFtdLFxufSk7XG5cbi8qKiBUaGUgb3BlcmF0b3IgbGFuZSdzIGtpbmRzIGFuZCBpdHMgZXh0ZW5zaW9ucyBvZiB0aGUgdGVuYW50IGFuZCBwZXJzb24ga2luZHMsIGZvciB0aGUgY2F0YWxvZy4gKi9cbmV4cG9ydCBjb25zdCBvcGVyYXRvcnMgPSB7XG4gIGV4dGVuc2lvbnM6IFt0ZW5hbnRPcGVyYXRvcnMsIHBlcnNvbk9wZXJhdG9yc10sXG4gIGtpbmRzOiBbdmlzaXRdLFxufTtcbiIsICJjb25zdCBfX2luamVjdGVkX2ZpbGVuYW1lX18gPSBcIi9Vc2Vycy9uYWJpbGZhdGloL0NvZGUvbmFrYWZhLXdvcmt0cmVlcy90b3B1cC9wYWNrYWdlcy9iYWNrZW5kL2NvbmZlY3QvcmVjb3Jkcy9raW5kcy50c1wiO2NvbnN0IF9faW5qZWN0ZWRfZGlybmFtZV9fID0gXCIvVXNlcnMvbmFiaWxmYXRpaC9Db2RlL25ha2FmYS13b3JrdHJlZXMvdG9wdXAvcGFja2FnZXMvYmFja2VuZC9jb25mZWN0L3JlY29yZHNcIjtjb25zdCBfX2luamVjdGVkX2ltcG9ydF9tZXRhX3VybF9fID0gXCJmaWxlOi8vL1VzZXJzL25hYmlsZmF0aWgvQ29kZS9uYWthZmEtd29ya3RyZWVzL3RvcHVwL3BhY2thZ2VzL2JhY2tlbmQvY29uZmVjdC9yZWNvcmRzL2tpbmRzLnRzXCI7aW1wb3J0IHsgSWQgfSBmcm9tIFwiQHJlcG8vYmFja2VuZC9jb25mZWN0L19nZW5lcmF0ZWQvaWRcIjtcbmltcG9ydCB7IEtpbmQgfSBmcm9tIFwiQHJlcG8vYmFja2VuZC9jb25mZWN0L2FjY2Vzcy9raW5kXCI7XG5pbXBvcnQgeyBjbGFzc0tpbmQgfSBmcm9tIFwiQHJlcG8vYmFja2VuZC9jb25mZWN0L2NsYXNzcm9vbS9raW5kc1wiO1xuaW1wb3J0IHsgdGVuYW50IH0gZnJvbSBcIkByZXBvL2JhY2tlbmQvY29uZmVjdC90ZW5hbmN5L2tpbmRzXCI7XG5pbXBvcnQgeyBTY2hlbWEgfSBmcm9tIFwiZWZmZWN0XCI7XG5cbi8qKlxuICogT25lIHN0dWRlbnQncyBmaW5hbCBncmFkZSBpbiBvbmUgY2xhc3MgYW5kIHBlcmlvZC4gVGhlIGNsYXNzJ3Mgc3ViamVjdCB0ZWFjaGVyc1xuICogcmVsZWFzZSBpdCwgYW5kIHRoZSByZWxlYXNlIGlzIGpvdXJuYWxlZCBhcyBgZ3JhZGUucmVsZWFzZWRgLiBUaGV5IHJlYWQgZXZlcnlcbiAqIGdyYWRlIG9mIHRoZSBjbGFzcywgZHJhZnRzIGluY2x1ZGVkLiBBIHN0dWRlbnQgcmVhZHMgb25seSB0aGVpciBvd24gcmVsZWFzZWRcbiAqIGdyYWRlOiB0aGUgY2xhc3MgbWVtYmVyIHJlbGF0aW9uIGhvbGRzIGZvciB0aGF0IHJvdyBhbmQgbm8gb3RoZXIgKEFEUiAwMDMzKS5cbiAqL1xuZXhwb3J0IGNvbnN0IGdyYWRlS2luZCA9IEtpbmQubWFrZShcImdyYWRlXCIsIFwiY2xhc3NHcmFkZXNcIiwge1xuICBhY3Rpb25zOiB7XG4gICAgXCJncmFkZS5yZWxlYXNlXCI6IHtcbiAgICAgIGFjY2VzczogXCJ3cml0ZVwiLFxuICAgICAgZ3JhbnRlZEJ5OiBcInJlbGF0aW9uc1wiLFxuICAgICAgcmVsYXRpb25zOiBbXCJzdWJqZWN0VGVhY2hlclwiXSxcbiAgICB9LFxuICAgIFwiZ3JhZGUudmlld1wiOiB7XG4gICAgICBhY2Nlc3M6IFwicmVhZFwiLFxuICAgICAgZ3JhbnRlZEJ5OiBcInJlbGF0aW9uc1wiLFxuICAgICAgcmVsYXRpb25zOiBbXCJjbGFzc01lbWJlclwiLCBcInN1YmplY3RUZWFjaGVyXCJdLFxuICAgIH0sXG4gIH0sXG4gIGNoYW5nZXM6IFtcbiAgICBTY2hlbWEuU3RydWN0KHtcbiAgICAgIGNsYXNzSWQ6IElkKFwiY2xhc3Nlc1wiKSxcbiAgICAgIHBlcmlvZElkOiBJZChcInRlbmFudFBlcmlvZHNcIiksXG4gICAgICBwZXJzb25JZDogSWQoXCJ0ZW5hbnRQZW9wbGVcIiksXG4gICAgICBzdGF0ZTogU2NoZW1hLkxpdGVyYWwoXCJyZWxlYXNlZFwiKSxcbiAgICAgIHR5cGU6IFNjaGVtYS5MaXRlcmFsKFwiZ3JhZGUucmVsZWFzZWRcIiksXG4gICAgfSksXG4gIF0sXG4gIHB1Ymxpc2hlZDogW1wiZ3JhZGUucmVsZWFzZWRcIl0sXG4gIHJlbGF0aW9uczogW1wiY2xhc3NNZW1iZXJcIiwgXCJzdWJqZWN0VGVhY2hlclwiXSxcbn0pO1xuXG4vKipcbiAqIEEgc3ViamVjdCB0ZWFjaGVyIGVudGVycyBhIGRyYWZ0IGZvciBhIHN0dWRlbnQgb2YgdGhlIGNsYXNzIGFuZCBsaXN0cyB0aGUgY2xhc3Mnc1xuICogZ3JhZGVzLiBUaGUgYWN0aW9ucyBhcmUgcnVsZWQgb24gdGhlIGNsYXNzLCB0aGUgc3ViamVjdCB0aGF0IGV4aXN0cyBiZWZvcmUgaXRzXG4gKiBmaXJzdCBncmFkZSBkb2VzLCBzbyB0aGUgZW50cnkgaXMgcmVmdXNlZCB3aXRoIHRoZSBjbGFzcydzIG93biByZWZ1c2Fscy5cbiAqL1xuY29uc3QgY2xhc3NHcmFkZXMgPSBLaW5kLmV4dGVuZChjbGFzc0tpbmQsIHtcbiAgYWN0aW9uczoge1xuICAgIFwiZ3JhZGUuZW50ZXJcIjoge1xuICAgICAgYWNjZXNzOiBcIndyaXRlXCIsXG4gICAgICBncmFudGVkQnk6IFwicmVsYXRpb25zXCIsXG4gICAgICByZWxhdGlvbnM6IFtcInN1YmplY3RUZWFjaGVyXCJdLFxuICAgIH0sXG4gICAgXCJncmFkZS5saXN0XCI6IHtcbiAgICAgIGFjY2VzczogXCJyZWFkXCIsXG4gICAgICBncmFudGVkQnk6IFwicmVsYXRpb25zXCIsXG4gICAgICByZWxhdGlvbnM6IFtcInN1YmplY3RUZWFjaGVyXCJdLFxuICAgIH0sXG4gIH0sXG4gIGNoYW5nZXM6IFtdLFxuICBwdWJsaXNoZWQ6IFtdLFxufSk7XG5cbi8qKlxuICogQW4gQWRtaW4gc3RvcmVzIGEgZGF0ZWQgdmVyc2lvbiBvZiB0aGUgc2Nob29sJ3MgZ3JhZGluZyBzY2hlbWUuIFRoZSBzdG9yZSBpc1xuICogam91cm5hbGVkIG9uIHRoZSBzY2hvb2wgd2l0aCB0aGUgdmVyc2lvbidzIElEIGFsb25lLCBiZWNhdXNlIHRoZSB2YWx1ZXMgb2YgYVxuICogc2NoZW1lIG5ldmVyIHJlYWNoIHRoZSBqb3VybmFsIChBRFIgMDAxNikuXG4gKi9cbmNvbnN0IHRlbmFudFNjaGVtZXMgPSBLaW5kLmV4dGVuZCh0ZW5hbnQsIHtcbiAgYWN0aW9uczoge1xuICAgIFwic2NoZW1lLm1hbmFnZVwiOiB7XG4gICAgICBhY2Nlc3M6IFwid3JpdGVcIixcbiAgICAgIGdyYW50ZWRCeTogXCJyb2xlc1wiLFxuICAgICAgcmVsYXRpb25zOiBbXSxcbiAgICAgIHJvbGVzOiBbXCJhZG1pblwiXSxcbiAgICB9LFxuICB9LFxuICBjaGFuZ2VzOiBbXG4gICAgU2NoZW1hLlN0cnVjdCh7XG4gICAgICBzY2hlbWU6IElkKFwiZ3JhZGluZ1NjaGVtZXNcIiksXG4gICAgICB0eXBlOiBTY2hlbWEuTGl0ZXJhbChcInNjaGVtZS5zdG9yZWRcIiksXG4gICAgfSksXG4gIF0sXG4gIHB1Ymxpc2hlZDogW10sXG59KTtcblxuLyoqIFRoZSByZWNvcmRzIG1vZHVsZSdzIGtpbmRzIGZvciB0aGUgYWNjZXNzIGNhdGFsb2c6IHRoZSBncmFkZSwgYW5kIGl0cyBleHRlbnNpb25zIG9uIHRoZSBjbGFzcyBhbmQgdGhlIHNjaG9vbC4gKi9cbmV4cG9ydCBjb25zdCByZWNvcmRzID0ge1xuICBleHRlbnNpb25zOiBbY2xhc3NHcmFkZXMsIHRlbmFudFNjaGVtZXNdLFxuICBraW5kczogW2dyYWRlS2luZF0sXG59O1xuIiwgImNvbnN0IF9faW5qZWN0ZWRfZmlsZW5hbWVfXyA9IFwiL1VzZXJzL25hYmlsZmF0aWgvQ29kZS9uYWthZmEtd29ya3RyZWVzL3RvcHVwL3BhY2thZ2VzL2JhY2tlbmQvY29uZmVjdC9hY2Nlc3Mva2luZHMudHNcIjtjb25zdCBfX2luamVjdGVkX2Rpcm5hbWVfXyA9IFwiL1VzZXJzL25hYmlsZmF0aWgvQ29kZS9uYWthZmEtd29ya3RyZWVzL3RvcHVwL3BhY2thZ2VzL2JhY2tlbmQvY29uZmVjdC9hY2Nlc3NcIjtjb25zdCBfX2luamVjdGVkX2ltcG9ydF9tZXRhX3VybF9fID0gXCJmaWxlOi8vL1VzZXJzL25hYmlsZmF0aWgvQ29kZS9uYWthZmEtd29ya3RyZWVzL3RvcHVwL3BhY2thZ2VzL2JhY2tlbmQvY29uZmVjdC9hY2Nlc3Mva2luZHMudHNcIjtpbXBvcnQgeyBJZCB9IGZyb20gXCJAcmVwby9iYWNrZW5kL2NvbmZlY3QvX2dlbmVyYXRlZC9pZFwiO1xuaW1wb3J0IHsgS2luZCB9IGZyb20gXCJAcmVwby9iYWNrZW5kL2NvbmZlY3QvYWNjZXNzL2tpbmRcIjtcbmltcG9ydCB7XG4gIEdyYW50RW5kUmVhc29uLFxuICBHcmFudFNjb3BlLFxuICBHcmFudFRlcm0sXG4gIFJvbGVSZWYsXG59IGZyb20gXCJAcmVwby9iYWNrZW5kL2NvbmZlY3QvYWNjZXNzL3NjaGVtYVwiO1xuaW1wb3J0IHsgcGVyc29uLCB0ZW5hbnQsIHVuaXQgfSBmcm9tIFwiQHJlcG8vYmFja2VuZC9jb25mZWN0L3RlbmFuY3kva2luZHNcIjtcbmltcG9ydCB7IFNjaGVtYSB9IGZyb20gXCJlZmZlY3RcIjtcblxuLyoqXG4gKiBPbmUgcm9sZSBhIFBlcnNvbiBob2xkczsgaXRzIGhvbGRlciBtYXkgYWx3YXlzIHNlZSBpdC4gRW5kaW5nIGl0IGlzIGRlY2lkZWRcbiAqIG9uIHRoZSBncmFudCBpdHNlbGYsIGNvdmVyZWQgYnkgaXRzIHVuaXQsIHNvIGEgZ3JhbnQgaW4gYW4gYXJjaGl2ZWQgdW5pdFxuICogY2FuIHN0aWxsIGJlIGVuZGVkOiBvbmx5IHRoZSBncmFudCdzIG93biBzdGF0dXMgbG9ja3MgaXQuXG4gKi9cbmV4cG9ydCBjb25zdCBncmFudCA9IEtpbmQubWFrZShcImdyYW50XCIsIFwidGVuYW50R3JhbnRzXCIsIHtcbiAgYWN0aW9uczoge1xuICAgIFwiZ3JhbnQucmV2b2tlXCI6IHtcbiAgICAgIGFjY2VzczogXCJ3cml0ZVwiLFxuICAgICAgZ3JhbnRlZEJ5OiBcInJvbGVzXCIsXG4gICAgICByZWxhdGlvbnM6IFtdLFxuICAgICAgcm9sZXM6IFtcImFkbWluXCJdLFxuICAgIH0sXG4gICAgXCJncmFudC52aWV3XCI6IHtcbiAgICAgIGFjY2VzczogXCJyZWFkXCIsXG4gICAgICBncmFudGVkQnk6IFwicm9sZXNcIixcbiAgICAgIHJlbGF0aW9uczogW1wiaG9sZGVyXCJdLFxuICAgICAgcm9sZXM6IFtcImFkbWluXCIsIFwicHJpbmNpcGFsXCIsIFwiYXVkaXRvclwiXSxcbiAgICB9LFxuICB9LFxuICBjaGFuZ2VzOiBbXSxcbiAgcHVibGlzaGVkOiBbXSxcbiAgcmVsYXRpb25zOiBbXCJob2xkZXJcIl0sXG59KTtcblxuLyoqXG4gKiBHaXZpbmcgYSByb2xlIChgZ3JhbnQubWFuYWdlYCkgaXMgZXZhbHVhdGVkIG9uIHRoZSBzY29wZSB0aGUgbmV3IGdyYW50XG4gKiBjb3ZlcnM6IHRoZSB0ZW5hbnQgZm9yIHRlbmFudC13aWRlIHJvbGVzLCB0aGUgdW5pdCBmb3IgdW5pdCByb2xlcy5cbiAqIGBvd25lci5tYW5hZ2VgIGFkZGl0aW9uYWxseSBnYXRlcyBnaXZpbmcgb3IgZW5kaW5nIGV2ZXJ5IE93bmVyIGFuZCBBZG1pblxuICogZ3JhbnQgYW5kIGJlbG9uZ3MgdG8gT3duZXJzIGFsb25lLlxuICovXG5leHBvcnQgY29uc3QgdGVuYW50R3JhbnRzID0gS2luZC5leHRlbmQodGVuYW50LCB7XG4gIGFjdGlvbnM6IHtcbiAgICBcImdyYW50Lm1hbmFnZVwiOiB7XG4gICAgICBhY2Nlc3M6IFwid3JpdGVcIixcbiAgICAgIGdyYW50ZWRCeTogXCJyb2xlc1wiLFxuICAgICAgcmVsYXRpb25zOiBbXSxcbiAgICAgIHJvbGVzOiBbXCJhZG1pblwiXSxcbiAgICB9LFxuICAgIFwib3duZXIubWFuYWdlXCI6IHtcbiAgICAgIGFjY2VzczogXCJ3cml0ZVwiLFxuICAgICAgZ3JhbnRlZEJ5OiBcInJvbGVzXCIsXG4gICAgICByZWxhdGlvbnM6IFtdLFxuICAgICAgcm9sZXM6IFtdLFxuICAgIH0sXG4gIH0sXG4gIGNoYW5nZXM6IFtdLFxuICBwdWJsaXNoZWQ6IFtdLFxufSk7XG5cbmNvbnN0IHVuaXRHcmFudHMgPSBLaW5kLmV4dGVuZCh1bml0LCB7XG4gIGFjdGlvbnM6IHtcbiAgICBcImdyYW50Lm1hbmFnZVwiOiB7XG4gICAgICBhY2Nlc3M6IFwid3JpdGVcIixcbiAgICAgIGdyYW50ZWRCeTogXCJyb2xlc1wiLFxuICAgICAgcmVsYXRpb25zOiBbXSxcbiAgICAgIHJvbGVzOiBbXCJhZG1pblwiXSxcbiAgICB9LFxuICB9LFxuICBjaGFuZ2VzOiBbXSxcbiAgcHVibGlzaGVkOiBbXSxcbn0pO1xuXG4vKiogR3JhbnQgY2hhbmdlcyBhcmUgZmlsZWQgdW5kZXIgdGhlIFBlcnNvbiB3aG8gaG9sZHMgdGhlIGdyYW50LiAqL1xuY29uc3QgcGVyc29uR3JhbnRzID0gS2luZC5leHRlbmQocGVyc29uLCB7XG4gIGFjdGlvbnM6IHt9LFxuICBjaGFuZ2VzOiBbXG4gICAgU2NoZW1hLlN0cnVjdCh7XG4gICAgICBncmFudDogSWQoXCJ0ZW5hbnRHcmFudHNcIiksXG4gICAgICByb2xlOiBSb2xlUmVmLFxuICAgICAgc2NvcGU6IEdyYW50U2NvcGUsXG4gICAgICB0ZXJtOiBHcmFudFRlcm0sXG4gICAgICB0eXBlOiBTY2hlbWEuTGl0ZXJhbChcImdyYW50LmNyZWF0ZWRcIiksXG4gICAgfSksXG4gICAgU2NoZW1hLlN0cnVjdCh7XG4gICAgICBncmFudDogSWQoXCJ0ZW5hbnRHcmFudHNcIiksXG4gICAgICByZWFzb246IEdyYW50RW5kUmVhc29uLFxuICAgICAgdHlwZTogU2NoZW1hLkxpdGVyYWwoXCJncmFudC5lbmRlZFwiKSxcbiAgICB9KSxcbiAgXSxcbiAgcHVibGlzaGVkOiBbXCJncmFudC5jcmVhdGVkXCIsIFwiZ3JhbnQuZW5kZWRcIl0sXG59KTtcblxuZXhwb3J0IGNvbnN0IGFjY2VzcyA9IHtcbiAgZXh0ZW5zaW9uczogW3RlbmFudEdyYW50cywgdW5pdEdyYW50cywgcGVyc29uR3JhbnRzXSxcbiAga2luZHM6IFtncmFudF0sXG59IGFzIGNvbnN0O1xuIiwgImNvbnN0IF9faW5qZWN0ZWRfZmlsZW5hbWVfXyA9IFwiL1VzZXJzL25hYmlsZmF0aWgvQ29kZS9uYWthZmEtd29ya3RyZWVzL3RvcHVwL3BhY2thZ2VzL2JhY2tlbmQvY29uZmVjdC9lZGl0b3Iva2luZHMudHNcIjtjb25zdCBfX2luamVjdGVkX2Rpcm5hbWVfXyA9IFwiL1VzZXJzL25hYmlsZmF0aWgvQ29kZS9uYWthZmEtd29ya3RyZWVzL3RvcHVwL3BhY2thZ2VzL2JhY2tlbmQvY29uZmVjdC9lZGl0b3JcIjtjb25zdCBfX2luamVjdGVkX2ltcG9ydF9tZXRhX3VybF9fID0gXCJmaWxlOi8vL1VzZXJzL25hYmlsZmF0aWgvQ29kZS9uYWthZmEtd29ya3RyZWVzL3RvcHVwL3BhY2thZ2VzL2JhY2tlbmQvY29uZmVjdC9lZGl0b3Iva2luZHMudHNcIjtpbXBvcnQgeyBLaW5kIH0gZnJvbSBcIkByZXBvL2JhY2tlbmQvY29uZmVjdC9hY2Nlc3Mva2luZFwiO1xuaW1wb3J0IHR5cGUgeyBSdWxlLCBSdWxlUm9sZSB9IGZyb20gXCJAcmVwby9iYWNrZW5kL2NvbmZlY3QvYWNjZXNzL3NjaGVtYVwiO1xuaW1wb3J0IHsgdGVuYW50LCB1bml0IH0gZnJvbSBcIkByZXBvL2JhY2tlbmQvY29uZmVjdC90ZW5hbmN5L2tpbmRzXCI7XG5cbi8qKiBUaGUgc2Nob29sIHJvbGVzIHRoYXQgdmlldyBhbmQgZWRpdCB0aGUgZG9jdW1lbnRzIG9mIHRoZWlyIHNjaG9vbCwgd2l0aGluIGVhY2ggZG9jdW1lbnQncyBzY29wZS4gKi9cbmNvbnN0IGRvY3VtZW50RWRpdG9yczogKHR5cGVvZiBSdWxlUm9sZS5UeXBlKVtdID0gW1wiYWRtaW5cIiwgXCJ0ZWFjaGVyXCJdO1xuXG4vKipcbiAqIFRoZSBydWxlIG9mIGBkb2N1bWVudC5lZGl0YDogdGhlIHNjaG9vbCByb2xlcyBtYXkgZWRpdCBhIGRvY3VtZW50IHdpdGhpbiBpdHMgc2NvcGUuXG4gKiBFdmVyeSBraW5kIHRoYXQgZGVjbGFyZXMgdGhlIGFjdGlvbiB0YWtlcyB0aGlzIG9uZSBydWxlLCBzbyB0aGUgcm9sZXMgYXJlIHdyaXR0ZW4gb25jZS5cbiAqL1xuY29uc3QgZG9jdW1lbnRFZGl0OiBSdWxlID0ge1xuICBhY2Nlc3M6IFwid3JpdGVcIixcbiAgZ3JhbnRlZEJ5OiBcInJvbGVzXCIsXG4gIHJlbGF0aW9uczogW10sXG4gIHJvbGVzOiBkb2N1bWVudEVkaXRvcnMsXG59O1xuXG4vKipcbiAqIE9uZSBjb2xsYWJvcmF0aXZlIGRvY3VtZW50OiBhIHF1ZXN0aW9uLCBhIG1hdGVyaWFsLCBvciBhbiBhbm5vdW5jZW1lbnQgdGhhdFxuICogc2V2ZXJhbCB0ZWFjaGVycyBlZGl0IHRvZ2V0aGVyLiBJdHMgc2NvcGUgaXMgdGhlIHRlbmFudCBvciBvbmUgdW5pdCwgYW5kIGFuXG4gKiBPd25lciwgYW4gQWRtaW4sIG9yIGEgVGVhY2hlciB3aG9zZSBncmFudCBjb3ZlcnMgdGhlIHNjb3BlIG1heSB2aWV3IGFuZCBlZGl0IGl0LlxuICogQW4gYXJjaGl2ZWQgdW5pdCBsb2NrcyB0aGUgZWRpdHMgb2YgaXRzIGRvY3VtZW50cy4gQSBzdHVkZW50IGFuZCBhbiBpbnRlZ3JhdGlvblxuICogY2xpZW50IHJlYWNoIG5laXRoZXIgYWN0aW9uLlxuICovXG5leHBvcnQgY29uc3QgZG9jdW1lbnRLaW5kID0gS2luZC5tYWtlKFwiZG9jdW1lbnRcIiwgXCJlZGl0b3JEb2N1bWVudHNcIiwge1xuICBhY3Rpb25zOiB7XG4gICAgXCJkb2N1bWVudC5lZGl0XCI6IGRvY3VtZW50RWRpdCxcbiAgICBcImRvY3VtZW50LnZpZXdcIjoge1xuICAgICAgYWNjZXNzOiBcInJlYWRcIixcbiAgICAgIGdyYW50ZWRCeTogXCJyb2xlc1wiLFxuICAgICAgcmVsYXRpb25zOiBbXSxcbiAgICAgIHJvbGVzOiBkb2N1bWVudEVkaXRvcnMsXG4gICAgfSxcbiAgfSxcbiAgY2hhbmdlczogW10sXG4gIHB1Ymxpc2hlZDogW10sXG4gIHJlbGF0aW9uczogW10sXG59KTtcblxuLyoqXG4gKiBDcmVhdGluZyBhIGRvY3VtZW50IGlzIGRlY2lkZWQgb24gdGhlIHNjb3BlIGl0IGNvdmVycywgYXMgYSBncmFudCBpczogdGhlXG4gKiB0ZW5hbnQgZm9yIGEgdGVuYW50LXdpZGUgZG9jdW1lbnQsIHRoZSB1bml0IGZvciBhIHVuaXQgZG9jdW1lbnQuIFRoZSB0ZW5hbnRcbiAqIGFuZCB0aGUgdW5pdCBlYWNoIHRha2UgdGhlIGBkb2N1bWVudC5lZGl0YCBhY3Rpb24gb2YgdGhlaXIgb3duLlxuICovXG5jb25zdCB0ZW5hbnREb2N1bWVudHMgPSBLaW5kLmV4dGVuZCh0ZW5hbnQsIHtcbiAgYWN0aW9uczogeyBcImRvY3VtZW50LmVkaXRcIjogZG9jdW1lbnRFZGl0IH0sXG4gIGNoYW5nZXM6IFtdLFxuICBwdWJsaXNoZWQ6IFtdLFxufSk7XG5cbmNvbnN0IHVuaXREb2N1bWVudHMgPSBLaW5kLmV4dGVuZCh1bml0LCB7XG4gIGFjdGlvbnM6IHsgXCJkb2N1bWVudC5lZGl0XCI6IGRvY3VtZW50RWRpdCB9LFxuICBjaGFuZ2VzOiBbXSxcbiAgcHVibGlzaGVkOiBbXSxcbn0pO1xuXG4vKipcbiAqIFRoZSBlZGl0b3IgbW9kdWxlJ3Mga2luZHMgZm9yIHRoZSBhY2Nlc3MgY2F0YWxvZzogdGhlIGRvY3VtZW50LCBhbmQgaXRzXG4gKiBleHRlbnNpb25zIG9uIHRoZSB0ZW5hbnQgYW5kIHRoZSB1bml0LlxuICovXG5leHBvcnQgY29uc3QgZWRpdG9yID0ge1xuICBleHRlbnNpb25zOiBbdGVuYW50RG9jdW1lbnRzLCB1bml0RG9jdW1lbnRzXSxcbiAga2luZHM6IFtkb2N1bWVudEtpbmRdLFxufTtcbiIsICJjb25zdCBfX2luamVjdGVkX2ZpbGVuYW1lX18gPSBcIi9Vc2Vycy9uYWJpbGZhdGloL0NvZGUvbmFrYWZhLXdvcmt0cmVlcy90b3B1cC9wYWNrYWdlcy9iYWNrZW5kL2NvbmZlY3QvZXhhbXMva2luZHMudHNcIjtjb25zdCBfX2luamVjdGVkX2Rpcm5hbWVfXyA9IFwiL1VzZXJzL25hYmlsZmF0aWgvQ29kZS9uYWthZmEtd29ya3RyZWVzL3RvcHVwL3BhY2thZ2VzL2JhY2tlbmQvY29uZmVjdC9leGFtc1wiO2NvbnN0IF9faW5qZWN0ZWRfaW1wb3J0X21ldGFfdXJsX18gPSBcImZpbGU6Ly8vVXNlcnMvbmFiaWxmYXRpaC9Db2RlL25ha2FmYS13b3JrdHJlZXMvdG9wdXAvcGFja2FnZXMvYmFja2VuZC9jb25mZWN0L2V4YW1zL2tpbmRzLnRzXCI7aW1wb3J0IHsgS2luZCB9IGZyb20gXCJAcmVwby9iYWNrZW5kL2NvbmZlY3QvYWNjZXNzL2tpbmRcIjtcbmltcG9ydCB0eXBlIHsgUnVsZVJvbGUgfSBmcm9tIFwiQHJlcG8vYmFja2VuZC9jb25mZWN0L2FjY2Vzcy9zY2hlbWFcIjtcbmltcG9ydCB7IHRlbmFudCwgdW5pdCB9IGZyb20gXCJAcmVwby9iYWNrZW5kL2NvbmZlY3QvdGVuYW5jeS9raW5kc1wiO1xuXG4vKiogVGhlIHNjaG9vbCByb2xlcyB0aGF0IHZpZXcgYW5kIGVkaXQgdGhlIGV4YW1zIG9mIHRoZWlyIHNjaG9vbCwgd2l0aGluIGVhY2ggZXhhbSdzIHNjb3BlLiAqL1xuY29uc3QgZXhhbUVkaXRvcnM6ICh0eXBlb2YgUnVsZVJvbGUuVHlwZSlbXSA9IFtcImFkbWluXCIsIFwidGVhY2hlclwiXTtcblxuLyoqXG4gKiBUaGUgc2Nob29sIHJvbGVzIHRoYXQgdmlldyB0aGUgcm9vbXMgb2YgYW4gZXhhbTogdGhlIGVkaXRvcnMsIGFuZCB0aGUgUHJpbmNpcGFsIGFuZCB0aGVcbiAqIERlcHV0eSwgd2hvIHZpZXcgZXZlcnkgcm9vbSB0aGUgc2l0dGluZyB2aWV3IGFsbG93cyB0aGVtICh0aGUgcm9sZXMgb2YgYHNpdHRpbmcudmlld2ApLlxuICovXG5jb25zdCByb29tVmlld2VyczogKHR5cGVvZiBSdWxlUm9sZS5UeXBlKVtdID0gW1xuICBcImFkbWluXCIsXG4gIFwidGVhY2hlclwiLFxuICBcInByaW5jaXBhbFwiLFxuICBcImRlcHV0eVwiLFxuXTtcblxuLyoqXG4gKiBPbmUgc2Nob29sIGV4YW0gZHJhZnQuIEl0cyBzY29wZSBpcyB0aGUgdGVuYW50IG9yIG9uZSB1bml0LCBhbmQgYW4gT3duZXIsIGFuIEFkbWluLFxuICogb3IgYSBUZWFjaGVyIHdob3NlIGdyYW50IGNvdmVycyB0aGUgc2NvcGUgbWF5IHZpZXcgYW5kIGVkaXQgaXQuIEFuIGFyY2hpdmVkIHVuaXRcbiAqIGxvY2tzIHRoZSBlZGl0cyBvZiBpdHMgZXhhbXMuIEEgc3R1ZGVudCBhbmQgYW4gaW50ZWdyYXRpb24gY2xpZW50IHJlYWNoIG5laXRoZXJcbiAqIGFjdGlvbi4gYGV4YW0ucm9vbXNgIG9wZW5zIHRoZSBleGFtJ3Mgcm9vbXMgdG8gdGhlIHZpZXdlcnMgb2YgdGhlIHJvb21zLCBhbmQgZWFjaCByb29tXG4gKiBpcyB0aGVuIGRlY2lkZWQgYnkgaXRzIG93biBzaXR0aW5nIHZpZXcuXG4gKi9cbmV4cG9ydCBjb25zdCBleGFtS2luZCA9IEtpbmQubWFrZShcImV4YW1cIiwgXCJleGFtc1wiLCB7XG4gIGFjdGlvbnM6IHtcbiAgICBcImV4YW0uZWRpdFwiOiB7XG4gICAgICBhY2Nlc3M6IFwid3JpdGVcIixcbiAgICAgIGdyYW50ZWRCeTogXCJyb2xlc1wiLFxuICAgICAgcmVsYXRpb25zOiBbXSxcbiAgICAgIHJvbGVzOiBleGFtRWRpdG9ycyxcbiAgICB9LFxuICAgIFwiZXhhbS5yb29tc1wiOiB7XG4gICAgICBhY2Nlc3M6IFwicmVhZFwiLFxuICAgICAgZ3JhbnRlZEJ5OiBcInJvbGVzXCIsXG4gICAgICByZWxhdGlvbnM6IFtdLFxuICAgICAgcm9sZXM6IHJvb21WaWV3ZXJzLFxuICAgIH0sXG4gICAgXCJleGFtLnZpZXdcIjoge1xuICAgICAgYWNjZXNzOiBcInJlYWRcIixcbiAgICAgIGdyYW50ZWRCeTogXCJyb2xlc1wiLFxuICAgICAgcmVsYXRpb25zOiBbXSxcbiAgICAgIHJvbGVzOiBleGFtRWRpdG9ycyxcbiAgICB9LFxuICB9LFxuICBjaGFuZ2VzOiBbXSxcbiAgcHVibGlzaGVkOiBbXSxcbiAgcmVsYXRpb25zOiBbXSxcbn0pO1xuXG4vKipcbiAqIENyZWF0aW5nIGFuIGV4YW0gaXMgZGVjaWRlZCBvbiB0aGUgc2NvcGUgaXQgY292ZXJzLCBhcyBhIGRvY3VtZW50IGlzOiB0aGUgdGVuYW50XG4gKiBmb3IgYSB0ZW5hbnQtd2lkZSBleGFtLCB0aGUgdW5pdCBmb3IgYSB1bml0IGV4YW0uIFRoZSB0ZW5hbnQgYW5kIHRoZSB1bml0IGVhY2ggdGFrZVxuICogdGhlIGBleGFtLmVkaXRgIGFjdGlvbiBvZiB0aGVpciBvd24sIGFuZCB0aGUgYGV4YW0udmlld2AgYWN0aW9uIHRoYXQgbGV0cyB0aGUgc2Nob29sXG4gKiBzaG93IGl0cyBleGFtcyB0byB0aGVpciBlZGl0b3JzLCBhbmQgdGhlIGBleGFtLnJvb21zYCBhY3Rpb24gdGhhdCBvcGVucyBpdHMgcm9vbXMuXG4gKi9cbmNvbnN0IHRlbmFudEV4YW1zID0gS2luZC5leHRlbmQodGVuYW50LCB7XG4gIGFjdGlvbnM6IHtcbiAgICBcImV4YW0uZWRpdFwiOiB7XG4gICAgICBhY2Nlc3M6IFwid3JpdGVcIixcbiAgICAgIGdyYW50ZWRCeTogXCJyb2xlc1wiLFxuICAgICAgcmVsYXRpb25zOiBbXSxcbiAgICAgIHJvbGVzOiBleGFtRWRpdG9ycyxcbiAgICB9LFxuICAgIFwiZXhhbS5yb29tc1wiOiB7XG4gICAgICBhY2Nlc3M6IFwicmVhZFwiLFxuICAgICAgZ3JhbnRlZEJ5OiBcInJvbGVzXCIsXG4gICAgICByZWxhdGlvbnM6IFtdLFxuICAgICAgcm9sZXM6IHJvb21WaWV3ZXJzLFxuICAgIH0sXG4gICAgXCJleGFtLnZpZXdcIjoge1xuICAgICAgYWNjZXNzOiBcInJlYWRcIixcbiAgICAgIGdyYW50ZWRCeTogXCJyb2xlc1wiLFxuICAgICAgcmVsYXRpb25zOiBbXSxcbiAgICAgIHJvbGVzOiBleGFtRWRpdG9ycyxcbiAgICB9LFxuICB9LFxuICBjaGFuZ2VzOiBbXSxcbiAgcHVibGlzaGVkOiBbXSxcbn0pO1xuXG5jb25zdCB1bml0RXhhbXMgPSBLaW5kLmV4dGVuZCh1bml0LCB7XG4gIGFjdGlvbnM6IHtcbiAgICBcImV4YW0uZWRpdFwiOiB7XG4gICAgICBhY2Nlc3M6IFwid3JpdGVcIixcbiAgICAgIGdyYW50ZWRCeTogXCJyb2xlc1wiLFxuICAgICAgcmVsYXRpb25zOiBbXSxcbiAgICAgIHJvbGVzOiBleGFtRWRpdG9ycyxcbiAgICB9LFxuICAgIFwiZXhhbS5yb29tc1wiOiB7XG4gICAgICBhY2Nlc3M6IFwicmVhZFwiLFxuICAgICAgZ3JhbnRlZEJ5OiBcInJvbGVzXCIsXG4gICAgICByZWxhdGlvbnM6IFtdLFxuICAgICAgcm9sZXM6IHJvb21WaWV3ZXJzLFxuICAgIH0sXG4gICAgXCJleGFtLnZpZXdcIjoge1xuICAgICAgYWNjZXNzOiBcInJlYWRcIixcbiAgICAgIGdyYW50ZWRCeTogXCJyb2xlc1wiLFxuICAgICAgcmVsYXRpb25zOiBbXSxcbiAgICAgIHJvbGVzOiBleGFtRWRpdG9ycyxcbiAgICB9LFxuICB9LFxuICBjaGFuZ2VzOiBbXSxcbiAgcHVibGlzaGVkOiBbXSxcbn0pO1xuXG4vKipcbiAqIFRoZSBleGFtcyBtb2R1bGUncyBraW5kcyBmb3IgdGhlIGFjY2VzcyBjYXRhbG9nOiB0aGUgZXhhbSwgYW5kIGl0cyBleHRlbnNpb25zIG9uIHRoZVxuICogdGVuYW50IGFuZCB0aGUgdW5pdC5cbiAqL1xuZXhwb3J0IGNvbnN0IGV4YW0gPSB7XG4gIGV4dGVuc2lvbnM6IFt0ZW5hbnRFeGFtcywgdW5pdEV4YW1zXSxcbiAga2luZHM6IFtleGFtS2luZF0sXG59O1xuIiwgImNvbnN0IF9faW5qZWN0ZWRfZmlsZW5hbWVfXyA9IFwiL1VzZXJzL25hYmlsZmF0aWgvQ29kZS9uYWthZmEtd29ya3RyZWVzL3RvcHVwL3BhY2thZ2VzL2JhY2tlbmQvY29uZmVjdC9hY2Nlc3MvY2F0YWxvZy50c1wiO2NvbnN0IF9faW5qZWN0ZWRfZGlybmFtZV9fID0gXCIvVXNlcnMvbmFiaWxmYXRpaC9Db2RlL25ha2FmYS13b3JrdHJlZXMvdG9wdXAvcGFja2FnZXMvYmFja2VuZC9jb25mZWN0L2FjY2Vzc1wiO2NvbnN0IF9faW5qZWN0ZWRfaW1wb3J0X21ldGFfdXJsX18gPSBcImZpbGU6Ly8vVXNlcnMvbmFiaWxmYXRpaC9Db2RlL25ha2FmYS13b3JrdHJlZXMvdG9wdXAvcGFja2FnZXMvYmFja2VuZC9jb25mZWN0L2FjY2Vzcy9jYXRhbG9nLnRzXCI7aW1wb3J0IHsgS2luZCB9IGZyb20gXCJAcmVwby9iYWNrZW5kL2NvbmZlY3QvYWNjZXNzL2tpbmRcIjtcbmltcG9ydCB7IGFjY2VzcyB9IGZyb20gXCJAcmVwby9iYWNrZW5kL2NvbmZlY3QvYWNjZXNzL2tpbmRzXCI7XG5pbXBvcnQgdHlwZSB7IFJ1bGUsIFJ1bGVSb2xlIH0gZnJvbSBcIkByZXBvL2JhY2tlbmQvY29uZmVjdC9hY2Nlc3Mvc2NoZW1hXCI7XG5pbXBvcnQgeyBjbGFzc3Jvb20gfSBmcm9tIFwiQHJlcG8vYmFja2VuZC9jb25mZWN0L2NsYXNzcm9vbS9raW5kc1wiO1xuaW1wb3J0IHsgY29ubmVjdG9ycyB9IGZyb20gXCJAcmVwby9iYWNrZW5kL2NvbmZlY3QvY29ubmVjdG9ycy9raW5kc1wiO1xuaW1wb3J0IHsgZWRpdG9yIH0gZnJvbSBcIkByZXBvL2JhY2tlbmQvY29uZmVjdC9lZGl0b3Iva2luZHNcIjtcbmltcG9ydCB7IGV4YW0gfSBmcm9tIFwiQHJlcG8vYmFja2VuZC9jb25mZWN0L2V4YW1zL2tpbmRzXCI7XG5pbXBvcnQgeyByZXN1bHRzIH0gZnJvbSBcIkByZXBvL2JhY2tlbmQvY29uZmVjdC9leGFtcy9yZXN1bHRzL2tpbmRzXCI7XG5pbXBvcnQgeyBzaXR0aW5nIH0gZnJvbSBcIkByZXBvL2JhY2tlbmQvY29uZmVjdC9leGFtcy9zaXR0aW5ncy9raW5kc1wiO1xuaW1wb3J0IHsgaW50ZWdyYXRpb25zIH0gZnJvbSBcIkByZXBvL2JhY2tlbmQvY29uZmVjdC9pbnRlZ3JhdGlvbnMva2luZHNcIjtcbmltcG9ydCB7IG9wZXJhdG9ycyB9IGZyb20gXCJAcmVwby9iYWNrZW5kL2NvbmZlY3Qvb3BlcmF0b3JzL2tpbmRzXCI7XG5pbXBvcnQgeyByZWNvcmRzIH0gZnJvbSBcIkByZXBvL2JhY2tlbmQvY29uZmVjdC9yZWNvcmRzL2tpbmRzXCI7XG5pbXBvcnQgeyB0ZW5hbmN5IH0gZnJvbSBcIkByZXBvL2JhY2tlbmQvY29uZmVjdC90ZW5hbmN5L2tpbmRzXCI7XG5pbXBvcnQgeyBBcnJheSBhcyBBcnIsIFJlY29yZCwgU2NoZW1hLCBTY2hlbWFHZXR0ZXIsIFN0cnVjdCB9IGZyb20gXCJlZmZlY3RcIjtcblxuLyoqIEV2ZXJ5IGxhbmUncyBraW5kcy4gQSBsYW5lIGpvaW5zIHdpdGggb25lIGxpbmUgaGVyZSBhbmQgb25lIGluIGBleHRlbnNpb25zYC4gKi9cbmV4cG9ydCBjb25zdCBraW5kcyA9IFtcbiAgLi4udGVuYW5jeS5raW5kcyxcbiAgLi4uYWNjZXNzLmtpbmRzLFxuICAuLi5pbnRlZ3JhdGlvbnMua2luZHMsXG4gIC4uLmNvbm5lY3RvcnMua2luZHMsXG4gIC4uLmNsYXNzcm9vbS5raW5kcyxcbiAgLi4ucmVjb3Jkcy5raW5kcyxcbiAgLi4ub3BlcmF0b3JzLmtpbmRzLFxuICAuLi5lZGl0b3Iua2luZHMsXG4gIC4uLmV4YW0ua2luZHMsXG4gIC4uLnNpdHRpbmcua2luZHMsXG4gIC4uLnJlc3VsdHMua2luZHMsXG5dIGFzIGNvbnN0O1xuXG4vKiogRXZlcnkgbGFuZSdzIGV4dGVuc2lvbnMgb2YgYW5vdGhlciBsYW5lJ3Mga2luZHMuICovXG5jb25zdCBleHRlbnNpb25zID0gW1xuICAuLi50ZW5hbmN5LmV4dGVuc2lvbnMsXG4gIC4uLmFjY2Vzcy5leHRlbnNpb25zLFxuICAuLi5pbnRlZ3JhdGlvbnMuZXh0ZW5zaW9ucyxcbiAgLi4uY29ubmVjdG9ycy5leHRlbnNpb25zLFxuICAuLi5jbGFzc3Jvb20uZXh0ZW5zaW9ucyxcbiAgLi4ucmVjb3Jkcy5leHRlbnNpb25zLFxuICAuLi5vcGVyYXRvcnMuZXh0ZW5zaW9ucyxcbiAgLi4uZWRpdG9yLmV4dGVuc2lvbnMsXG4gIC4uLmV4YW0uZXh0ZW5zaW9ucyxcbiAgLi4uc2l0dGluZy5leHRlbnNpb25zLFxuICAuLi5yZXN1bHRzLmV4dGVuc2lvbnMsXG5dIGFzIGNvbnN0O1xuXG4vKiogRXZlcnkgZGVjbGFyYXRpb24gYW5kIGV4dGVuc2lvbjsgZWFjaCBraW5kJ3MgYWN0aW9ucywgcnVsZXMsIGFuZCBjaGFuZ2VzIGpvaW4gZnJvbSB0aGVzZS4gKi9cbmV4cG9ydCBjb25zdCBlbnRyaWVzID0gWy4uLmtpbmRzLCAuLi5leHRlbnNpb25zXSBhcyBjb25zdDtcblxuLyoqIEEgdHlwZWQgYHsga2luZCwgaWQgfWAgcG9pbnRlcjsgcGVybWlzc2lvbiBpcyBjaGVja2VkIHdoZW5ldmVyIGl0IGlzIHJlYWQuICovXG5leHBvcnQgY29uc3QgT2JqZWN0UmVmID0gU2NoZW1hLlVuaW9uKEFyci5tYXAoa2luZHMsIChraW5kKSA9PiBraW5kLnJlZikpLnBpcGUoXG4gIFNjaGVtYS50b1RhZ2dlZFVuaW9uKFwia2luZFwiKVxuKTtcblxuLyoqXG4gKiBFdmVyeSBhY3Rpb24gb2YgZXZlcnkga2luZCwgbmFtZWQgYXMgYHNvdXJjZS52ZXJiYC4gQW4gZW50cnkgdGhhdCBkZWNsYXJlcyBub1xuICogYWN0aW9uLCBzdWNoIGFzIGFuIGV4dGVuc2lvbiB0aGF0IG9ubHkgYWRkcyBjaGFuZ2VzLCBhZGRzIG5vIGxpdGVyYWwgaGVyZTpcbiAqIENvbmZlY3QgY2Fubm90IGNvbXBpbGUgYW4gZW1wdHkgdW5pb24gaW50byBhIHZhbGlkYXRvci5cbiAqL1xuZXhwb3J0IGNvbnN0IEFjdGlvbiA9IFNjaGVtYS5VbmlvbihcbiAgQXJyLm1hcChcbiAgICBBcnIuZmlsdGVyKGVudHJpZXMsIChlbnRyeSkgPT4gU3RydWN0LmtleXMoZW50cnkuYWN0aW9ucykubGVuZ3RoID4gMCksXG4gICAgKGVudHJ5KSA9PiBlbnRyeS5hY3Rpb25cbiAgKVxuKTtcblxuLyoqXG4gKiBXaGV0aGVyIHNvbWUgcnVsZSBvZiB0aGUgY2F0YWxvZyBncmFudHMgYGFjdGlvbmAgdGhyb3VnaCBgcm9sZWAuIEEgcnVsZVxuICogdGhhdCBncmFudHMgYnkgcmVsYXRpb25zIGFsb25lIG9wZW5zIG5vIHJvbGUuXG4gKi9cbmV4cG9ydCBjb25zdCBvcGVuc1RvID0gKGFjdGlvbjogc3RyaW5nLCByb2xlOiB0eXBlb2YgUnVsZVJvbGUuVHlwZSk6IGJvb2xlYW4gPT5cbiAgQXJyLnNvbWUoZW50cmllcywgKGVudHJ5KSA9PlxuICAgIEFyci5zb21lKFxuICAgICAgUmVjb3JkLnRvRW50cmllczxzdHJpbmcsIFJ1bGU+KGVudHJ5LmFjdGlvbnMpLFxuICAgICAgKFtuYW1lLCBydWxlXSkgPT5cbiAgICAgICAgbmFtZSA9PT0gYWN0aW9uICYmXG4gICAgICAgIHJ1bGUuZ3JhbnRlZEJ5ID09PSBcInJvbGVzXCIgJiZcbiAgICAgICAgQXJyLmNvbnRhaW5zKHJ1bGUucm9sZXMsIHJvbGUpXG4gICAgKVxuICApO1xuXG4vKiogQWN0aW9ucyBldmFsdWF0ZWQgb24gdGhlIHRlbmFudCBpdHNlbGYsIGl0cyBvd24gYW5kIGV2ZXJ5IGV4dGVuc2lvbidzLiAqL1xuZXhwb3J0IGNvbnN0IFRlbmFudEFjdGlvbiA9IEtpbmQuYWN0aW9ucyhlbnRyaWVzLCBcInRlbmFudFwiKTtcblxuLyoqIEFjdGlvbnMgZXZhbHVhdGVkIG9uIG9uZSBzY2hvb2wgdW5pdCwgaXRzIG93biBhbmQgZXZlcnkgZXh0ZW5zaW9uJ3MuICovXG5jb25zdCBVbml0QWN0aW9uID0gS2luZC5hY3Rpb25zKGVudHJpZXMsIFwidW5pdFwiKTtcblxuLyoqXG4gKiBUaGUgYWN0aW9uIG5hbWVzIG9mIG9uZSBraW5kIG9uIHRoZSB3aXJlLiBBIGNsaWVudCBidWlsdCBiZWZvcmUgYSBsYW5lIGFkZGVkIGFuXG4gKiBhY3Rpb24gZHJvcHMgdGhlIHVua25vd24gbGl0ZXJhbCBpbnN0ZWFkIG9mIGZhaWxpbmcgdG8gZGVjb2RlLlxuICovXG5jb25zdCBjYXBhYmlsaXRpZXNPZiA9IDxBY3Rpb24gZXh0ZW5kcyBTY2hlbWEuQ29kZWM8c3RyaW5nPj4oYWN0aW9uOiBBY3Rpb24pID0+XG4gIFNjaGVtYS5BcnJheShTY2hlbWEuU3RyaW5nKS5waXBlKFxuICAgIFNjaGVtYS5kZWNvZGVUbyhTY2hlbWEuQXJyYXkoYWN0aW9uKSwge1xuICAgICAgZGVjb2RlOiBTY2hlbWFHZXR0ZXIudHJhbnNmb3JtKEFyci5maWx0ZXIoU2NoZW1hLmlzKGFjdGlvbikpKSxcbiAgICAgIGVuY29kZTogU2NoZW1hR2V0dGVyLnBhc3N0aHJvdWdoU3VidHlwZSgpLFxuICAgIH0pXG4gICk7XG5cbi8qKiBUaGUgY2FsbGVyJ3MgdGVuYW50IGNhcGFiaWxpdGllcyBvbiB0aGUgd2lyZS4gKi9cbmV4cG9ydCBjb25zdCBUZW5hbnRDYXBhYmlsaXRpZXMgPSBjYXBhYmlsaXRpZXNPZihUZW5hbnRBY3Rpb24pO1xuXG4vKiogVGhlIGNhbGxlcidzIGNhcGFiaWxpdGllcyBvbiBvbmUgc2Nob29sIHVuaXQgb24gdGhlIHdpcmUuICovXG5leHBvcnQgY29uc3QgVW5pdENhcGFiaWxpdGllcyA9IGNhcGFiaWxpdGllc09mKFVuaXRBY3Rpb24pO1xuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFHQSxTQUFTLFNBQVMsS0FBa0IsUUFBUSxjQUFjO0FBUTFELElBQU0sWUFBWSxPQUFPLE9BQU87QUFBQSxFQUM5QixT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QUMsU0FBUyxLQUFLLEdBQUcsQ0FBQyxFQUFFO0FBQUEsRUFDeEVELFNBQU8sY0FBYyxNQUFNO0FBQzdCO0FBT08sSUFBTSxTQUFTQSxTQUFPO0FBQUEsRUFDM0JDLEtBQUk7QUFBQSxJQUNGQSxLQUFJLE9BQU8sU0FBUyxDQUFDLFVBQVVDLFFBQU8sS0FBSyxNQUFNLE9BQU8sRUFBRSxTQUFTLENBQUM7QUFBQSxJQUNwRSxDQUFDLFVBQVUsTUFBTTtBQUFBLEVBQ25CO0FBQ0Y7QUFrQk8sSUFBTSxlQUFlLEtBQUssUUFBUSxTQUFTLFFBQVE7QUFHMUQsSUFBTSxhQUFhLEtBQUssUUFBUSxTQUFTLE1BQU07QUFNL0MsSUFBTSxpQkFBaUIsQ0FBc0MsV0FDM0RDLFNBQU8sTUFBTUEsU0FBTyxNQUFNLEVBQUU7QUFBQSxFQUMxQkEsU0FBTyxTQUFTQSxTQUFPLE1BQU0sTUFBTSxHQUFHO0FBQUEsSUFDcEMsUUFBUSxhQUFhLFVBQVVDLEtBQUksT0FBT0QsU0FBTyxHQUFHLE1BQU0sQ0FBQyxDQUFDO0FBQUEsSUFDNUQsUUFBUSxhQUFhLG1CQUFtQjtBQUFBLEVBQzFDLENBQUM7QUFDSDtBQUdLLElBQU0scUJBQXFCLGVBQWUsWUFBWTtBQUd0RCxJQUFNLG1CQUFtQixlQUFlLFVBQVU7IiwKICAibmFtZXMiOiBbImVudHJpZXMiLCAib3B0aW9ucyIsICJTY2hlbWEiLCAiU2NoZW1hIiwgIlNjaGVtYSIsICJTY2hlbWEiLCAiU2NoZW1hIiwgIlNjaGVtYSIsICJTY2hlbWEiLCAiU2NoZW1hIiwgIlNjaGVtYSIsICJTY2hlbWEiLCAiU2NoZW1hIiwgIlNjaGVtYSIsICJTY2hlbWEiLCAiU2NoZW1hIiwgIlNjaGVtYSIsICJTY2hlbWEiLCAiU2NoZW1hIiwgIlNjaGVtYSIsICJTY2hlbWEiLCAiU2NoZW1hIiwgIkFyciIsICJTY2hlbWEiLCAiU3RydWN0IiwgIlNjaGVtYSIsICJBcnIiLCAiU3RydWN0IiwgIlNjaGVtYSIsICJBcnIiXQp9Cg==
