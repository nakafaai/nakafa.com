import {
  Add01Icon,
  ArrowRight01Icon,
  RefreshIcon,
  Unlink02Icon,
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
  statusKey,
} from "@/components/connectors/directory";
import { DisconnectDialog } from "@/components/connectors/disconnect";
import {
  PaneBody,
  PaneFact,
  PaneFacts,
  PaneFooter,
  PaneHeader,
} from "@/components/shared/pane";
import { usePanes } from "@/components/shared/panes";
import { ServiceTile } from "@/components/tenant/connectors/card";
import { ClassroomCourses } from "@/components/tenant/connectors/classroom";
import {
  ServiceContext,
  useService,
} from "@/components/tenant/connectors/service";
import { useTenant } from "@/components/tenant/context";
import { schoolExamsTarget } from "@/lib/routing/school/target";

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

/** The service's header, what it reads and where it stands, and the work a connection opens. */
function ServicePane() {
  const t = useTranslations("Connectors");
  const { service, state } = useService();

  return (
    <>
      <PaneHeader
        description={t("by", { provider: service.provider })}
        title={t(service.key)}
      />
      <PaneBody>
        <div className="flex flex-col gap-6">
          <div className="flex items-start gap-3">
            <ServiceTile />
            <p className="text-muted-foreground text-sm">
              {t(`${service.key}-description`)}
            </p>
          </div>
          <PaneFacts>
            {Option.isSome(state) ? (
              <PaneFact label={t("fact-status")}>
                {t(statusKey(service, state.value))}
              </PaneFact>
            ) : null}
            <PaneFact label={t("fact-holder")}>
              {t(`holder-${holderOf(service)}`)}
            </PaneFact>
          </PaneFacts>
          {service.key === "classroom" &&
          Option.contains(state, "connected") ? (
            <ClassroomCourses />
          ) : null}
        </div>
      </PaneBody>
      <ServiceFooter />
    </>
  );
}

/** What a service asks for next: its connection, a way out of it, or the work it opens. */
function ServiceFooter() {
  const t = useTranslations("Connectors");
  const { connection, service, state } = useService();
  const { canOpenExams, slug } = useTenant();
  const startsConnect = Option.exists(
    state,
    (now) => now === "reconnect" || Arr.contains(CONNECTABLE, now)
  );
  const opensExams =
    service.key === "forms" &&
    canOpenExams &&
    Option.contains(state, "connected");

  if (!startsConnect && Option.isNone(connection)) {
    return null;
  }

  return (
    <PaneFooter>
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
        {t("disconnect-service", { name })}
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
