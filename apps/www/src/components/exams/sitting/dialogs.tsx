import {
  Alert02Icon,
  ComputerIcon,
  Door01Icon,
  FirstAidKitIcon,
  FlashOffIcon,
  MoreHorizontalIcon,
  QrCodeIcon,
  SmartPhone01Icon,
  WifiDisconnected01Icon,
} from "@hugeicons/core-free-icons";
import { ReasonCode } from "@repo/backend/confect/exams/sittings/schema";
import { Button } from "@repo/design-system/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@repo/design-system/components/ui/field";
import { Input } from "@repo/design-system/components/ui/input";
import {
  ResponsiveDialog,
  ResponsiveDialogSubject,
} from "@repo/design-system/components/ui/responsive-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/design-system/components/ui/select";
import { Array as Arr, Option, Schema } from "effect";
import { useId, useState } from "react";
import { useTranslations } from "use-intl";
import {
  runSittingCall,
  useAddMinutes,
  useAllowDevice,
  useChangeToken,
  useCloseSitting,
  useLockAttempt,
  useUnlockAttempt,
} from "@/components/exams/sitting/actions";
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

/** The confirm button of every dialog, beside the Cancel the dialog draws in its footer. */
export function ConfirmAction({
  confirm,
  destructive = false,
  disabled = false,
  onConfirm,
}: {
  readonly confirm: string;
  readonly destructive?: boolean;
  readonly disabled?: boolean;
  readonly onConfirm: () => void;
}) {
  return (
    <Button
      disabled={disabled}
      onClick={onConfirm}
      type="button"
      variant={destructive ? "destructive" : "default"}
    >
      {confirm}
    </Button>
  );
}

/** The icon of each reason a proctor records. */
const reasonIcons = {
  "device-problem": ComputerIcon,
  health: FirstAidKitIcon,
  "network-problem": WifiDisconnected01Icon,
  other: MoreHorizontalIcon,
  "power-outage": FlashOffIcon,
  "rule-break": Alert02Icon,
} satisfies Record<typeof ReasonCode.Type, typeof ComputerIcon>;

/** The reason of an action, chosen from the six codes that the journal holds. */
function ReasonSelect({
  onValueChange,
  value,
}: {
  readonly onValueChange: (reason: Reason) => void;
  readonly value: Reason | null;
}) {
  const t = useTranslations("Exams");
  const common = useTranslations("Common");
  const id = useId();
  const items = Arr.map(ReasonCode.literals, (code) => ({
    label: t(`reason-${code}`),
    value: code,
  }));

  return (
    <Field>
      <FieldLabel htmlFor={id}>{t("reason")}</FieldLabel>
      <Select
        items={items}
        onValueChange={(next) => {
          if (Schema.is(ReasonCode)(next)) {
            onValueChange(next);
          }
        }}
        value={value}
      >
        <SelectTrigger className="w-full" id={id}>
          <SelectValue placeholder={t("pair-choose")} />
        </SelectTrigger>
        <SelectContent label={common("menu-reason")}>
          {Arr.map(items, (item) => (
            <SelectItem
              icon={reasonIcons[item.value]}
              key={item.value}
              value={item.value}
            >
              {item.label}
            </SelectItem>
          ))}
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
  const { sittingId, slug, value } = useSittingData();
  const changeToken = useChangeToken();

  return (
    <ResponsiveDialog
      action={
        <ConfirmAction
          confirm={t("confirm-change-token-action")}
          onConfirm={() => {
            onOpenChange(false);
            runSittingCall(() => changeToken({ sittingId, slug }));
          }}
        />
      }
      description={t("confirm-change-token-description")}
      open={open}
      setOpen={onOpenChange}
      title={t("confirm-change-token-title")}
    >
      <ResponsiveDialogSubject icon={QrCodeIcon}>
        <span className="font-mono tracking-widest tabular-nums" translate="no">
          {value.token}
        </span>
      </ResponsiveDialogSubject>
    </ResponsiveDialog>
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
  const { sittingId, slug, value } = useSittingData();
  const closeSitting = useCloseSitting();

  return (
    <ResponsiveDialog
      action={
        <ConfirmAction
          confirm={t("confirm-close-action")}
          destructive
          onConfirm={() => {
            onOpenChange(false);
            runSittingCall(() => closeSitting({ sittingId, slug }));
          }}
        />
      }
      description={t("confirm-close-description")}
      open={open}
      setOpen={onOpenChange}
      title={t("confirm-close-title")}
    >
      <ResponsiveDialogSubject
        description={value.sitting.room}
        icon={Door01Icon}
      >
        {value.sitting.examTitle}
      </ResponsiveDialogSubject>
    </ResponsiveDialog>
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

  /** Forgets the reason once the dialog has closed, so the next lock starts empty and the closing dialog keeps it. */
  function forget(next: boolean) {
    if (!next) {
      setReason(null);
    }
  }

  return (
    <ResponsiveDialog
      action={
        <ConfirmAction
          confirm={t("confirm-lock-action")}
          destructive
          disabled={reason === null}
          onConfirm={() => {
            if (reason === null) {
              return;
            }
            onOpenChange(false);
            runSittingCall(() => lock({ attemptId, reason, sittingId, slug }));
          }}
        />
      }
      description={t("confirm-lock-description")}
      onOpenChangeComplete={forget}
      open={open}
      setOpen={onOpenChange}
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

  /** Forgets the reason once the dialog has closed, so the next unlock starts empty and the closing dialog keeps it. */
  function forget(next: boolean) {
    if (!next) {
      setReason(null);
    }
  }

  return (
    <ResponsiveDialog
      action={
        <ConfirmAction
          confirm={t("confirm-unlock-action")}
          disabled={reason === null}
          onConfirm={() => {
            if (reason === null) {
              return;
            }
            onOpenChange(false);
            runSittingCall(() =>
              unlock({ attemptId, reason, sittingId, slug })
            );
          }}
        />
      }
      description={t("confirm-unlock-description")}
      onOpenChangeComplete={forget}
      open={open}
      setOpen={onOpenChange}
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
  const minutesId = useId();
  const errorId = useId();
  const [reason, setReason] = useState<Reason | null>(null);
  const minutes = parseMinutes(minutesText);
  const invalid = minutesText !== "" && Option.isNone(minutes);

  /** Forgets the entry once the dialog has closed, so the next time starts empty and the closing dialog keeps it. */
  function forget(next: boolean) {
    if (!next) {
      setMinutesText("");
      setReason(null);
    }
  }

  return (
    <ResponsiveDialog
      action={
        <ConfirmAction
          confirm={t("confirm-add-minutes-action")}
          disabled={reason === null || Option.isNone(minutes)}
          onConfirm={() => {
            if (reason === null || Option.isNone(minutes)) {
              return;
            }
            onOpenChange(false);
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
      description={t("confirm-add-minutes-description")}
      onOpenChangeComplete={forget}
      open={open}
      setOpen={onOpenChange}
      title={t("confirm-add-minutes-title", { name })}
    >
      <FieldGroup>
        <Field data-invalid={invalid}>
          <FieldLabel htmlFor={minutesId}>{t("minutes")}</FieldLabel>
          <Input
            aria-describedby={invalid ? errorId : undefined}
            aria-invalid={invalid}
            id={minutesId}
            inputMode="numeric"
            onChange={(event) => setMinutesText(event.currentTarget.value)}
            placeholder={t("minutes-placeholder")}
            value={minutesText}
          />
          <FieldDescription>{t("minutes-hint")}</FieldDescription>
          <FieldError id={errorId}>
            {invalid ? t("minutes-invalid") : null}
          </FieldError>
        </Field>
        <ReasonSelect onValueChange={setReason} value={reason} />
      </FieldGroup>
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
      action={
        <ConfirmAction
          confirm={t("confirm-allow-device-action")}
          onConfirm={() => {
            onOpenChange(false);
            runSittingCall(() => allowDevice({ attemptId, sittingId, slug }));
          }}
        />
      }
      description={t("confirm-allow-device-description")}
      open={open}
      setOpen={onOpenChange}
      title={t("confirm-allow-device-title", { name })}
    >
      <ResponsiveDialogSubject icon={SmartPhone01Icon}>
        {name}
      </ResponsiveDialogSubject>
    </ResponsiveDialog>
  );
}
