import { runLocalConvex } from "@repo/backend/scripts/content/acceptance/convex";
import { acceptanceRuntimeError } from "@repo/backend/scripts/content/acceptance/error";
import { readLocalRuntime } from "@repo/backend/scripts/content/acceptance/local";
import {
  encodeArguments,
  signInInvitedMember,
} from "@repo/backend/scripts/content/acceptance/member";
import { Effect } from "effect";

/**
 * The address of the Teacher that `createAcceptanceTeacher` seeds for a school.
 * No account holds it until the teacher is signed in.
 */
export const teacherAddress = (slug: string) =>
  `teacher-${slug}@acceptance.example.test`;

/**
 * The address of the Teacher that `createAcceptanceClassTeacher` seeds for a
 * school. No account holds it until the teacher is signed in.
 */
export const classTeacherAddress = (slug: string) =>
  `class-teacher-${slug}@acceptance.example.test`;

/**
 * Runs the seed function of one Teacher member of an opened school, then signs the
 * account of the address in, so its session cookie goes to `output`. The arguments
 * are the seed's own, encoded as the CLI takes them.
 */
const seedTeacherMember = Effect.fn("contentAcceptance.seedTeacherMember")(
  function* (
    root: string,
    member: {
      readonly address: string;
      readonly args: string;
      readonly label: string;
      readonly seed: string;
    },
    output: string
  ) {
    const runtime = yield* readLocalRuntime(root);
    if (runtime === undefined) {
      return yield* acceptanceRuntimeError(
        `Run pnpm acceptance:prepare and start acceptance before creating a ${member.label}.`
      );
    }
    yield* runLocalConvex(runtime, `${member.label} seed`, [
      "run",
      member.seed,
      member.args,
    ]);
    yield* signInInvitedMember(runtime, member.address, output);
  }
);

/**
 * Seeds a Teacher member of an opened school, the way `createAcceptanceSchool`
 * seeds its Owner. `tenancy/seed:teacher` writes an unclaimed Person, an
 * invite to the teacher's address in the school's language, and a teacher grant
 * over the whole school. Then an account signs in with the address, claims the
 * invite, and its session cookie goes to `output`.
 */
export const createAcceptanceTeacher = Effect.fn(
  "contentAcceptance.createTeacher"
)(function* (root: string, slug: string, output: string) {
  const args = yield* encodeArguments({
    email: teacherAddress(slug),
    locale: "id",
    name: "Acceptance Teacher",
    slug,
  });
  yield* seedTeacherMember(
    root,
    {
      address: teacherAddress(slug),
      args,
      label: "teacher",
      seed: "tenancy/seed:teacher",
    },
    output
  );
});

/**
 * Seeds a Teacher who teaches one class of an opened school, a class of a new
 * cohort in the school's first active period, and signs the account of the address
 * in, as `createAcceptanceTeacher` does. `classroom/seed:teacher` writes the class
 * and the Teacher's teaching of it.
 */
export const createAcceptanceClassTeacher = Effect.fn(
  "contentAcceptance.createClassTeacher"
)(function* (root: string, slug: string, output: string) {
  const args = yield* encodeArguments({
    email: classTeacherAddress(slug),
    locale: "id",
    name: "Acceptance Class Teacher",
    slug,
    subject: "Fisika",
  });
  yield* seedTeacherMember(
    root,
    {
      address: classTeacherAddress(slug),
      args,
      label: "class teacher",
      seed: "classroom/seed:teacher",
    },
    output
  );
});
