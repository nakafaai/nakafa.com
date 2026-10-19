import { FunctionSpec, GroupSpec } from "@confect/core";
import { PaginationOptions as PaginationOptionsSchema } from "@confect/core/PaginationOptions";
import { LocalIdSchema } from "@nakafa/aksara-contracts/assessment/identity";
import { Id } from "@repo/backend/confect/_generated/id";
import { AccessDenied } from "@repo/backend/confect/access/errors";
import { FoldPending } from "@repo/backend/confect/editor/errors";
import { SittingAccess } from "@repo/backend/confect/exams/sittings/access";
import {
  DashboardView,
  EnterOutcome,
  HeldAttempt,
  PaperView,
  PromptView,
  SignalView,
  StudentSittingRow,
  StudentSittingView,
  TokenResult,
} from "@repo/backend/confect/exams/sittings/contract";
import {
  AttemptClosed,
  AttemptLocked,
  DeviceRetired,
  NotInSitting,
  QuestionNotInExam,
  ResponseDoesNotFit,
  RetiredDevicesFull,
  SecondDevice,
  SittingClosed,
  SittingLocked,
  SittingNotOpen,
} from "@repo/backend/confect/exams/sittings/errors";
import {
  DeviceId,
  Minutes,
  ReasonCode,
  SignalKind,
} from "@repo/backend/confect/exams/sittings/schema";
import { ProctorActionRefused } from "@repo/backend/confect/exams/sittings/state";
import RequireMember from "@repo/backend/confect/middleware/member.spec";
import Session from "@repo/backend/confect/middleware/session.spec";
import { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Schema } from "effect";

/**
 * The proctored sittings of school exams. A student enters with a token, signals, and
 * lists the sittings they may take part in. A proctor reads the dashboard and takes the
 * six actions of ADR 0013, each on the sitting's own access check (round 2 decisions 1-11).
 */
export default GroupSpec.make()
  .middleware(Session)
  .middleware(RequireMember)
  .addFunction(
    FunctionSpec.publicMutation({
      name: "enter",
      args: () => ({
        deviceId: DeviceId,
        sittingId: Id("examSittings"),
        slug: TenantSlug,
        token: Schema.String,
      }),
      returns: () => EnterOutcome,
      error: () =>
        Schema.Union([
          NotInSitting,
          SittingNotOpen,
          SittingClosed,
          SittingLocked,
          AttemptClosed,
          SecondDevice,
          DeviceRetired,
        ]),
    })
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "signal",
      args: () => ({
        attemptId: Id("examAttempts"),
        deviceId: DeviceId,
        kind: SignalKind,
        slug: TenantSlug,
      }),
      returns: () => Schema.Null,
      error: () =>
        Schema.Union([
          NotInSitting,
          SittingLocked,
          AttemptClosed,
          SecondDevice,
          DeviceRetired,
        ]),
    })
  )
  .addFunction(
    FunctionSpec.publicQuery({
      name: "mine",
      args: () => ({ slug: TenantSlug }),
      returns: () => Schema.Array(StudentSittingRow),
      error: () => Schema.Never,
    })
  )
  .addFunction(
    FunctionSpec.publicQuery({
      name: "dashboard",
      args: () => ({
        paginationOpts: PaginationOptionsSchema,
        sittingId: Id("examSittings"),
        slug: TenantSlug,
      }),
      returns: () => DashboardView,
      error: () => AccessDenied,
    }).middleware(SittingAccess, { action: "sitting.view", arg: "sittingId" })
  )
  .addFunction(
    FunctionSpec.publicQuery({
      name: "lastAnswer",
      args: () => ({
        attemptId: Id("examAttempts"),
        sittingId: Id("examSittings"),
        slug: TenantSlug,
      }),
      returns: () => Schema.NullOr(Schema.Finite),
      error: () => AccessDenied,
    }).middleware(SittingAccess, { action: "sitting.view", arg: "sittingId" })
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "lock",
      args: () => ({
        attemptId: Id("examAttempts"),
        reason: ReasonCode,
        sittingId: Id("examSittings"),
        slug: TenantSlug,
      }),
      returns: () => Schema.Null,
      error: () => Schema.Union([AccessDenied, ProctorActionRefused]),
    }).middleware(SittingAccess, {
      action: "sitting.proctor",
      arg: "sittingId",
    })
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "unlock",
      args: () => ({
        attemptId: Id("examAttempts"),
        reason: ReasonCode,
        sittingId: Id("examSittings"),
        slug: TenantSlug,
      }),
      returns: () => Schema.Null,
      error: () => Schema.Union([AccessDenied, ProctorActionRefused]),
    }).middleware(SittingAccess, {
      action: "sitting.proctor",
      arg: "sittingId",
    })
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "addMinutes",
      args: () => ({
        attemptId: Id("examAttempts"),
        minutes: Minutes,
        reason: ReasonCode,
        sittingId: Id("examSittings"),
        slug: TenantSlug,
      }),
      returns: () => Schema.Null,
      error: () => Schema.Union([AccessDenied, ProctorActionRefused]),
    }).middleware(SittingAccess, {
      action: "sitting.proctor",
      arg: "sittingId",
    })
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "allowDevice",
      args: () => ({
        attemptId: Id("examAttempts"),
        sittingId: Id("examSittings"),
        slug: TenantSlug,
      }),
      returns: () => Schema.Null,
      error: () => Schema.Union([AccessDenied, RetiredDevicesFull]),
    }).middleware(SittingAccess, {
      action: "sitting.proctor",
      arg: "sittingId",
    })
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "changeToken",
      args: () => ({ sittingId: Id("examSittings"), slug: TenantSlug }),
      returns: () => TokenResult,
      error: () => AccessDenied,
    }).middleware(SittingAccess, {
      action: "sitting.proctor",
      arg: "sittingId",
    })
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "close",
      args: () => ({ sittingId: Id("examSittings"), slug: TenantSlug }),
      returns: () => Schema.Null,
      error: () => AccessDenied,
    }).middleware(SittingAccess, {
      action: "sitting.proctor",
      arg: "sittingId",
    })
  )
  .addFunction(
    FunctionSpec.publicQuery({
      name: "attempt",
      args: () => ({ sittingId: Id("examSittings"), slug: TenantSlug }),
      returns: () => Schema.NullOr(HeldAttempt),
      error: () => Schema.Never,
    })
  )
  .addFunction(
    FunctionSpec.publicQuery({
      name: "student",
      args: () => ({ sittingId: Id("examSittings"), slug: TenantSlug }),
      returns: () => StudentSittingView,
      error: () => NotInSitting,
    })
  )
  .addFunction(
    FunctionSpec.publicPaginatedQuery({
      name: "signals",
      args: () => ({
        attemptId: Id("examAttempts"),
        sittingId: Id("examSittings"),
        slug: TenantSlug,
      }),
      item: () => SignalView,
      error: () => AccessDenied,
    }).middleware(SittingAccess, { action: "sitting.view", arg: "sittingId" })
  )
  .addFunction(
    FunctionSpec.publicQuery({
      name: "paper",
      args: () => ({
        deviceId: DeviceId,
        sittingId: Id("examSittings"),
        slug: TenantSlug,
      }),
      returns: () => PaperView,
      error: () =>
        Schema.Union([
          NotInSitting,
          SittingLocked,
          AttemptClosed,
          AttemptLocked,
          SecondDevice,
          DeviceRetired,
        ]),
    })
  )
  .addFunction(
    FunctionSpec.publicQuery({
      name: "prompt",
      args: () => ({
        deviceId: DeviceId,
        questionId: Id("examQuestions"),
        sittingId: Id("examSittings"),
        slug: TenantSlug,
      }),
      returns: () => PromptView,
      error: () =>
        Schema.Union([
          NotInSitting,
          SittingLocked,
          AttemptClosed,
          AttemptLocked,
          SecondDevice,
          DeviceRetired,
          QuestionNotInExam,
          FoldPending,
        ]),
    })
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "answer",
      args: () => ({
        deviceId: DeviceId,
        questionId: Id("examQuestions"),
        response: Schema.Array(LocalIdSchema),
        sittingId: Id("examSittings"),
        slug: TenantSlug,
      }),
      returns: () => Schema.Null,
      error: () =>
        Schema.Union([
          NotInSitting,
          SittingLocked,
          AttemptClosed,
          AttemptLocked,
          SecondDevice,
          DeviceRetired,
          QuestionNotInExam,
          ResponseDoesNotFit,
        ]),
    })
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "finish",
      args: () => ({
        deviceId: DeviceId,
        sittingId: Id("examSittings"),
        slug: TenantSlug,
      }),
      returns: () => Schema.Null,
      error: () =>
        Schema.Union([
          NotInSitting,
          SittingLocked,
          AttemptClosed,
          AttemptLocked,
          SecondDevice,
          DeviceRetired,
        ]),
    })
  );
