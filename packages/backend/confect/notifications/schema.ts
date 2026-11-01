import type { NotificationsDoc } from "@repo/backend/confect/_generated/docs";
import { Id } from "@repo/backend/confect/_generated/id";
import { ObjectRef } from "@repo/backend/confect/access/catalog";
import { SubjectView } from "@repo/backend/confect/journal/schema";
import { TenantProfile } from "@repo/backend/confect/tenancy/schema";
import { UserPicture } from "@repo/backend/confect/users/picture";
import { MascotCode } from "@repo/mascot/code";
import { Schema } from "effect";

/** What every inbox row holds: its recipient Person, its school, its subject, and when it came and was read. */
const rowFields = {
  createdAt: Schema.Finite,
  readAt: Schema.optionalKey(Schema.Finite),
  recipientPersonId: Id("tenantPeople"),
  subject: ObjectRef,
  tenantId: Id("tenants"),
};

/**
 * The row of one invitation for its Person. A resend refreshes the row of its
 * invitation rather than adding one, so the row shows the latest entry that sent
 * the invitation.
 */
const InvitationRow = Schema.Struct({
  ...rowFields,
  changeType: Schema.Literal("person.invited"),
  inviteId: Id("tenantInvites"),
  journalEntryId: Id("journalEntries"),
});

/**
 * The row of one mention of a Person in a class forum, written in the
 * transaction of the message that mentions it (ADR 0025). Its subject is the
 * class.
 */
const MentionRow = Schema.Struct({
  ...rowFields,
  changeType: Schema.Literal("forum.mentioned"),
  messageId: Id("classroomMessages"),
});

/** The row of one class announcement for one member of the class. Its subject is the class. */
const AnnouncementRow = Schema.Struct({
  ...rowFields,
  changeType: Schema.Literal("announcement.posted"),
  postId: Id("classroomPosts"),
});

/** The row of one new task of a class for one member of the class. Its subject is the class. */
const AssignmentRow = Schema.Struct({
  ...rowFields,
  changeType: Schema.Literal("assignment.published"),
  taskId: Id("classroomTasks"),
});

/** The row of a sitting that opens soon, for one student it expects. Its subject is the sitting. */
const ExamStartRow = Schema.Struct({
  ...rowFields,
  changeType: Schema.Literal("exam.starting"),
  sittingId: Id("examSittings"),
});

/**
 * The row of a child's coming sitting, for one guardian with a verified link to the child. Its subject is the
 * sitting, and it names the child, since a guardian can follow more than one.
 */
const ExamReminderRow = Schema.Struct({
  ...rowFields,
  changeType: Schema.Literal("exam.reminder"),
  sittingId: Id("examSittings"),
  studentPersonId: Id("tenantPeople"),
});

/**
 * The row of a released grade, for its student and for each guardian with a verified link to the student. Its subject
 * is the grade, and it names the student, so a guardian's row says whose grade it is.
 */
const GradeReleasedRow = Schema.Struct({
  ...rowFields,
  changeType: Schema.Literal("grade.released"),
  gradeId: Id("classGrades"),
  studentPersonId: Id("tenantPeople"),
});

/**
 * The row of a reply to an account's comment on a lesson or an article. A comment
 * belongs to no school, so the row is addressed to the account (ADR 0027), and it
 * names the reply.
 */
const CommentReplyRow = Schema.Struct({
  changeType: Schema.Literal("comment.replied"),
  commentId: Id("comments"),
  createdAt: Schema.Finite,
  readAt: Schema.optionalKey(Schema.Finite),
  recipientUserId: Id("users"),
});

/**
 * One inbox row: one recipient Person and one invitation, mention, announcement, new task, coming sitting, child's
 * coming sitting, or released grade, told apart by `changeType`. It holds IDs and codes only, and its text is read from its subject when
 * it is opened (ADR 0027).
 */
export const Notification = Schema.Union([
  InvitationRow,
  MentionRow,
  AnnouncementRow,
  AssignmentRow,
  ExamStartRow,
  ExamReminderRow,
  GradeReleasedRow,
  CommentReplyRow,
]);

/** A row addressed to an account, which no school holds. */
export type AccountRow = Extract<
  NotificationsDoc,
  { readonly changeType: "comment.replied" }
>;

/** A row addressed to a Person of a school. */
export type SchoolRow = Exclude<NotificationsDoc, AccountRow>;

/** Whether a row is addressed to an account. */
export const isAccountRow = (row: NotificationsDoc): row is AccountRow =>
  row.changeType === "comment.replied";

/** Whether a row is addressed to a Person of a school. */
export const isSchoolRow = (row: NotificationsDoc): row is SchoolRow =>
  !isAccountRow(row);

/** What a row tells: an invitation, a mention, an announcement, a new task, a coming sitting, or a released grade. */
const NotificationType = Schema.Literals([
  "person.invited",
  "forum.mentioned",
  "announcement.posted",
  "assignment.published",
  "exam.starting",
  "exam.reminder",
  "grade.released",
]);

/**
 * The sitting a sitting row opens, read when the row is read while the sitting still waits to open: the exam's title,
 * its room, when it opens, and, for a guardian, the child it is for.
 */
const ExamDetail = Schema.Struct({
  examTitle: Schema.String,
  opensAt: Schema.Finite,
  room: Schema.String,
  sittingId: Id("examSittings"),
  student: Schema.NullOr(Schema.String),
});

/**
 * The grade a grade row tells of, read when the row is read while the grade stays released: its class's name, and,
 * on a guardian's row, the student's name.
 */
const GradeDetail = Schema.Struct({
  className: Schema.String,
  student: Schema.NullOr(Schema.String),
});

/**
 * The place a class row opens, read from its source when the row is read, while
 * the recipient still reads the class: who did it, the class, and where in the
 * class. A mention opens its message in its channel, or in its discussion; an
 * announcement opens the class home; a task opens its own page.
 */
export const ClassDetail = Schema.Struct({
  actor: Schema.String,
  channelId: Schema.NullOr(Id("classroomChannels")),
  className: Schema.String,
  classSlug: Schema.String,
  discussion: Schema.NullOr(Schema.Int),
  messageId: Schema.NullOr(Id("classroomMessages")),
  task: Schema.NullOr(Schema.String),
});

/**
 * One school's inbox row as the wire shows it, with the school that holds it. A
 * class row carries its detail while the recipient still reads its class and its
 * source still stands, and a sitting row its exam while the sitting still waits to
 * open; otherwise neither.
 */
const SchoolNotificationView = Schema.Struct({
  changeType: NotificationType,
  createdAt: Schema.Finite,
  detail: Schema.NullOr(ClassDetail),
  exam: Schema.NullOr(ExamDetail),
  grade: Schema.NullOr(GradeDetail),
  id: Id("notifications"),
  readAt: Schema.optionalKey(Schema.Finite),
  subject: SubjectView,
  tenant: TenantProfile,
});

/**
 * A reply's inbox row as the wire shows it: the reply it opens, and the public face
 * of who wrote it, read when the row is read, or null once either is gone.
 */
const ReplyNotificationView = Schema.Struct({
  actor: Schema.NullOr(
    Schema.Struct({
      image: Schema.optionalKey(Schema.String),
      mascot: MascotCode,
      name: Schema.String,
      picture: Schema.optionalKey(UserPicture),
    })
  ),
  changeType: Schema.Literal("comment.replied"),
  commentId: Id("comments"),
  createdAt: Schema.Finite,
  id: Id("notifications"),
  readAt: Schema.optionalKey(Schema.Finite),
});

/** One inbox row as the wire shows it, of a school or of the account itself. */
export const NotificationView = Schema.Union([
  SchoolNotificationView,
  ReplyNotificationView,
]);

/**
 * Projects a stored row onto its wire view, with the profile of the school that
 * holds it and the detail its source gives. The read time is set only once a row
 * is read, so an unread row has no `readAt` key at all.
 */
export const notificationView = (
  row: SchoolRow,
  tenant: typeof TenantProfile.Type,
  {
    detail,
    exam,
    grade,
  }: {
    readonly detail: typeof ClassDetail.Type | null;
    readonly exam: typeof ExamDetail.Type | null;
    readonly grade: typeof GradeDetail.Type | null;
  }
) => ({
  changeType: row.changeType,
  createdAt: row.createdAt,
  detail,
  exam,
  grade,
  id: row._id,
  subject: row.subject,
  tenant,
  ...(row.readAt === undefined ? {} : { readAt: row.readAt }),
});

/** Projects a stored reply row onto its wire view, with the name its source gives now. */
export const replyView = (
  row: AccountRow,
  actor: typeof ReplyNotificationView.Type.actor
) => ({
  actor,
  changeType: row.changeType,
  commentId: row.commentId,
  createdAt: row.createdAt,
  id: row._id,
  ...(row.readAt === undefined ? {} : { readAt: row.readAt }),
});
