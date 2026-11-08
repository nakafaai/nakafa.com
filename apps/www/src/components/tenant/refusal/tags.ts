import type { ToastCopy } from "@repo/design-system/lib/toast/notify";

/**
 * The copy of a write that the viewer's access to the school no longer allows. A toast cannot move the viewer to the
 * refused page, so the write says it in the same words, and the refused page's own copy names the admin to ask.
 */
const ACCESS_COPY: ToastCopy = {
  description: "school-refusal-access.description",
  title: "school-refusal-access.title",
};

/**
 * The copy of each typed refusal a write of the school can meet, by the tag of the error the server returns: settings,
 * classes, the forum, exams and records alike. Each says what it refused and what fixes it, so no refusal falls back to
 * the action error, which a retry could never fix.
 */
export const REFUSAL_COPY: Readonly<Record<string, ToastCopy>> = {
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
  AttachmentRefused: {
    description: "classroom-refusal-attachment.description",
    title: "classroom-refusal-attachment.title",
  },
  CardMissing: {
    description: "school-refusal-card-missing.description",
    title: "school-refusal-card-missing.title",
  },
  CardRoleRefused: {
    description: "school-refusal-card-role.description",
    title: "school-refusal-card-role.title",
  },
  ChannelArchived: {
    description: "classroom-refusal-channel-archived.description",
    title: "classroom-refusal-channel-archived.title",
  },
  ChannelFixed: {
    description: "school-refusal-channel-fixed.description",
    title: "school-refusal-channel-fixed.title",
  },
  ChannelLimit: {
    description: "classroom-refusal-channel-limit.description",
    title: "classroom-refusal-channel-limit.title",
  },
  ChannelNameTaken: {
    description: "school-refusal-channel-name-taken.description",
    title: "school-refusal-channel-name-taken.title",
  },
  ClassAddressEmpty: {
    description: "school-refusal-class-address-empty.description",
    title: "school-refusal-class-address-empty.title",
  },
  ClassAmbiguous: {
    description: "school-refusal-class-ambiguous.description",
    title: "school-refusal-class-ambiguous.title",
  },
  ClassLimit: {
    description: "school-refusal-class-limit.description",
    title: "school-refusal-class-limit.title",
  },
  ClassNameTaken: {
    description: "school-refusal-class-name-taken.description",
    title: "school-refusal-class-name-taken.title",
  },
  ClassSubjectNotAllowed: {
    description: "school-refusal-class-subject-not-allowed.description",
    title: "school-refusal-class-subject-not-allowed.title",
  },
  ClassSubjectRequired: {
    description: "school-refusal-class-subject-required.description",
    title: "school-refusal-class-subject-required.title",
  },
  ClassSubjectTaken: {
    description: "school-refusal-class-subject-taken.description",
    title: "school-refusal-class-subject-taken.title",
  },
  CohortGradeOutsideLevel: {
    description: "school-refusal-cohort-grade.description",
    title: "school-refusal-cohort-grade.title",
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
  DeviceUnknown: {
    description: "school-refusal-device-unknown.description",
    title: "school-refusal-device-unknown.title",
  },
  DiscussionsClosed: {
    description: "classroom-refusal-discussions-closed.description",
    title: "classroom-refusal-discussions-closed.title",
  },
  DraftRefused: {
    description: "school-refusal-draft-refused.description",
    title: "school-refusal-draft-refused.title",
  },
  ExamInUse: {
    description: "exam-in-use.description",
    title: "exam-in-use.title",
  },
  FileQuotaReached: {
    description: "forum-file-quota.description",
    title: "forum-file-quota.title",
  },
  FileSizeRefused: {
    description: "classroom-refusal-file-size.description",
    title: "classroom-refusal-file-size.title",
  },
  FileTypeRefused: {
    description: "forum-file-type.description",
    title: "forum-file-type.title",
  },
  FolderCycle: {
    description: "classroom-refusal-folder-cycle.description",
    title: "classroom-refusal-folder-cycle.title",
  },
  FolderLimit: {
    description: "classroom-refusal-folder-limit.description",
    title: "classroom-refusal-folder-limit.title",
  },
  GraduationDateInvalid: {
    description: "school-refusal-graduation-date.description",
    title: "school-refusal-graduation-date.title",
  },
  GraduationIssued: {
    description: "school-refusal-graduation-issued.description",
    title: "school-refusal-graduation-issued.title",
  },
  GraduationNotFinal: {
    description: "school-refusal-graduation-not-final.description",
    title: "school-refusal-graduation-not-final.title",
  },
  GraduationUndecided: {
    description: "school-refusal-graduation-undecided.description",
    title: "school-refusal-graduation-undecided.title",
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
  LinkClosed: {
    description: "school-refusal-guardian-closed.description",
    title: "school-refusal-guardian-closed.title",
  },
  LinkRefused: {
    description: "school-refusal-guardian-link.description",
    title: "school-refusal-guardian-link.title",
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
  MentionRefused: {
    description: "classroom-refusal-mention.description",
    title: "classroom-refusal-mention.title",
  },
  MessageEmpty: {
    description: "classroom-refusal-message-empty.description",
    title: "classroom-refusal-message-empty.title",
  },
  MessageHidden: {
    description: "classroom-refusal-message-hidden.description",
    title: "classroom-refusal-message-hidden.title",
  },
  NotMember: ACCESS_COPY,
  NotOperator: {
    description: "school-refusal-not-operator.description",
    title: "school-refusal-not-operator.title",
  },
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
  PersonClassLimit: {
    description: "school-refusal-person-class-limit.description",
    title: "school-refusal-person-class-limit.title",
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
  PinLimit: {
    description: "classroom-refusal-pin-limit.description",
    title: "classroom-refusal-pin-limit.title",
  },
  PromotionState: {
    description: "school-refusal-promotion-state.description",
    title: "school-refusal-promotion-state.title",
  },
  ProvisionRejected: {
    description: "school-refusal-provision.description",
    title: "school-refusal-provision.title",
  },
  QuestionsUnready: {
    description: "classroom-refusal-questions-unready.description",
    title: "classroom-refusal-questions-unready.title",
  },
  ReactionLimit: {
    description: "classroom-refusal-reaction-limit.description",
    title: "classroom-refusal-reaction-limit.title",
  },
  ReportClosed: {
    description: "school-refusal-report-closed.description",
    title: "school-refusal-report-closed.title",
  },
  ReportNotPlaced: {
    description: "school-refusal-report-not-placed.description",
    title: "school-refusal-report-not-placed.title",
  },
  RoomOpened: {
    description: "school-refusal-room-opened.description",
    title: "school-refusal-room-opened.title",
  },
  RosterPeriodMissing: {
    description: "school-roster-no-period.description",
    title: "school-roster-no-period.title",
  },
  ScheduleInvalid: {
    description: "school-refusal-schedule-invalid.description",
    title: "school-refusal-schedule-invalid.title",
  },
  ScheduledLimit: {
    description: "classroom-refusal-scheduled-limit.description",
    title: "classroom-refusal-scheduled-limit.title",
  },
  ScheduledPast: {
    description: "classroom-refusal-scheduled-past.description",
    title: "classroom-refusal-scheduled-past.title",
  },
  SchemeNotLater: {
    description: "school-refusal-scheme-not-later.description",
    title: "school-refusal-scheme-not-later.title",
  },
  SchemeUsed: {
    description: "school-refusal-scheme-used.description",
    title: "school-refusal-scheme-used.title",
  },
  SchoolPlanMissing: {
    description: "school-refusal-plan-missing.description",
    title: "school-refusal-plan-missing.title",
  },
  ScoreOutOfRange: {
    description: "classroom-refusal-score-range.description",
    title: "classroom-refusal-score-range.title",
  },
  TaskClosed: {
    description: "classroom-refusal-task-closed.description",
    title: "classroom-refusal-task-closed.title",
  },
  TaskPointsFixed: {
    description: "classroom-refusal-points-fixed.description",
    title: "classroom-refusal-points-fixed.title",
  },
  TeacherHasHomeroom: {
    description: "school-refusal-teacher-has-homeroom.description",
    title: "school-refusal-teacher-has-homeroom.title",
  },
  UnitLimit: {
    description: "school-refusal-unit-limit.description",
    title: "school-refusal-unit-limit.title",
  },
  UploadGone: {
    description: "classroom-refusal-attachment.description",
    title: "classroom-refusal-attachment.title",
  },
  UploadMissing: {
    description: "classroom-refusal-attachment.description",
    title: "classroom-refusal-attachment.title",
  },
  VoteRefused: {
    description: "classroom-refusal-vote.description",
    title: "classroom-refusal-vote.title",
  },
  WebhookLimit: {
    description: "school-refusal-webhook-limit.description",
    title: "school-refusal-webhook-limit.title",
  },
};
