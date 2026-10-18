"use client";

import { ReasonCode } from "@repo/backend/confect/exams/sittings/schema";
import { Button } from "@repo/design-system/components/ui/button";
import { Field, FieldLabel } from "@repo/design-system/components/ui/field";
import { Input } from "@repo/design-system/components/ui/input";
import { ResponsiveDialog } from "@repo/design-system/components/ui/responsive-dialog";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/design-system/components/ui/select";
import { Array as Arr, Option, Schema } from "effect";
import { useTranslations } from "next-intl";
import { useState } from "react";
import {
  runSittingCall,
  useAddMinutes,
  useAllowDevice,
  useChangeToken,
  useCloseSitting,
  useLockAttempt,
  useUnlockAttempt,
} from "@/components/exams/sitting/actions.client";
import type { DashboardAttempt } from "@/components/exams/sitting/change";
import { useSittingData } from "@/components/exams/sitting/context";
import { parseMinutes } from "@/components/exams/sitting/minutes";

/** One reason a proctor gives for an action, as the server names it. */
type Reason = typeof ReasonCode.Type;

/** The props of a dialog about one attempt: the attempt and the student's name, and whether it is open. */
interface AttemptDialogProps {
  readonly attemptId: DashboardAttempt["id"];
  readonly name: string;
  readonly onOpenChange: (open: boolean) => void;
  readonly open: boolean;
}

/** The cancel and confirm buttons that close every dialog, in its one footer row. */
function ConfirmActions({
  confirm,
  destructive = false,
  disabled = false,
  onCancel,
  onConfirm,
}: {
  readonly confirm: string;
  readonly destructive?: boolean;
  readonly disabled?: boolean;
  readonly onCancel: () => void;
  readonly onConfirm: () => void;
}) {
  const tCommon = useTranslations("Common");

  return (
    <>
      <Button onClick={onCancel} type="button" variant="outline">
        {tCommon("cancel")}
      </Button>
      <Button
        disabled={disabled}
        onClick={onConfirm}
        type="button"
        variant={destructive ? "destructive" : "default"}
      >
        {confirm}
      </Button>
    </>
  );
}

/** The reason of an action, chosen from the six codes that the journal holds. */
function ReasonSelect({
  onValueChange,
  value,
}: {
  readonly onValueChange: (reason: Reason) => void;
  readonly value: Reason | null;
}) {
  const t = useTranslations("Exams");
  const items = Arr.map(ReasonCode.literals, (code) => ({
    label: t(`reason-${code}`),
    value: code,
  }));

  return (
    <Field>
      <FieldLabel>{t("reason")}</FieldLabel>
      <Select
        items={items}
        onValueChange={(next) => {
          if (Schema.is(ReasonCode)(next)) {
            onValueChange(next);
          }
        }}
        value={value}
      >
        <SelectTrigger className="w-full">
          <SelectValue placeholder={t("reason")} />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {Arr.map(items, (item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </Field>
  );
}

/** Asks before a sitting's token changes. The dashboard shows the new token once the server answers. */
export function ChangeTokenDialog({
  onOpenChange,
  open,
}: {
  readonly onOpenChange: (open: boolean) => void;
  readonly open: boolean;
}) {
  const t = useTranslations("Exams");
  const { sittingId, slug } = useSittingData();
  const changeToken = useChangeToken();

  return (
    <ResponsiveDialog
      description={t("confirm-change-token-description")}
      footer={
        <ConfirmActions
          confirm={t("confirm-change-token-action")}
          onCancel={() => onOpenChange(false)}
          onConfirm={() => {
            onOpenChange(false);
            runSittingCall(() => changeToken({ sittingId, slug }));
          }}
        />
      }
      open={open}
      setOpen={onOpenChange}
      title={t("confirm-change-token-title")}
    />
  );
}

/** Asks before a sitting closes. Every attempt that is not submitted closes at its deadline. */
export function CloseSittingDialog({
  onOpenChange,
  open,
}: {
  readonly onOpenChange: (open: boolean) => void;
  readonly open: boolean;
}) {
  const t = useTranslations("Exams");
  const { sittingId, slug } = useSittingData();
  const closeSitting = useCloseSitting();

  return (
    <ResponsiveDialog
      description={t("confirm-close-description")}
      footer={
        <ConfirmActions
          confirm={t("confirm-close-action")}
          destructive
          onCancel={() => onOpenChange(false)}
          onConfirm={() => {
            onOpenChange(false);
            runSittingCall(() => closeSitting({ sittingId, slug }));
          }}
        />
      }
      open={open}
      setOpen={onOpenChange}
      title={t("confirm-close-title")}
    />
  );
}

/** Asks for a reason before a student's session locks. The server records the reason. */
export function LockDialog({
  attemptId,
  name,
  onOpenChange,
  open,
}: AttemptDialogProps) {
  const t = useTranslations("Exams");
  const { sittingId, slug } = useSittingData();
  const lock = useLockAttempt();
  const [reason, setReason] = useState<Reason | null>(null);

  /** Closes the dialog and forgets the reason, so the next lock starts empty. */
  function changeOpen(next: boolean) {
    if (!next) {
      setReason(null);
    }
    onOpenChange(next);
  }

  return (
    <ResponsiveDialog
      description={t("confirm-lock-description")}
      footer={
        <ConfirmActions
          confirm={t("confirm-lock-action")}
          destructive
          disabled={reason === null}
          onCancel={() => changeOpen(false)}
          onConfirm={() => {
            if (reason === null) {
              return;
            }
            changeOpen(false);
            runSittingCall(() => lock({ attemptId, reason, sittingId, slug }));
          }}
        />
      }
      open={open}
      setOpen={changeOpen}
      title={t("confirm-lock-title", { name })}
    >
      <ReasonSelect onValueChange={setReason} value={reason} />
    </ResponsiveDialog>
  );
}

/** Asks for a reason before a locked session opens. The reason is required. */
export function UnlockDialog({
  attemptId,
  name,
  onOpenChange,
  open,
}: AttemptDialogProps) {
  const t = useTranslations("Exams");
  const { sittingId, slug } = useSittingData();
  const unlock = useUnlockAttempt();
  const [reason, setReason] = useState<Reason | null>(null);

  /** Closes the dialog and forgets the reason, so the next unlock starts empty. */
  function changeOpen(next: boolean) {
    if (!next) {
      setReason(null);
    }
    onOpenChange(next);
  }

  return (
    <ResponsiveDialog
      description={t("confirm-unlock-description")}
      footer={
        <ConfirmActions
          confirm={t("confirm-unlock-action")}
          disabled={reason === null}
          onCancel={() => changeOpen(false)}
          onConfirm={() => {
            if (reason === null) {
              return;
            }
            changeOpen(false);
            runSittingCall(() =>
              unlock({ attemptId, reason, sittingId, slug })
            );
          }}
        />
      }
      open={open}
      setOpen={changeOpen}
      title={t("confirm-unlock-title", { name })}
    >
      <ReasonSelect onValueChange={setReason} value={reason} />
    </ResponsiveDialog>
  );
}

/** Adds whole minutes to a student's deadline, with the reason that the journal records. */
export function AddMinutesDialog({
  attemptId,
  name,
  onOpenChange,
  open,
}: AttemptDialogProps) {
  const t = useTranslations("Exams");
  const { sittingId, slug } = useSittingData();
  const addMinutes = useAddMinutes();
  const [minutesText, setMinutesText] = useState("");
  const [reason, setReason] = useState<Reason | null>(null);
  const minutes = parseMinutes(minutesText);
  const invalid = minutesText !== "" && Option.isNone(minutes);

  /** Closes the dialog and forgets the entry, so the next time starts empty. */
  function changeOpen(next: boolean) {
    if (!next) {
      setMinutesText("");
      setReason(null);
    }
    onOpenChange(next);
  }

  return (
    <ResponsiveDialog
      description={t("confirm-add-minutes-description")}
      footer={
        <ConfirmActions
          confirm={t("confirm-add-minutes-action")}
          disabled={reason === null || Option.isNone(minutes)}
          onCancel={() => changeOpen(false)}
          onConfirm={() => {
            if (reason === null || Option.isNone(minutes)) {
              return;
            }
            changeOpen(false);
            runSittingCall(() =>
              addMinutes({
                attemptId,
                minutes: minutes.value,
                reason,
                sittingId,
                slug,
              })
            );
          }}
        />
      }
      open={open}
      setOpen={changeOpen}
      title={t("confirm-add-minutes-title", { name })}
    >
      <Field>
        <FieldLabel>{t("minutes")}</FieldLabel>
        <Input
          aria-invalid={invalid}
          inputMode="numeric"
          onChange={(event) => setMinutesText(event.currentTarget.value)}
          value={minutesText}
        />
        {invalid ? (
          <p className="text-destructive text-sm">{t("minutes-invalid")}</p>
        ) : null}
      </Field>
      <ReasonSelect onValueChange={setReason} value={reason} />
    </ResponsiveDialog>
  );
}

/** Asks before a second device takes the attempt, which retires the device that holds it now. */
export function AllowDeviceDialog({
  attemptId,
  name,
  onOpenChange,
  open,
}: AttemptDialogProps) {
  const t = useTranslations("Exams");
  const { sittingId, slug } = useSittingData();
  const allowDevice = useAllowDevice();

  return (
    <ResponsiveDialog
      description={t("confirm-allow-device-description")}
      footer={
        <ConfirmActions
          confirm={t("confirm-allow-device-action")}
          onCancel={() => onOpenChange(false)}
          onConfirm={() => {
            onOpenChange(false);
            runSittingCall(() => allowDevice({ attemptId, sittingId, slug }));
          }}
        />
      }
      open={open}
      setOpen={onOpenChange}
      title={t("confirm-allow-device-title", { name })}
    />
  );
}
