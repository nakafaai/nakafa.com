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
 * The address of the Teacher that `createAcceptanceClassTeacher` seeds for a
 * school. No account holds it until the teacher is signed in.
 */
export const classTeacherAddress = (slug: string) =>
  `class-teacher-${slug}@acceptance.example.test`;

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
  yield* seedMember(
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

/** The usage of the class-teacher mode: the school of the Teacher, then the file for the session cookie. */
const USAGE = "class-teacher <school-slug> <cookie-file>";
const ClassTeacherArguments = Schema.Tuple([Schema.String, Schema.String]);

/**
 * The class-teacher mode of the acceptance command line: seeds a Teacher of one
 * class of the school that the command names and writes the Teacher's session
 * cookie to the file that the command names.
 */
export const classTeacherMode = {
  mode: "class-teacher",
  usage: USAGE,
  run: Effect.fn("contentAcceptance.runClassTeacher")(function* (
    root: string,
    args: readonly string[]
  ) {
    const [slug, output] = yield* decodeModeArguments(
      USAGE,
      ClassTeacherArguments,
      args
    );
    return yield* createAcceptanceClassTeacher(root, slug, output);
  }),
} satisfies AcceptanceMode;
