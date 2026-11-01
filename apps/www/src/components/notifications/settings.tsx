import {
  Notification01Icon,
  NotificationOff01Icon,
  Settings01Icon,
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
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { ResponsiveDialog } from "@repo/design-system/components/ui/responsive-dialog";
import { Switch } from "@repo/design-system/components/ui/switch";
import { Array as Arr } from "effect";
import {
  type ReactNode,
  use,
  useOptimistic,
  useState,
  useTransition,
} from "react";
import { useTranslations } from "use-intl";
import { ChoiceContext } from "@/components/notifications/choice";
import { preferenceRowsOf } from "@/components/notifications/preferences";
import { HeaderLabel } from "@/components/shared/breadcrumb/frame";
import { tableColumns } from "@/components/shared/table/columns";
import { DataTable } from "@/components/shared/table/data";
import { TableFrame } from "@/components/shared/table/frame";
import { TableFiltersProvider } from "@/components/shared/table/toolbar";

/** The header's button and its dialog, whose content mounts when it opens, so nothing is read before. */
export function NoticePreferences({ children }: { children: ReactNode }) {
  const t = useTranslations("Notifications");
  const common = useTranslations("Common");
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button onClick={() => setOpen(true)} type="button" variant="outline">
        <HugeIcons icon={Settings01Icon} />
        <HeaderLabel>{t("preferences")}</HeaderLabel>
      </Button>
      <ResponsiveDialog
        description={t("preferences-description")}
        footer={
          <Button onClick={() => setOpen(false)} type="button">
            {common("close")}
          </Button>
        }
        open={open}
        setOpen={setOpen}
        title={t("preferences")}
      >
        {open ? children : null}
      </ResponsiveDialog>
    </>
  );
}

/** One kind of notice with the channels it uses. */
type Row = ReturnType<typeof preferenceRowsOf>[number];

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
  const isOn = (kind: Row["kind"], channel: typeof PreferenceChannel.Type) =>
    !Arr.some(off, (row) => row.kind === kind && row.channel === channel);
  const channelColumn = (channel: typeof PreferenceChannel.Type) =>
    preferenceColumns.values(
      ({ channels, kind }) => {
        if (!Arr.contains(channels, channel)) {
          return "unused";
        }
        return isOn(kind, channel) ? "on" : "off";
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
          ]}
          data={preferenceRowsOf(relation)}
          plain
          rowId={({ kind }) => kind}
        />
      </TableFrame>
    </TableFiltersProvider>
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
      onCheckedChange={(next) =>
        startSaving(async () => {
          setShown(next);
          await save?.(channel, kind, next);
        })
      }
    />
  );
}
