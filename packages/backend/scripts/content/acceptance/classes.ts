import { localConvexLayer } from "@repo/backend/scripts/content/acceptance/convex";
import {
  SessionCookies,
  writeFixture,
} from "@repo/backend/scripts/content/acceptance/fixture";
import { seedSchoolMember } from "@repo/backend/scripts/content/acceptance/member";
import {
  type AcceptanceMode,
  decodeModeArguments,
} from "@repo/backend/scripts/content/acceptance/mode";
import { Effect, Schema } from "effect";

/**
 * The address of the Teacher that `seedClassTeacher` seeds for a school. No
 * account holds it until the teacher is signed in.
 */
export const classTeacherAddress = (slug: string) =>
  `class-teacher-${slug}@acceptance.example.test`;

/**
 * Seeds a Teacher who teaches one class of an opened school, a class of a new
 * cohort in the school's first active period, signs the account of the address
 * in, as `seedTeacher` does, and answers its session cookie.
 * `classroom/seed:teacher` writes the class and the Teacher's teaching of it.
 */
export const seedClassTeacher = Effect.fn("contentAcceptance.seedClassTeacher")(
  function* (slug: string) {
    return yield* seedSchoolMember({
      address: classTeacherAddress(slug),
      args: {
        email: classTeacherAddress(slug),
        locale: "id",
        name: "Acceptance Class Teacher",
        slug,
        subject: "Fisika",
      },
      label: "class teacher",
      seed: "classroom/seed:teacher",
    });
  }
);

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
    const cookie = yield* seedClassTeacher(slug).pipe(
      Effect.provide(localConvexLayer(root))
    );
    yield* writeFixture(output, SessionCookies, cookie);
  }),
} satisfies AcceptanceMode;
