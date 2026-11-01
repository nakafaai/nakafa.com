import { QueryResult, useMutation, useQuery } from "@confect/react";
import {
  Notification01Icon,
  NotificationOff01Icon,
  Settings01Icon,
} from "@hugeicons/core-free-icons";
import notifications from "@repo/backend/confect/_generated/refs/notifications";
import type { PreferenceChannel } from "@repo/backend/confect/notifications/preference";
import type { NoticeKind } from "@repo/backend/confect/notifications/rules";
import { Button } from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { ResponsiveDialog } from "@repo/design-system/components/ui/responsive-dialog";
import { Switch } from "@repo/design-system/components/ui/switch";
import { Array as Arr, Option } from "effect";
import { useOptimistic, useState, useTransition } from "react";
import { useTranslations } from "use-intl";
import { useConvexAuth } from "@/components/auth/convex";
import {
  preferenceRowsOf,
  relationOfRole,
} from "@/components/notifications/preferences";
import { tableColumns } from "@/components/shared/table/columns";
import { DataTable } from "@/components/shared/table/data";
import { TableFrame } from "@/components/shared/table/frame";
import { TableFiltersProvider } from "@/components/shared/table/toolbar";
import { useTenant } from "@/components/tenant/context";
import { saveSchool } from "@/components/tenant/settings/save";

const SOURCE = "components/notifications/preferences";

/** The header's button and its dialog: each kind of notice this member gets, with a switch for each channel. */
export function NoticePreferences() {
  const t = useTranslations("Notifications");
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button onClick={() => setOpen(true)} type="button" variant="outline">
        <HugeIcons icon={Settings01Icon} />
        <span className="max-sm:sr-only">{t("preferences")}</span>
      </Button>
      <ResponsiveDialog
        description={t("preferences-description")}
        open={open}
        setOpen={setOpen}
        title={t("preferences")}
      >
        {open ? <PreferenceTable /> : null}
      </ResponsiveDialog>
    </>
  );
}

/** One kind of notice with the channels it uses. */
type Row = ReturnType<typeof preferenceRowsOf>[number];

/** The columns of the switches. */
const preferenceColumns = tableColumns<Row>();

/** The switches, each kind in a row, and an empty cell for a channel the kind does not use. */
function PreferenceTable() {
  const t = useTranslations("Notifications");
  const { role, slug } = useTenant();
  const isSettled = useConvexAuth((auth) => !auth.isLoading);
  const off = useQuery(
    notifications.preferences.list,
    isSettled ? { slug } : "skip"
  );

  if (QueryResult.isFailure(off)) {
    throw off.error;
  }
  if (!QueryResult.isSuccess(off)) {
    return null;
  }
  const rows = preferenceRowsOf(
    relationOfRole(Option.getOrElse(role, () => "teacher"))
  );
  const isOn = (kind: Row["kind"], channel: typeof PreferenceChannel.Type) =>
    !Arr.some(off.value, (row) => row.kind === kind && row.channel === channel);
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
          data={rows}
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
  const { slug } = useTenant();
  const set = useMutation(notifications.preferences.set);
  const [shown, setShown] = useOptimistic(on);
  const [, startSaving] = useTransition();

  return (
    <Switch
      aria-label={`${t(`kind-${kind}`)}, ${t(`channel-${channel}`)}`}
      checked={shown}
      onCheckedChange={(next) =>
        startSaving(async () => {
          setShown(next);
          await saveSchool(
            () => set({ channel, kind, on: next, slug }),
            SOURCE
          );
        })
      }
    />
  );
}
