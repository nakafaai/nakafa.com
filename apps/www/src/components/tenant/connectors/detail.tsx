import {
  Add01Icon,
  Alert02Icon,
  ArrowRight01Icon,
  Clock01Icon,
  RefreshIcon,
  SquareLock02Icon,
  Tick02Icon,
  Unlink02Icon,
  UserIcon,
} from "@hugeicons/core-free-icons";
import { Button } from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { Spinner } from "@repo/design-system/components/ui/spinner";
import { buttonVariants } from "@repo/design-system/lib/button";
import { Link } from "@tanstack/react-router";
import { Array as Arr, Option } from "effect";
import { useState, useTransition } from "react";
import { useTranslations } from "use-intl";
import { useConnectorActions } from "@/components/connectors/actions";
import {
  CONNECTABLE,
  type DirectoryEntry,
  holderOf,
} from "@/components/connectors/directory";
import { DisconnectDialog } from "@/components/connectors/disconnect";
import { PaneBody, PaneFooter, PaneHeader } from "@/components/shared/pane";
import { usePanes } from "@/components/shared/panes";
import { type StatusLook, TableStatus } from "@/components/shared/table/status";
import { ServiceTile } from "@/components/tenant/connectors/card";
import { ClassroomCourses } from "@/components/tenant/connectors/classroom";
import {
  ServiceContext,
  useService,
} from "@/components/tenant/connectors/service";
import { useTenant } from "@/components/tenant/context";
import { schoolExamsTarget } from "@/lib/routing/school/target";

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
 * The open service, beside the list on a wide screen and in a sheet on a phone. Whatever a connector
 * lets a school set lives here, so the directory stays one list however many connectors join it.
 */
export function ServiceDetail({
  entries,
}: {
  entries: readonly (typeof DirectoryEntry.Type)[];
}) {
  const open = usePanes((state) => state.open);
  const entry = Option.flatMap(open, (key) =>
    Arr.findFirst(entries, ({ service }) => service.key === key)
  );

  if (Option.isNone(entry)) {
    return null;
  }

  return (
    <ServiceContext value={entry.value}>
      <ServicePane />
    </ServiceContext>
  );
}

/** A header of the service's name, a body of what it holds, and a footer of where it stands and what it asks for. */
function ServicePane() {
  const t = useTranslations("Connectors");
  const { service } = useService();

  return (
    <>
      <PaneHeader
        description={t("by", { provider: service.provider })}
        title={t(service.key)}
      />
      <PaneBody>
        <ServiceWork />
      </PaneBody>
      <ServiceFooter />
    </>
  );
}

/** The work a connection opens, or the service's logo while it opens none. */
function ServiceWork() {
  const t = useTranslations("Connectors");
  const { service, state } = useService();

  if (service.key === "classroom" && Option.contains(state, "connected")) {
    return <ClassroomCourses />;
  }

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

/** Where a service stands, and what it asks for next: its connection, a way out of it, or the work it opens. */
function ServiceFooter() {
  const t = useTranslations("Connectors");
  const { service, state } = useService();
  const { canOpenExams, slug } = useTenant();
  const startsConnect = Option.exists(
    state,
    (now) => now === "reconnect" || Arr.contains(CONNECTABLE, now)
  );
  const opensExams =
    service.key === "forms" &&
    canOpenExams &&
    Option.contains(state, "connected");

  return (
    <PaneFooter>
      <ServiceStatus />
      <DisconnectAction />
      {startsConnect ? <ConnectAction /> : null}
      {opensExams ? (
        <Link {...schoolExamsTarget(slug)} className={buttonVariants()}>
          {t("open-exams")}
          <HugeIcons icon={ArrowRight01Icon} />
        </Link>
      ) : null}
    </PaneFooter>
  );
}

/**
 * How the connection stands, and a personal one says so. A school's connection names no holder, because the page
 * already stands in the school.
 */
function ServiceStatus() {
  const t = useTranslations("Connectors");
  const { service, state } = useService();

  return (
    <div className="me-auto flex min-w-0 flex-wrap gap-2">
      {Option.isSome(state) ? (
        <TableStatus
          icon={STATE_LOOKS[state.value].icon}
          label={t(`state-${state.value}`)}
          tone={STATE_LOOKS[state.value].tone}
        />
      ) : null}
      {holderOf(service) === "personal" ? (
        <TableStatus
          icon={UserIcon}
          label={t("holder-personal")}
          tone="neutral"
        />
      ) : null}
    </div>
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
