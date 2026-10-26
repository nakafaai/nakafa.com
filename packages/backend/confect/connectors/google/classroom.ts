import { GoogleFailed } from "@repo/backend/confect/connectors/errors";
import { GOOGLE_DEADLINE } from "@repo/backend/confect/connectors/google/oauth";
import type {
  ClassroomCourse,
  ClassroomWork,
} from "@repo/backend/confect/connectors/schema";
import { Array as Arr, DateTime, Effect, Option, Schema } from "effect";
import { HttpClient, HttpClientRequest } from "effect/http";

/** The root of Google Classroom's API. */
const CLASSROOM_ROOT = "https://classroom.googleapis.com/v1/";

/** The most courses one preview reads, and the most coursework or students one course reads. */
export const CLASSROOM_PAGE = 50;

/** One course as Google answers it. Only the fields an import reads are kept. */
const CourseAnswer = Schema.Struct({
  id: Schema.NonEmptyString,
  name: Schema.String,
  section: Schema.optionalKey(Schema.String),
});

/** When a piece of coursework due on a day with no time is due: the last minute of the day. */
const END_OF_DAY = { hours: 23, minutes: 59 };

/** A day as Classroom writes a due date. */
const DueDate = Schema.Struct({
  day: Schema.Int,
  month: Schema.Int,
  year: Schema.Int,
});

/** A time of day as Classroom writes a due time, in UTC. */
const DueTime = Schema.Struct({
  hours: Schema.optionalKey(Schema.Int),
  minutes: Schema.optionalKey(Schema.Int),
});

/** One piece of coursework as Google answers it. */
const CourseWorkAnswer = Schema.Struct({
  description: Schema.optionalKey(Schema.String),
  dueDate: Schema.optionalKey(DueDate),
  dueTime: Schema.optionalKey(DueTime),
  id: Schema.NonEmptyString,
  maxPoints: Schema.optionalKey(Schema.Finite),
  state: Schema.optionalKey(Schema.String),
  title: Schema.String,
});

/**
 * Reads the text of one Classroom resource with the connection's access token.
 * Google refusing the token fails as `revoked`, so the connection waits for its
 * owner to connect again.
 */
const readClassroom = Effect.fn("connectors.google.classroom.read")(function* (
  accessToken: string,
  path: string,
  query: Record<string, string>
) {
  const url = new URL(path, CLASSROOM_ROOT);
  url.search = new URLSearchParams(query).toString();
  const response = yield* (yield* HttpClient.HttpClient)
    .execute(
      HttpClientRequest.get(url).pipe(
        HttpClientRequest.bearerToken(accessToken)
      )
    )
    .pipe(
      Effect.timeout(GOOGLE_DEADLINE),
      Effect.mapError(() => new GoogleFailed({ reason: "unreached" }))
    );
  if (response.status === 401) {
    return yield* new GoogleFailed({ reason: "revoked", status: 401 });
  }
  if (response.status < 200 || response.status >= 300) {
    return yield* new GoogleFailed({
      reason: "refused",
      status: response.status,
    });
  }
  return yield* response.text.pipe(
    Effect.mapError(() => new GoogleFailed({ reason: "unreached" }))
  );
}, Effect.scoped);

/** Decodes one Classroom answer, whose shape not matching fails as `invalid`. */
const decoded =
  <S extends Schema.Top>(answer: S) =>
  (text: string) =>
    Schema.decodeUnknownEffect(Schema.fromJsonString(answer))(text).pipe(
      Effect.mapError(() => new GoogleFailed({ reason: "invalid" }))
    );

/** The active courses the connected account teaches. */
export const teacherCourses = (accessToken: string) =>
  readClassroom(accessToken, "courses", {
    courseStates: "ACTIVE",
    pageSize: String(CLASSROOM_PAGE),
    teacherId: "me",
  }).pipe(
    Effect.flatMap(
      decoded(
        Schema.Struct({
          courses: Schema.optionalKey(Schema.Array(CourseAnswer)),
        })
      )
    ),
    Effect.map((answer) =>
      Arr.map(answer.courses ?? [], (course): typeof ClassroomCourse.Type => ({
        courseId: course.id,
        name: course.name,
        section: course.section ?? null,
      }))
    )
  );

/** The instant a piece of coursework is due, in UTC; the end of its day when it names no time. */
const deadlineOf = (work: typeof CourseWorkAnswer.Type) =>
  Option.flatMap(Option.fromUndefinedOr(work.dueDate), (due) =>
    Option.map(
      DateTime.make({
        day: due.day,
        month: due.month,
        year: due.year,
        ...(work.dueTime === undefined
          ? END_OF_DAY
          : {
              hours: work.dueTime.hours ?? 0,
              minutes: work.dueTime.minutes ?? 0,
            }),
      }),
      DateTime.toEpochMillis
    )
  );

/**
 * The published coursework of one course that has a deadline, which an import
 * turns into tasks. A draft, a deleted piece, and a piece without a due date are
 * left out.
 */
export const courseWork = (accessToken: string, courseId: string) =>
  readClassroom(
    accessToken,
    `courses/${encodeURIComponent(courseId)}/courseWork`,
    { pageSize: String(CLASSROOM_PAGE) }
  ).pipe(
    Effect.flatMap(
      decoded(
        Schema.Struct({
          courseWork: Schema.optionalKey(Schema.Array(CourseWorkAnswer)),
        })
      )
    ),
    Effect.map((answer) =>
      Arr.getSomes(
        Arr.map(answer.courseWork ?? [], (work) =>
          work.state !== undefined && work.state !== "PUBLISHED"
            ? Option.none()
            : Option.map(
                deadlineOf(work),
                (deadline): typeof ClassroomWork.Type => ({
                  deadline,
                  points: work.maxPoints ?? 0,
                  text: work.description ?? "",
                  title: work.title,
                  workId: work.id,
                })
              )
        )
      )
    )
  );

/** How many students one course has, up to `CLASSROOM_PAGE`. */
export const courseStudents = (accessToken: string, courseId: string) =>
  readClassroom(
    accessToken,
    `courses/${encodeURIComponent(courseId)}/students`,
    { pageSize: String(CLASSROOM_PAGE) }
  ).pipe(
    Effect.flatMap(
      decoded(
        Schema.Struct({
          students: Schema.optionalKey(
            Schema.Array(Schema.Struct({ userId: Schema.NonEmptyString }))
          ),
        })
      )
    ),
    Effect.map((answer) => (answer.students ?? []).length)
  );
