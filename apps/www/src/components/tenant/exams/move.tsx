import { useMutation } from "@confect/react";
import {
  Calendar03Icon,
  Cancel01Icon,
  MoreHorizontalIcon,
} from "@hugeicons/core-free-icons";
import exams from "@repo/backend/confect/_generated/refs/exams";
import type { RoomRow } from "@repo/backend/confect/exams/rooms";
import { RoomName } from "@repo/backend/confect/exams/sittings/schema";
import type { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Button } from "@repo/design-system/components/ui/button";
import { DateTimePicker } from "@repo/design-system/components/ui/date";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@repo/design-system/components/ui/dropdown-menu";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@repo/design-system/components/ui/field";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { Input } from "@repo/design-system/components/ui/input";
import { ResponsiveDialog } from "@repo/design-system/components/ui/responsive-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/design-system/components/ui/select";
import { Array as Arr, DateTime, Option, Schema, String as Str } from "effect";
import { startTransition, useId, useState } from "react";
import { useTranslations } from "use-intl";
import {
  cancelRoomChange,
  rescheduleRoomChange,
} from "@/components/tenant/exams/filter";
import {
  lengthsWith,
  sittingTimes,
  wallClockOf,
} from "@/components/tenant/exams/time";
import { saveSchool } from "@/components/tenant/settings/save";

const SOURCE = "components/tenant/exams/move";

/** One minute, in milliseconds. */
const MINUTE_MS = 60_000;

/** One room of an exam, as the rooms list shows it. */
type Room = typeof RoomRow.Type;

/**
 * The row menu of a room that the viewer may change before it opens: Reschedule opens the room's times and name in
 * a dialog, and Cancel removes the room behind a confirmation. A room that has opened, or closed, or that another
 * Person scheduled, has no menu.
 */
export function RoomMenu({ room, slug }: { room: Room; slug: TenantSlug }) {
  const t = useTranslations("Exams");
  const common = useTranslations("Common");
  const cancel = useMutation(exams.sittings.cancel).withOptimisticUpdate(
    cancelRoomChange
  );
  // Each opening of the move is a dialog of its own, so its fields start from the room as it is then.
  const [moves, setMoves] = useState(0);
  const [isCancelling, setIsCancelling] = useState(false);

  return (
    <div className="flex justify-end">
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              aria-label={common("more-actions")}
              size="icon-sm"
              variant="ghost"
            >
              <HugeIcons icon={MoreHorizontalIcon} />
            </Button>
          }
        />
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuItem onClick={() => setMoves((count) => count + 1)}>
            <HugeIcons icon={Calendar03Icon} />
            {t("room-move")}
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => setIsCancelling(true)}
            variant="destructive"
          >
            <HugeIcons icon={Cancel01Icon} />
            {t("room-cancel")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {moves === 0 ? null : (
        <RoomMoveDialog key={moves} room={room} slug={slug} />
      )}
      <ResponsiveDialog
        description={t("room-cancel-description")}
        footer={
          <>
            <Button
              onClick={() => setIsCancelling(false)}
              type="button"
              variant="outline"
            >
              {common("cancel")}
            </Button>
            <Button
              onClick={() => {
                setIsCancelling(false);
                startTransition(() =>
                  saveSchool(() => cancel({ sittingId: room.id, slug }), SOURCE)
                );
              }}
              type="button"
              variant="destructive"
            >
              {t("room-cancel-confirm")}
            </Button>
          </>
        }
        open={isCancelling}
        setOpen={setIsCancelling}
        title={t("room-cancel-title")}
      />
    </div>
  );
}

/**
 * The dialog that moves a room: its name, its start on the clock of its unit, and its length, each filled in with the
 * room as it is. Save waits for a change, and the room shows at its new time at once; a start that has passed is
 * refused by the server in one sentence. The dialog stays mounted while it closes, so its body never empties.
 */
function RoomMoveDialog({ room, slug }: { room: Room; slug: TenantSlug }) {
  const t = useTranslations("Exams");
  const common = useTranslations("Common");
  const id = useId();
  const reschedule = useMutation(
    exams.sittings.reschedule
  ).withOptimisticUpdate(rescheduleRoomChange);
  const zone = DateTime.zoneMakeNamed(room.timeZone);
  const minutesNow = Math.round((room.closesAt - room.opensAt) / MINUTE_MS);
  const [open, setOpen] = useState(true);
  // Each field holds only what the viewer typed or picked, and shows the room as it is until then.
  const [editedName, setName] = useState<string | null>(null);
  const [editedStarts, setStarts] = useState<string | null>(null);
  const [editedMinutes, setMinutes] = useState<number | null>(null);
  const name = editedName ?? room.room;
  const starts =
    editedStarts ??
    Option.match(zone, {
      onNone: () => "",
      onSome: (named) => wallClockOf(room.opensAt, named),
    });
  const minutes = editedMinutes ?? minutesNow;
  const lengthItems = Arr.map(lengthsWith(minutesNow), (length) => ({
    label: t("length-minutes", { count: length }),
    value: `${length}`,
  }));
  const roomName = Str.trim(name);
  const times = Option.flatMap(zone, (named) =>
    sittingTimes(starts, minutes, named)
  );
  const changed =
    roomName !== room.room ||
    Option.exists(
      times,
      (next) => next.opensAt !== room.opensAt || next.closesAt !== room.closesAt
    );
  const ready =
    Option.isSome(times) && Schema.is(RoomName)(roomName) && changed;

  const save = () => {
    if (Option.isNone(times) || !Schema.is(RoomName)(roomName)) {
      return;
    }
    setOpen(false);
    startTransition(() =>
      saveSchool(
        () =>
          reschedule({
            closesAt: times.value.closesAt,
            opensAt: times.value.opensAt,
            room: roomName,
            sittingId: room.id,
            slug,
          }),
        SOURCE
      )
    );
  };

  return (
    <ResponsiveDialog
      description={t("room-move-description")}
      footer={
        <>
          <Button
            onClick={() => setOpen(false)}
            type="button"
            variant="outline"
          >
            {common("cancel")}
          </Button>
          <Button disabled={!ready} onClick={save} type="button">
            {t("room-move-save")}
          </Button>
        </>
      }
      open={open}
      setOpen={setOpen}
      title={t("room-move")}
    >
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor={`${id}-room`}>{t("room")}</FieldLabel>
          <Input
            id={`${id}-room`}
            onChange={(event) => setName(event.target.value)}
            placeholder={t("room-placeholder")}
            value={name}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor={`${id}-starts`}>{t("starts")}</FieldLabel>
          <DateTimePicker
            dayPlaceholder={t("starts-day-placeholder")}
            id={`${id}-starts`}
            onValueChange={setStarts}
            timePlaceholder={t("starts-time-placeholder")}
            value={starts}
          />
          <FieldDescription>{room.timeZone}</FieldDescription>
        </Field>
        <Field>
          <FieldLabel htmlFor={`${id}-length`}>{t("length")}</FieldLabel>
          <Select
            items={lengthItems}
            onValueChange={(value) => {
              const next = Arr.findFirst(
                lengthsWith(minutesNow),
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
      </FieldGroup>
    </ResponsiveDialog>
  );
}
