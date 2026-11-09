import {
  Mail01Icon,
  Notification01Icon,
  NotificationOff01Icon,
  Settings01Icon,
  SmartPhone01Icon,
} from "@hugeicons/core-free-icons";
import type {
  PreferenceChannel,
  SwitchedOff,
} from "@repo/backend/confect/notifications/preference";
import type {
  NoticeKind,
  Relation,
} from "@repo/backend/confect/notifications/rules";
import { Button } from "@repo/design-system/components/ui/button";
import { DropdownMenuCheckboxItem } from "@repo/design-system/components/ui/dropdown-menu";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetPanel,
  SheetTitle,
  SheetTrigger,
} from "@repo/design-system/components/ui/sheet";
import { Switch } from "@repo/design-system/components/ui/switch";
import { cn } from "cn";
import { Array as Arr } from "effect";
import { type ReactNode, use, useOptimistic, useTransition } from "react";
import { useTranslations } from "use-intl";
import { ChoiceContext } from "@/components/notifications/choice";
import { preferenceChoicesOf } from "@/components/notifications/preferences";
import { PushOffer } from "@/components/notifications/push";
import { PageHeaderLabel } from "@/components/shared/page/header";
import { tableColumns } from "@/components/shared/table/columns";
import { DataTable } from "@/components/shared/table/data";
import { TableFrame } from "@/components/shared/table/inset";
import { RowItems } from "@/components/shared/table/menu";
import { TableFiltersProvider } from "@/components/shared/table/toolbar";

/**
 * The header's button and its sheet. The sheet stays mounted while closed, so its content reads the reader's choices
 * with the page and stands in place from the sheet's first frame.
 */
export function NoticePreferences({ children }: { children: ReactNode }) {
  const t = useTranslations("Notifications");

  return (
    <Sheet>
      <SheetTrigger
        render={
          <Button type="button" variant="outline">
            <HugeIcons icon={Settings01Icon} />
            <PageHeaderLabel>{t("preferences")}</PageHeaderLabel>
          </Button>
        }
      />
      <SheetContent className="sm:max-w-xl" keepMounted>
        <SheetHeader>
          <SheetTitle>{t("preferences")}</SheetTitle>
          <SheetDescription>{t("preferences-description")}</SheetDescription>
        </SheetHeader>
        <SheetPanel>{children}</SheetPanel>
        <SheetFooter className="flex-row items-center justify-between gap-4">
          <PushOffer />
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

/** One kind of notice with the channels it uses. */
type Row = ReturnType<typeof preferenceChoicesOf>[number];

/** The columns of the switches. */
const preferenceColumns = tableColumns<Row>();

/** The switches of one relation, each kind in a row, and an empty cell for a channel the kind does not use. */
export function PreferenceTable({
  off,
  relation,
}: {
  /** What this reader switched off. */
  off: readonly (typeof SwitchedOff.Type)[];
  /** How this reader relates to the notices the table lists. */
  relation: typeof Relation.Type;
}) {
  const t = useTranslations("Notifications");
  const channelColumn = (channel: typeof PreferenceChannel.Type) =>
    preferenceColumns.values(
      ({ channels, on }) => {
        if (!Arr.contains(channels, channel)) {
          return "unused";
        }
        return Arr.contains(on, channel) ? "on" : "off";
      },
      {
        cell: (info) =>
          info.getValue() === "unused" ? null : (
            <ChannelSwitch
              channel={channel}
              kind={info.row.original.kind}
              on={info.getValue() === "on"}
            />
          ),
        header: t(`channel-${channel}`),
        id: channel,
        options: [
          { icon: Notification01Icon, label: t("channel-on"), value: "on" },
          {
            icon: NotificationOff01Icon,
            label: t("channel-off"),
            value: "off",
          },
        ],
      }
    );

  return (
    <TableFiltersProvider>
      <TableFrame>
        <DataTable
          columns={[
            preferenceColumns.text(({ kind }) => t(`kind-${kind}`), {
              header: t("preferences-kind"),
              id: "kind",
            }),
            channelColumn("push"),
            channelColumn("email"),
            preferenceColumns.menu(({ row: { original } }) => (
              <RowItems>
                {Arr.map(original.channels, (channel) => (
                  <ChannelItem
                    channel={channel}
                    key={channel}
                    kind={original.kind}
                    on={Arr.contains(original.on, channel)}
                  />
                ))}
              </RowItems>
            )),
          ]}
          data={preferenceChoicesOf(relation, off)}
          plain
          rowId={({ kind }) => kind}
        />
      </TableFrame>
    </TableFiltersProvider>
  );
}

/** The icon of each channel: a push lands on the device, an email in the inbox. */
const channelIcons = {
  email: Mail01Icon,
  push: SmartPhone01Icon,
} as const;

/** One channel of one kind in the row's menu, which saves the same choice as its switch. */
function ChannelItem({
  channel,
  kind,
  on,
}: {
  channel: typeof PreferenceChannel.Type;
  kind: typeof NoticeKind.Type;
  on: boolean;
}) {
  const t = useTranslations("Notifications");
  const save = use(ChoiceContext);
  const [shown, setShown] = useOptimistic(on);
  const [, startSaving] = useTransition();

  return (
    <DropdownMenuCheckboxItem
      checked={shown}
      closeOnClick={false}
      disabled={save === null}
      icon={channelIcons[channel]}
      onCheckedChange={(next) =>
        startSaving(async () => {
          setShown(next);
          await save?.(channel, kind, next);
        })
      }
    >
      {t(`channel-${channel}`)}
    </DropdownMenuCheckboxItem>
  );
}

/** One channel of one kind. It moves at once, and a refused change moves it back. */
function ChannelSwitch({
  channel,
  kind,
  on,
}: {
  channel: typeof PreferenceChannel.Type;
  kind: typeof NoticeKind.Type;
  on: boolean;
}) {
  const t = useTranslations("Notifications");
  const save = use(ChoiceContext);
  const [shown, setShown] = useOptimistic(on);
  const [, startSaving] = useTransition();

  return (
    <Switch
      aria-label={`${t(`kind-${kind}`)}, ${t(`channel-${channel}`)}`}
      checked={shown}
      className={cn(save === null && "invisible")}
      onCheckedChange={(next) =>
        startSaving(async () => {
          setShown(next);
          await save?.(channel, kind, next);
        })
      }
    />
  );
}
