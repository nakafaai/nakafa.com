import { GrantRejected } from "@repo/backend/confect/access/errors";
import { type ToastCopy, toast } from "@repo/design-system/lib/toast/notify";
import { Effect, Option, Record as Rec, type Result, Schema } from "effect";
import { reportClientException } from "@/lib/analytics/client";

/** The copy of a save that the server refuses, which the Toaster shows in the reader's language. */
const SAVE_ERROR: ToastCopy = {
  description: "action-error.description",
  title: "action-error.title",
};

/**
 * The copy of a save that the viewer's access to the school no longer allows. A toast cannot
 * move the viewer to the refused page, so the save says it in the same words, and the refused
 * page's own copy names the admin to ask.
 */
const ACCESS_COPY: ToastCopy = {
  description: "school-refusal-access.description",
  title: "school-refusal-access.title",
};

/**
 * The copy of each typed refusal that a save of the school can meet, by the tag of the error the
 * server returns. Each refusal says what it refused and what fixes it, in one sentence each, so no
 * refusal falls back to the generic error, which a retry could never fix.
 */
const REFUSAL_COPY: Readonly<Record<string, ToastCopy>> = {
  AccessDenied: ACCESS_COPY,
  ActionClosed: {
    description: "school-refusal-action-closed.description",
    title: "school-refusal-action-closed.title",
  },
  AddressInvited: {
    description: "school-refusal-address-invited.description",
    title: "school-refusal-address-invited.title",
  },
  AddressMember: {
    description: "school-refusal-address-member.description",
    title: "school-refusal-address-member.title",
  },
  CardMissing: {
    description: "school-refusal-card-missing.description",
    title: "school-refusal-card-missing.title",
  },
  LinkClosed: {
    description: "school-refusal-guardian-closed.description",
    title: "school-refusal-guardian-closed.title",
  },
  LinkRefused: {
    description: "school-refusal-guardian-link.description",
    title: "school-refusal-guardian-link.title",
  },
  CardRoleRefused: {
    description: "school-refusal-card-role.description",
    title: "school-refusal-card-role.title",
  },
  CohortHasHomeroom: {
    description: "school-refusal-cohort-has-homeroom.description",
    title: "school-refusal-cohort-has-homeroom.title",
  },
  CohortLimit: {
    description: "school-refusal-cohort-limit.description",
    title: "school-refusal-cohort-limit.title",
  },
  CohortNameTaken: {
    description: "school-refusal-cohort-name-taken.description",
    title: "school-refusal-cohort-name-taken.title",
  },
  InviteDomainRefused: {
    description: "school-refusal-invite-domain.description",
    title: "school-refusal-invite-domain.title",
  },
  InviteExpired: {
    description: "school-refusal-invite-expired.description",
    title: "school-refusal-invite-expired.title",
  },
  InviteNotPending: {
    description: "school-refusal-invite-not-pending.description",
    title: "school-refusal-invite-not-pending.title",
  },
  InvitePending: {
    description: "school-refusal-invite-pending.description",
    title: "school-refusal-invite-pending.title",
  },
  InviteRateLimited: {
    description: "school-refusal-invite-rate-limited.description",
    title: "school-refusal-invite-rate-limited.title",
  },
  LoginExists: {
    description: "school-refusal-login-exists.description",
    title: "school-refusal-login-exists.title",
  },
  LoginMissing: {
    description: "school-refusal-login-missing.description",
    title: "school-refusal-login-missing.title",
  },
  LoginNameRefused: {
    description: "school-refusal-login-name-refused.description",
    title: "school-refusal-login-name-refused.title",
  },
  LoginNameTaken: {
    description: "school-refusal-login-name-taken.description",
    title: "school-refusal-login-name-taken.title",
  },
  LogoNotSaved: {
    title: "school-logo-refused.title",
  },
  NotMember: ACCESS_COPY,
  NpsnInvalid: {
    description: "school-refusal-npsn-invalid.description",
    title: "school-refusal-npsn-invalid.title",
  },
  NpsnTaken: {
    description: "school-refusal-npsn-taken.description",
    title: "school-refusal-npsn-taken.title",
  },
  PeriodActive: {
    description: "school-refusal-period-active.description",
    title: "school-refusal-period-active.title",
  },
  PeriodDatesInvalid: {
    description: "school-refusal-period-dates.description",
    title: "school-refusal-period-dates.title",
  },
  PeriodNotActive: {
    description: "school-refusal-period-not-active.description",
    title: "school-refusal-period-not-active.title",
  },
  PeriodOverlaps: {
    description: "school-refusal-period-overlaps.description",
    title: "school-refusal-period-overlaps.title",
  },
  PersonAlreadyPlaced: {
    description: "school-refusal-already-placed.description",
    title: "school-refusal-already-placed.title",
  },
  PersonClaimed: {
    description: "school-refusal-person-claimed.description",
    title: "school-refusal-person-claimed.title",
  },
  PersonGraduated: {
    description: "school-refusal-graduated.description",
    title: "school-refusal-graduated.title",
  },
  PersonNotPlaced: {
    description: "school-refusal-person-not-placed.description",
    title: "school-refusal-person-not-placed.title",
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
  SchoolSeatsPaid: {
    description: "school-refusal-seats-paid.description",
    title: "school-refusal-seats-paid.title",
  },
  PromotionState: {
    description: "school-refusal-promotion-state.description",
    title: "school-refusal-promotion-state.title",
  },
  TeacherHasHomeroom: {
    description: "school-refusal-teacher-has-homeroom.description",
    title: "school-refusal-teacher-has-homeroom.title",
  },
  UnitLimit: {
    description: "school-refusal-unit-limit.description",
    title: "school-refusal-unit-limit.title",
  },
};

/** Each code that a refused grant names, which tells the grant refusals apart. */
type GrantCode = GrantRejected["code"];

/**
 * The copy of each code of a grant the tenant refuses. The grant refusal names several
 * refusals under one tag, so the code tells them apart. Every code has its copy, so the
 * lookup needs no fallback.
 */
const GRANT_REFUSAL_COPY: Readonly<Record<GrantCode, ToastCopy>> = {
  GRANT_LIMIT: {
    description: "school-refusal-grant-limit.description",
    title: "school-refusal-grant-limit.title",
  },
  GRANT_ROLE: {
    description: "school-refusal-grant-role.description",
    title: "school-refusal-grant-role.title",
  },
  GRANT_SCOPE: {
    description: "school-refusal-grant-scope.description",
    title: "school-refusal-grant-scope.title",
  },
  LAST_OWNER: {
    description: "school-refusal-last-owner.description",
    title: "school-refusal-last-owner.title",
  },
  PERSON_INACTIVE: {
    description: "school-refusal-person-inactive.description",
    title: "school-refusal-person-inactive.title",
  },
  PERSON_KIND: {
    description: "school-refusal-person-kind.description",
    title: "school-refusal-person-kind.title",
  },
  SEAT_LIMIT: {
    description: "school-refusal-seat-limit.description",
    title: "school-refusal-seat-limit.title",
  },
  TEMPORARY_ROLE: {
    description: "school-refusal-temporary-role.description",
    title: "school-refusal-temporary-role.title",
  },
};

/** The copy of a refused save: the grant's own copy by its code, or the refusal's copy by its tag. */
function refusalCopyOf(error: { readonly _tag: string }): ToastCopy {
  if (Schema.is(GrantRejected)(error)) {
    return GRANT_REFUSAL_COPY[error.code];
  }
  return Option.getOrElse(Rec.get(REFUSAL_COPY, error._tag), () => SAVE_ERROR);
}

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
                toast.error(refusalCopyOf(error));
              })
            )
          ),
      })
    )
  );
}
