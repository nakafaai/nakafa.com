import { QueryResult, useMutation, useQuery } from "@confect/react";
import exams from "@repo/backend/confect/_generated/refs/exams";
import type { ScheduleInvalid } from "@repo/backend/confect/exams/sittings/errors";
import {
  RoomName,
  type SittingGroup,
} from "@repo/backend/confect/exams/sittings/schema";
import { Button } from "@repo/design-system/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@repo/design-system/components/ui/field";
import { Input } from "@repo/design-system/components/ui/input";
import { ResponsiveDialog } from "@repo/design-system/components/ui/responsive-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/design-system/components/ui/select";
import { useNavigate } from "@tanstack/react-router";
import {
  Array as Arr,
  DateTime,
  Effect,
  Function as Fn,
  Option,
  Schema,
  String as Str,
} from "effect";
import { useId, useState, useTransition } from "react";
import { useTranslations } from "use-intl";
import { runExamAction, sentAction } from "@/components/tenant/exams/action";
import type { ViewerUnit } from "@/components/tenant/exams/create";
import { useExam } from "@/components/tenant/exams/provider";
import { sittingTimes } from "@/components/tenant/exams/time";

/** The lengths of a sitting in minutes, which the dialog offers. */
const LENGTHS: readonly number[] = [30, 45, 60, 90, 120];

/** The length that a dialog opens with, in minutes. */
const DEFAULT_MINUTES = 60;

/** The audience that stands for the whole unit, beside the cohorts of the unit. */
const UNIT_AUDIENCE = "unit";

/**
 * The refusals that the dialog explains in its body: a question without a key that fits it,
 * and a start that has passed. Any other refusal shows the action-error toast.
 */
const Refusal = Schema.Literals(["keys", "past"]);

/** One refusal that the dialog explains. */
type Refusal = typeof Refusal.Type;

/**
 * The dialog that schedules one sitting of the exam: its unit, its room, its start, and its
 * length. The start is read on the clock of the chosen unit, and it stays as the dialog opened
 * with it when the teacher picks another unit. A refused schedule keeps the dialog open with
 * what the teacher entered.
 */
export function ScheduleSitting({
  onStartsChange,
  starts,
  units,
}: {
  readonly onStartsChange: (starts: string) => void;
  readonly starts: string;
  readonly units: readonly ViewerUnit[];
}) {
  const t = useTranslations("Exams");
  const id = useId();
  const common = useTranslations("Common");
  const navigate = useNavigate();
  const { exam, slug } = useExam();
  const schedule = useMutation(exams.exams.schedule);
  const [open, setOpen] = useState(true);
  const [picked, setPicked] = useState<string | null>(null);
  const [room, setRoom] = useState("");
  const [minutes, setMinutes] = useState(DEFAULT_MINUTES);
  const [audience, setAudience] = useState(UNIT_AUDIENCE);
  const [refusal, setRefusal] = useState<Refusal | null>(null);
  const [pending, startTransition] = useTransition();
  const unitItems = Arr.map(units, (unit) => ({
    label: unit.name,
    value: unit.id,
  }));
  const lengthItems = Arr.map(LENGTHS, (length) => ({
    label: t("length-minutes", { count: length }),
    value: `${length}`,
  }));
  const choice = Option.orElse(
    Arr.findFirst(units, (unit) => unit.id === picked),
    () => Arr.head(units)
  );
  const cohortList = useQuery(
    exams.exams.cohorts,
    Option.isSome(choice) ? { slug, unitId: choice.value.id } : "skip"
  );
  if (QueryResult.isFailure(cohortList)) {
    throw cohortList.error;
  }
  const cohorts = QueryResult.isSuccess(cohortList) ? cohortList.value : [];
  const audienceItems = [
    { label: t("audience-unit"), value: UNIT_AUDIENCE },
    ...Arr.map(cohorts, (cohort) => ({
      label: cohort.name,
      value: cohort.id,
    })),
  ];
  const zone = Option.flatMap(choice, (unit) =>
    DateTime.zoneMakeNamed(unit.timeZone)
  );
  const times = Option.flatMap(zone, (named) =>
    sittingTimes(starts, minutes, named)
  );
  const roomName = Str.trim(room);
  // The numbers of the questions that have no correct answer yet, in the order of the exam.
  const missingKeys = Arr.flatMap(exam.questions, (question, index) =>
    question.key === null ? [index + 1] : []
  );
  const keysMissing = !Arr.isReadonlyArrayEmpty(missingKeys);
  const ready =
    Option.isSome(choice) &&
    Option.isSome(times) &&
    Schema.is(RoomName)(roomName) &&
    !keysMissing &&
    !pending;

  /** The server refused the schedule because a question has no key that fits it: the body says so. */
  const refuseKeys = () =>
    Effect.sync(() => {
      setRefusal("keys");
    });

  /**
   * The server refused the start. A start that has passed stays in the body. Any other refusal of
   * the start fails on, to the action-error toast.
   */
  const refuseStart = (error: ScheduleInvalid) =>
    error.reason === "opensAt"
      ? Effect.sync(() => {
          setRefusal("past");
        })
      : Effect.fail(error);

  /**
   * Schedules the sitting. The dialog stays open, with its Schedule button off, until the server
   * answers: a saved sitting closes the dialog and opens the exam's rooms, where the room shows,
   * and a refused one keeps what the teacher entered and says why. Any other failure shows the
   * action-error toast.
   */
  const submit = () => {
    if (!ready || Option.isNone(choice) || Option.isNone(times)) {
      return;
    }
    const { closesAt, opensAt } = times.value;
    const unitId = choice.value.id;
    const group: typeof SittingGroup.Type = Option.match(
      Arr.findFirst(cohorts, (cohort) => cohort.id === audience),
      {
        onNone: () => ({ kind: "unit", unitId }),
        onSome: (cohort) => ({ cohortId: cohort.id, kind: "cohort" }),
      }
    );
    setRefusal(null);
    startTransition(async () => {
      await runExamAction(
        sentAction(() =>
          schedule({
            closesAt,
            examId: exam.id,
            group,
            opensAt,
            room: roomName,
            slug,
          })
        ).pipe(
          Effect.tap(() =>
            Effect.sync(() => {
              setOpen(false);
              navigate({
                params: { exam: exam.id, slug },
                to: "/school/$slug/exams/$exam",
              });
            })
          ),
          Effect.catchTags({
            KeysMissing: refuseKeys,
            ScheduleInvalid: refuseStart,
          })
        ),
        { onFailure: Fn.constVoid, onSuccess: Fn.constVoid }
      );
    });
  };

  return (
    <ResponsiveDialog
      description={t("schedule-description")}
      footer={
        <>
          <ScheduleNotices
            keysMissing={keysMissing}
            missingKeys={missingKeys}
            refusal={refusal}
          />
          <Button onClick={() => setOpen(false)} variant="outline">
            {common("cancel")}
          </Button>
          <Button disabled={!ready} onClick={submit}>
            {t("schedule")}
          </Button>
        </>
      }
      open={open}
      setOpen={setOpen}
      title={t("schedule-title")}
    >
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor={`${id}-unit`}>{t("unit")}</FieldLabel>
          <Select
            items={unitItems}
            onValueChange={(key) => {
              setPicked(key);
              setAudience(UNIT_AUDIENCE);
            }}
            value={Option.getOrNull(Option.map(choice, (unit) => unit.id))}
          >
            <SelectTrigger className="w-full" id={`${id}-unit`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Arr.map(unitItems, (item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        {Arr.isReadonlyArrayNonEmpty(cohorts) ? (
          <Field>
            <FieldLabel htmlFor={`${id}-audience`}>{t("audience")}</FieldLabel>
            <Select
              items={audienceItems}
              onValueChange={(key) => setAudience(key ?? UNIT_AUDIENCE)}
              value={audience}
            >
              <SelectTrigger className="w-full" id={`${id}-audience`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Arr.map(audienceItems, (item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        ) : null}
        <Field>
          <FieldLabel htmlFor={`${id}-room`}>{t("room")}</FieldLabel>
          <Input
            id={`${id}-room`}
            onChange={(event) => setRoom(event.target.value)}
            placeholder={t("room-placeholder")}
            value={room}
          />
          {roomName === "" ? (
            <FieldDescription>{t("room-needed")}</FieldDescription>
          ) : null}
        </Field>
        <div className="grid grid-cols-1 gap-7 sm:grid-cols-2 sm:gap-4">
          <Field>
            <FieldLabel htmlFor={`${id}-starts`}>{t("starts")}</FieldLabel>
            <Input
              id={`${id}-starts`}
              onChange={(event) => onStartsChange(event.target.value)}
              type="datetime-local"
              value={starts}
            />
            {Option.isSome(choice) && Option.isSome(times) ? (
              <FieldDescription>{choice.value.timeZone}</FieldDescription>
            ) : (
              <FieldDescription>{t("starts-needed")}</FieldDescription>
            )}
          </Field>
          <Field>
            <FieldLabel htmlFor={`${id}-length`}>{t("length")}</FieldLabel>
            <Select
              items={lengthItems}
              onValueChange={(value) => {
                const next = Arr.findFirst(
                  LENGTHS,
                  (length) => `${length}` === value
                );
                if (Option.isSome(next)) {
                  setMinutes(next.value);
                }
              }}
              value={`${minutes}`}
            >
              <SelectTrigger className="w-full" id={`${id}-length`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Arr.map(lengthItems, (item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>
      </FieldGroup>
    </ResponsiveDialog>
  );
}

/**
 * The sentences at the foot of the dialog that explain why the schedule is not made yet: the questions that
 * have no key, the refusal of a key that does not fit a question, and a start that has passed.
 */
function ScheduleNotices({
  keysMissing,
  missingKeys,
  refusal,
}: {
  readonly keysMissing: boolean;
  readonly missingKeys: readonly number[];
  readonly refusal: Refusal | null;
}) {
  const t = useTranslations("Exams");

  return (
    <>
      {keysMissing || refusal === "keys" ? (
        <p className="me-auto text-muted-foreground text-sm">
          {keysMissing
            ? t("schedule-keys-numbered", {
                count: missingKeys.length,
                questions: Arr.join(
                  Arr.map(missingKeys, (number) => `${number}`),
                  ", "
                ),
              })
            : t("schedule-keys")}
        </p>
      ) : null}
      {refusal === "past" ? (
        <p className="me-auto text-muted-foreground text-sm">
          {t("schedule-past")}
        </p>
      ) : null}
    </>
  );
}
