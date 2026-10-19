"use client";

import { type ToastCopy, toast } from "@repo/design-system/lib/toast/notify";
import { Effect, Option, Record as Rec, type Result } from "effect";
import { reportClientException } from "@/lib/analytics/client";

/** The copy of a save that the server refuses, which the Toaster shows in the reader's language. */
const SAVE_ERROR: ToastCopy = {
  description: "action-error.description",
  title: "action-error.title",
};

/**
 * The copy of each refusal that a student placement or a homeroom save can meet, by the tag of
 * the error the server returns. A refusal with no copy here shows the generic save error.
 */
const REFUSAL_COPY: Readonly<Record<string, ToastCopy>> = {
  AddressMember: {
    description: "school-refusal-address-member.description",
    title: "school-refusal-address-member.title",
  },
  CohortHasHomeroom: {
    description: "school-refusal-cohort-has-homeroom.description",
    title: "school-refusal-cohort-has-homeroom.title",
  },
  PersonAlreadyPlaced: {
    description: "school-refusal-already-placed.description",
    title: "school-refusal-already-placed.title",
  },
  PersonGraduated: {
    description: "school-refusal-graduated.description",
    title: "school-refusal-graduated.title",
  },
  PersonNotStudent: {
    description: "school-refusal-not-student.description",
    title: "school-refusal-not-student.title",
  },
  PersonNotTeacher: {
    description: "school-refusal-not-teacher.description",
    title: "school-refusal-not-teacher.title",
  },
  PersonPlacementLimit: {
    description: "school-refusal-placement-limit.description",
    title: "school-refusal-placement-limit.title",
  },
  UnitLimit: {
    description: "school-refusal-unit-limit.description",
    title: "school-refusal-unit-limit.title",
  },
  TeacherHasHomeroom: {
    description: "school-refusal-teacher-has-homeroom.description",
    title: "school-refusal-teacher-has-homeroom.title",
  },
};

/**
 * Runs one save of the school from a browser event. A save that the server refuses is
 * reported, and the person sees why when the refusal has copy of its own, or the generic
 * error otherwise. An optimistic change steps back by itself, because the server's answer
 * replaces the store.
 */
export function saveSchool<A, E extends { readonly _tag: string }>(
  write: () => Promise<Result.Result<A, E>>,
  source: string,
  onSaved?: (answer: A) => void
) {
  return Effect.runPromise(
    Effect.tryPromise(write).pipe(
      Effect.flatMap(Effect.fromResult),
      Effect.matchEffect({
        onSuccess: (answer) =>
          Effect.sync(() => {
            onSaved?.(answer);
          }),
        onFailure: (error) =>
          reportClientException(error, { source }).pipe(
            Effect.andThen(
              Effect.sync(() => {
                toast.error(
                  Option.getOrElse(
                    Rec.get(REFUSAL_COPY, error._tag),
                    () => SAVE_ERROR
                  )
                );
              })
            )
          ),
      })
    )
  );
}
