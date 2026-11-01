import { QueryResult, useMutation, useQuery } from "@confect/react";
import { Settings01Icon } from "@hugeicons/core-free-icons";
import notifications from "@repo/backend/confect/_generated/refs/notifications";
import type { PreferenceChannel } from "@repo/backend/confect/notifications/preference";
import type { NoticeKind } from "@repo/backend/confect/notifications/rules";
import { Button } from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { ResponsiveDialog } from "@repo/design-system/components/ui/responsive-dialog";
import { Switch } from "@repo/design-system/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@repo/design-system/components/ui/table";
import { Array as Arr, Option } from "effect";
import { useOptimistic, useState, useTransition } from "react";
import { useTranslations } from "use-intl";
import { useConvexAuth } from "@/components/auth/convex";
import {
  preferenceRowsOf,
  relationOfRole,
} from "@/components/notifications/preferences";
import { columnAlign } from "@/components/shared/table/align";
import { TableFrame } from "@/components/shared/table/frame";
import { useTenant } from "@/components/tenant/context";
import { saveSchool } from "@/components/tenant/settings/save";

const SOURCE = "components/notifications/preferences";

/** The header's button and its dialog: each kind of notice this member gets, with a switch for each channel. */
export function NoticePreferences() {
  const t = useTranslations("Notifications");
  const common = useTranslations("Common");
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button onClick={() => setOpen(true)} type="button" variant="outline">
        <HugeIcons icon={Settings01Icon} />
        <span className="max-sm:sr-only">{t("preferences")}</span>
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
        {open ? <PreferenceTable /> : null}
      </ResponsiveDialog>
    </>
  );
}

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

  return (
    <TableFrame>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className={columnAlign({ align: "start" })}>
              {t("preferences-kind")}
            </TableHead>
            <TableHead className={columnAlign()}>{t("channel-push")}</TableHead>
            <TableHead className={columnAlign()}>
              {t("channel-email")}
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {Arr.map(rows, ({ channels, kind }) => (
            <TableRow key={kind}>
              <TableCell className={columnAlign({ align: "start" })}>
                {t(`kind-${kind}`)}
              </TableCell>
              {Arr.map(["push", "email"] as const, (channel) => (
                <TableCell className={columnAlign()} key={channel}>
                  {Arr.contains(channels, channel) ? (
                    <ChannelSwitch
                      channel={channel}
                      kind={kind}
                      on={
                        !Arr.some(
                          off.value,
                          (row) => row.kind === kind && row.channel === channel
                        )
                      }
                    />
                  ) : null}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableFrame>
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
