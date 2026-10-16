import { FunctionSpec, GroupSpec } from "@confect/core";
import { Id } from "@repo/backend/confect/_generated/id";
import { AccessDenied } from "@repo/backend/confect/access/errors";
import RequireMember from "@repo/backend/confect/middleware/member.spec";
import Session from "@repo/backend/confect/middleware/session.spec";
import { CohortAccess } from "@repo/backend/confect/tenancy/access";
import { AssignmentKind } from "@repo/backend/confect/tenancy/assignment";
import {
  CohortHasHomeroom,
  PersonNotTeacher,
  TeacherHasHomeroom,
} from "@repo/backend/confect/tenancy/errors";
import { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Schema } from "effect";

/** One homeroom assignment as the wire shows it. */
const AssignmentView = Schema.Struct({
  cohortId: Id("tenantCohorts"),
  id: Id("tenantAssignments"),
  kind: AssignmentKind,
  personId: Id("tenantPeople"),
});

/**
 * The homeroom teacher of a cohort (wali kelas). The school's Admin assigns and
 * removes it. The teacher reads the cohort through the `homeroom` relation.
 */
export default GroupSpec.make()
  .middleware(Session)
  .middleware(RequireMember)
  .addFunction(
    FunctionSpec.publicMutation({
      name: "assign",
      args: () => ({
        cohortId: Id("tenantCohorts"),
        personId: Id("tenantPeople"),
        slug: TenantSlug,
      }),
      returns: () => AssignmentView,
      error: () =>
        Schema.Union([
          AccessDenied,
          CohortHasHomeroom,
          PersonNotTeacher,
          TeacherHasHomeroom,
        ]),
    }).middleware(CohortAccess, { action: "cohort.manage", arg: "cohortId" })
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "unassign",
      args: () => ({ cohortId: Id("tenantCohorts"), slug: TenantSlug }),
      returns: () => Schema.NullOr(AssignmentView),
      error: () => AccessDenied,
    }).middleware(CohortAccess, { action: "cohort.manage", arg: "cohortId" })
  );
