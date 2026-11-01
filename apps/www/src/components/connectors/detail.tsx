import {
  Add01Icon,
  Alert02Icon,
  Clock01Icon,
  RefreshIcon,
  SquareLock02Icon,
  Tick02Icon,
  Unlink02Icon,
} from "@hugeicons/core-free-icons";
import { Button } from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { Spinner } from "@repo/design-system/components/ui/spinner";
import type { ActSchema } from "@repo/mascot/nina/act";
import { Array as Arr, Option } from "effect";
import { type ReactNode, useState, useTransition } from "react";
import { useTranslations } from "use-intl";
import { useConnectorActions } from "@/components/connectors/actions";
import { ServiceTile } from "@/components/connectors/card";
import {
  CONNECTABLE,
  type DirectoryEntry,
} from "@/components/connectors/directory";
import { DisconnectDialog } from "@/components/connectors/disconnect";
import { ServiceContext, useService } from "@/components/connectors/service";
import { PaneHeader } from "@/components/shared/pane";
import { usePanes } from "@/components/shared/panes";
import { TableEmpty } from "@/components/shared/table/frame";
import { type StatusLook, TableStatus } from "@/components/shared/table/status";

/** How each state of a service looks in its detail, and what Nina does in its body. */
const STATE_LOOKS = {
  connected: { act: "relaxed", icon: Tick02Icon, tone: "success" },
  failed: { act: "searching", icon: Alert02Icon, tone: "destructive" },
  locked: { act: "reading", icon: SquareLock02Icon, tone: "neutral" },
  open: { act: "waving", icon: Add01Icon, tone: "neutral" },
  reconnect: { act: "searching", icon: RefreshIcon, tone: "warning" },
  refused: { act: "thinking", icon: Alert02Icon, tone: "warning" },
  soon: { act: "reading", icon: Clock01Icon, tone: "neutral" },
} as const satisfies Record<
  string,
  StatusLook & { act: typeof ActSchema.Type }
>;

/**
 * The open service, beside the list on a wide screen and in a sheet on a phone. The page composes its
 * parts as children, one anatomy for every connector: a header of its tile and name as on its card, a
 * body that a table or an empty state fills, and a footer of every badge and button. Whatever a
 * connector lets a school set stays with the school, and the directory stays one list however many
 * connectors join it.
 */
export function ServiceDetail({
  children,
  entries,
}: {
  children: ReactNode;
  entries: readonly (typeof DirectoryEntry.Type)[];
}) {
  const open = usePanes((state) => state.open);
  const entry = Option.flatMap(open, (key) =>
    Arr.findFirst(entries, ({ service }) => service.key === key)
  );

  if (Option.isNone(entry)) {
    return null;
  }

  return <ServiceContext value={entry.value}>{children}</ServiceContext>;
}

/** The open service's tile, name and maker, as on its card. */
export function ServiceHeader() {
  const t = useTranslations("Connectors");
  const { service } = useService();

  return (
    <PaneHeader
      description={t("by", { provider: service.provider })}
      icon={<ServiceTile />}
      title={t(service.key)}
    />
  );
}

/**
 * Nina saying where a service stands, while its connection opens no work to show: the same words for
 * every connector in a state, which only its line changes.
 */
export function ServiceEmpty() {
  const t = useTranslations("Connectors");
  const { service, state } = useService();

  if (Option.isNone(state)) {
    return null;
  }
  const line = t(`${service.key}-line`);

  return (
    <TableEmpty
      act={STATE_LOOKS[state.value].act}
      description={
        {
          connected: line,
          failed: t("status-failed"),
          locked: t("status-locked"),
          open: line,
          reconnect: t("reconnect-hint"),
          refused: t("status-refused"),
          soon: t("status-soon"),
        }[state.value]
      }
      title={t(`pane-${state.value}`)}
    />
  );
}

/** Where the service stands, with what else the page says of it beside the state. */
export function ServiceStatus({ children }: { children?: ReactNode }) {
  const t = useTranslations("Connectors");
  const { state } = useService();

  return (
    <div className="me-auto flex min-w-0 flex-wrap gap-2">
      {Option.isSome(state) ? (
        <TableStatus
          band
          icon={STATE_LOOKS[state.value].icon}
          label={t(`state-${state.value}`)}
          tone={STATE_LOOKS[state.value].tone}
        />
      ) : null}
      {children}
    </div>
  );
}

/** What a service asks for next: a way out of its connection, then its connect. */
export function ServiceActions() {
  const { state } = useService();
  const startsConnect = Option.exists(
    state,
    (now) => now === "reconnect" || Arr.contains(CONNECTABLE, now)
  );

  return (
    <>
      <DisconnectAction />
      {startsConnect ? <ConnectAction /> : null}
    </>
  );
}

/** Starts a connect, or brings a lost connection back. */
function ConnectAction() {
  const t = useTranslations("Connectors");
  const { service, state } = useService();
  const { connect } = useConnectorActions();
  const [isConnecting, startConnecting] = useTransition();
  const again = Option.contains(state, "reconnect");

  return (
    <Button
      disabled={isConnecting}
      onClick={() => startConnecting(() => connect(service.connector))}
      type="button"
    >
      <Spinner
        icon={again ? RefreshIcon : Add01Icon}
        isLoading={isConnecting}
      />
      {t(again ? "reconnect" : "connect")}
    </Button>
  );
}

/** Ends a connection. Its dialog names the service it really ends: Forms ends through Drive. */
function DisconnectAction() {
  const t = useTranslations("Connectors");
  const { connection, service } = useService();
  const [confirming, setConfirming] = useState(false);

  if (Option.isNone(connection)) {
    return null;
  }

  return (
    <>
      <Button
        onClick={() => setConfirming(true)}
        type="button"
        variant="outline"
      >
        <HugeIcons icon={Unlink02Icon} />
        {t("disconnect")}
      </Button>
      <DisconnectDialog
        connection={connection.value}
        name={t(service.connector)}
        open={confirming}
        setOpen={setConfirming}
      />
    </>
  );
}
