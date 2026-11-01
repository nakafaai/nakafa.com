import { Settings01Icon } from "@hugeicons/core-free-icons";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@repo/design-system/components/ui/table";
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
import { columnAlign } from "@/components/shared/table/align";
import { TableFrame } from "@/components/shared/table/frame";

/** The header's button and its dialog, whose content mounts when it opens, so nothing is read before. */
export function NoticePreferences({ children }: { children: ReactNode }) {
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
        {open ? children : null}
      </ResponsiveDialog>
    </>
  );
}

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
          {Arr.map(preferenceRowsOf(relation), ({ channels, kind }) => (
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
                          off,
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
