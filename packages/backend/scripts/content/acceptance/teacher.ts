import {
  encodeArguments,
  seedMember,
} from "@repo/backend/scripts/content/acceptance/member";
import {
  type AcceptanceMode,
  decodeModeArguments,
} from "@repo/backend/scripts/content/acceptance/mode";
import { Effect, Schema } from "effect";

/**
 * The address of the Teacher that `createAcceptanceTeacher` seeds for a school.
 * No account holds it until the teacher is signed in.
 */
export const teacherAddress = (slug: string) =>
  `teacher-${slug}@acceptance.example.test`;

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
  yield* seedMember(
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

/** The usage of the teacher mode: the school of the Teacher, then the file for the session cookie. */
const USAGE = "teacher <school-slug> <cookie-file>";
const TeacherArguments = Schema.Tuple([Schema.String, Schema.String]);

/**
 * The teacher mode of the acceptance command line: seeds a Teacher of the school
 * that the command names and writes the Teacher's session cookie to the file that
 * the command names.
 */
export const teacherMode = {
  mode: "teacher",
  usage: USAGE,
  run: Effect.fn("contentAcceptance.runTeacher")(function* (
    root: string,
    args: readonly string[]
  ) {
    const [slug, output] = yield* decodeModeArguments(
      USAGE,
      TeacherArguments,
      args
    );
    return yield* createAcceptanceTeacher(root, slug, output);
  }),
} satisfies AcceptanceMode;
