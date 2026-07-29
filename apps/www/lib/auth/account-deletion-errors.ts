import { ACCOUNT_DELETION_REQUIRES_SCHOOL_MEMBER_CODE } from "@repo/backend/convex/auth/deletion/constants";
import { accountDeletionRequestPhase } from "@repo/backend/convex/auth/deletion/spec";
import { Schema } from "effect";

export const accountDeletionErrorCode = {
  failed: "ACCOUNT_DELETION_FAILED",
  requestUncertain: "ACCOUNT_DELETION_REQUEST_UNCERTAIN",
  sessionExpired: "ACCOUNT_DELETION_SESSION_EXPIRED",
} as const;

/** Raised when Better Auth cannot complete account deletion. */
export class AccountDeletionFailed extends Schema.TaggedError<AccountDeletionFailed>()(
  "AccountDeletionFailed",
  {
    code: Schema.Literal(accountDeletionErrorCode.failed),
  }
) {}

/** Raised when the browser cannot know whether the server committed deletion. */
export class AccountDeletionRequestUncertain extends Schema.TaggedError<AccountDeletionRequestUncertain>()(
  "AccountDeletionRequestUncertain",
  {
    attemptId: Schema.String,
    code: Schema.Literal(accountDeletionErrorCode.requestUncertain),
    phase: Schema.Literal(
      accountDeletionRequestPhase.preparation,
      accountDeletionRequestPhase.deletion
    ),
  }
) {}

/** Raised when an owned school has no active successor. */
export class AccountDeletionSchoolMemberRequired extends Schema.TaggedError<AccountDeletionSchoolMemberRequired>()(
  "AccountDeletionSchoolMemberRequired",
  {
    code: Schema.Literal(ACCOUNT_DELETION_REQUIRES_SCHOOL_MEMBER_CODE),
  }
) {}

/** Raised when Better Auth requires a fresh session before account deletion. */
export class AccountDeletionSessionExpired extends Schema.TaggedError<AccountDeletionSessionExpired>()(
  "AccountDeletionSessionExpired",
  {
    code: Schema.Literal(accountDeletionErrorCode.sessionExpired),
  }
) {}
