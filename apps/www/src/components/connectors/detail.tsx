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
import { type StatusLook, TableStatus } from "@/components/shared/table/status";

/** How each state of a service looks in its detail. */
const STATE_LOOKS = {
  connected: { icon: Tick02Icon, tone: "success" },
  failed: { icon: Alert02Icon, tone: "destructive" },
  locked: { icon: SquareLock02Icon, tone: "neutral" },
  open: { icon: Add01Icon, tone: "neutral" },
  reconnect: { icon: RefreshIcon, tone: "warning" },
  refused: { icon: Alert02Icon, tone: "warning" },
  soon: { icon: Clock01Icon, tone: "neutral" },
} as const satisfies Record<string, StatusLook>;

/**
 * The open service, beside the list on a wide screen and in a sheet on a phone. The page composes its
 * parts as children, so whatever a connector lets a school set stays with the school, and the
 * directory stays one list however many connectors join it.
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

/** The open service's name and its maker. */
export function ServiceHeader() {
  const t = useTranslations("Connectors");
  const { service } = useService();

  return (
    <PaneHeader
      description={t("by", { provider: service.provider })}
      title={t(service.key)}
    />
  );
}

/** The service's logo, while a connection opens no work to show. */
export function ServiceIdle() {
  const t = useTranslations("Connectors");
  const { service, state } = useService();

  return (
    <div className="flex flex-col items-center gap-3 text-center">
      <ServiceTile />
      {service.key === "forms" && Option.contains(state, "open") ? (
        <p className="text-muted-foreground text-sm">
          {t("status-through-drive")}
        </p>
      ) : null}
    </div>
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

/** Ends a connection, which names the service it really ends: Forms ends through Drive. */
function DisconnectAction() {
  const t = useTranslations("Connectors");
  const { connection, service } = useService();
  const [confirming, setConfirming] = useState(false);
  const name = t(service.connector);

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
        {service.key === service.connector
          ? t("disconnect")
          : t("disconnect-service", { name })}
      </Button>
      <DisconnectDialog
        connection={connection.value}
        name={name}
        open={confirming}
        setOpen={setConfirming}
      />
    </>
  );
}
