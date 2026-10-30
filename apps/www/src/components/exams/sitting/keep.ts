import { ExamResponse } from "@repo/backend/confect/exams/sittings/response";
import { Array as Arr, Option } from "effect";
import { keptAnswers } from "@/components/player/keep";

/** The kept answers of School sittings, each an `ExamResponse`. */
const sittingAnswers = keptAnswers(ExamResponse);

/**
 * What the browser keeps for one sitting attempt: the answers the server has not confirmed, by question, under
 * the one entry that names its sitting and the attempt.
 * An entry leaves the browser in one of two ways. The student's finish drops it once the server confirms the
 * finish, and the student's home drops the entries of the attempts that its list shows as submitted, because
 * the list comes from the server. An entry for an attempt that no list shows as submitted stays until the
 * browser clears its storage. Dropping it sooner could lose answers that the server has not confirmed, and
 * the storage cannot list its keys to find the entries of the sittings that a list no longer shows.
 */
export const keptAttempt = (sittingId: string, attemptId: string) =>
  sittingAnswers(`nakafa-sitting-kept:${sittingId}:${attemptId}`);

/**
 * The sitting and the attempt of each row of a student's list that shows its attempt as submitted, which
 * name the kept state that the browser may drop. A row with no attempt, or with one still open, names none.
 */
export function submittedKeysOf<Sitting, Attempt>(
  rows: readonly {
    readonly attempt: string | null;
    readonly attemptId: Attempt | null;
    readonly id: Sitting;
  }[]
) {
  return Arr.getSomes(
    Arr.map(rows, (row) =>
      row.attempt === "submitted" && row.attemptId !== null
        ? Option.some({ attemptId: row.attemptId, sittingId: row.id })
        : Option.none()
    )
  );
}
