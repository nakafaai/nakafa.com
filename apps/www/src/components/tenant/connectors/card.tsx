import { Add01Icon, MoreHorizontalIcon } from "@hugeicons/core-free-icons";
import { GoogleProductLogo } from "@repo/design-system/components/logos/google";
import { Badge } from "@repo/design-system/components/ui/badge";
import { Button } from "@repo/design-system/components/ui/button";
import { Card, CardContent } from "@repo/design-system/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@repo/design-system/components/ui/dropdown-menu";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { Spinner } from "@repo/design-system/components/ui/spinner";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@repo/design-system/components/ui/tooltip";
import { Link } from "@tanstack/react-router";
import { cva } from "class-variance-authority";
import { Option } from "effect";
import { useState, useTransition } from "react";
import { useTranslations } from "use-intl";
import { useConnectorActions } from "@/components/connectors/actions";
import {
  type DirectoryService,
  type directoryState,
  holderOf,
} from "@/components/connectors/directory";
import { DisconnectDialog } from "@/components/connectors/disconnect";
import type { Connection } from "@/components/connectors/optimistic";
import { ClassroomImport } from "@/components/tenant/connectors/classroom";
import { useTenant } from "@/components/tenant/context";
import { schoolExamsTarget } from "@/lib/routing/school/target";

/** Where a service stands, or nothing while its reads have not answered. */
type ServiceState = Option.Option<ReturnType<typeof directoryState>>;

const statusVariants = cva("min-w-0 flex-1 truncate text-sm", {
  defaultVariants: { tone: "muted" },
  variants: {
    tone: { destructive: "text-destructive", muted: "text-muted-foreground" },
  },
});

/**
 * One service of the directory: its logo, name and one line, who holds it, and where it stands.
 * The corner connects with one press, or holds what ends a connection. The last row says where the
 * service stands and holds the next step, in the same height in every state, so a state that
 * changes moves nothing.
 */
export function ServiceCard({
  connection,
  service,
  state,
}: {
  connection: Option.Option<Connection>;
  service: DirectoryService;
  state: ServiceState;
}) {
  const t = useTranslations("Connectors");
  const name = t(service.key);

  return (
    <Card size="sm">
      <CardContent className="flex flex-col gap-3">
        <div className="flex items-start gap-3">
          <span className="bg-background ring-foreground/10 flex size-10 shrink-0 items-center justify-center rounded-lg ring-1">
            <GoogleProductLogo className="size-5" name={service.key} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h2 className="truncate text-sm font-medium">{name}</h2>
              <Badge className="shrink-0" variant="muted-outline">
                {t(`holder-${holderOf(service)}`)}
              </Badge>
            </div>
            <p className="text-muted-foreground truncate text-sm">
              {t(`${service.key}-line`)}
            </p>
          </div>
          <CornerAction
            connection={connection}
            name={name}
            service={service}
            state={state}
          />
        </div>
        <div className="flex min-h-8 items-center gap-3">
          <ServiceStatus service={service} state={state} />
          <NextStep service={service} state={state} />
        </div>
      </CardContent>
    </Card>
  );
}

/** What the corner of a card offers: connect while there is no connection, and end one that stands. */
function CornerAction({
  connection,
  name,
  service,
  state,
}: {
  connection: Option.Option<Connection>;
  name: string;
  service: DirectoryService;
  state: ServiceState;
}) {
  if (Option.contains(state, "open") || Option.contains(state, "refused")) {
    return <ConnectAction name={name} service={service} />;
  }
  if (Option.isSome(connection)) {
    return <ConnectionMenu connection={connection.value} service={service} />;
  }
  return null;
}

/** The plus of a card: one press goes straight to the consent screen, and it spins until the page leaves. */
function ConnectAction({
  name,
  service,
}: {
  name: string;
  service: DirectoryService;
}) {
  const t = useTranslations("Connectors");
  const { connect } = useConnectorActions();
  const [isConnecting, startConnecting] = useTransition();
  const label = t("connect-service", { name });

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            aria-label={label}
            disabled={isConnecting}
            onClick={() => startConnecting(() => connect(service.connector))}
            size="icon-sm"
            type="button"
            variant="outline"
          >
            <Spinner icon={Add01Icon} isLoading={isConnecting} />
          </Button>
        }
      />
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

/** Ends a connection, which names the service it really ends: Forms ends through Drive. */
function ConnectionMenu({
  connection,
  service,
}: {
  connection: Connection;
  service: DirectoryService;
}) {
  const t = useTranslations("Connectors");
  const [confirming, setConfirming] = useState(false);
  const name = t(service.connector);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              aria-label={t("manage-service", { name: t(service.key) })}
              size="icon-sm"
              type="button"
              variant="ghost"
            >
              <HugeIcons icon={MoreHorizontalIcon} />
            </Button>
          }
        />
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            onClick={() => setConfirming(true)}
            variant="destructive"
          >
            {t("disconnect-service", { name })}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <DisconnectDialog
        connection={connection}
        name={name}
        open={confirming}
        setOpen={setConfirming}
      />
    </>
  );
}

/** The one sentence that says where a service stands, in the words of each state. */
function ServiceStatus({
  service,
  state,
}: {
  service: DirectoryService;
  state: ServiceState;
}) {
  const t = useTranslations("Connectors");

  if (Option.isNone(state)) {
    return null;
  }
  const lost = state.value === "reconnect" || state.value === "refused";
  const words =
    state.value === "open" && service.key === "forms"
      ? t("status-through-drive")
      : t(`status-${state.value}`);

  return (
    <p
      className={statusVariants({ tone: lost ? "destructive" : "muted" })}
      role={lost ? "alert" : undefined}
    >
      {words}
    </p>
  );
}

/** What a service asks for next: its connection back, or the work a connection opens. */
function NextStep({
  service,
  state,
}: {
  service: DirectoryService;
  state: ServiceState;
}) {
  const t = useTranslations("Connectors");
  const { canOpenExams, slug } = useTenant();
  const { connect } = useConnectorActions();
  const [isConnecting, startConnecting] = useTransition();

  if (Option.contains(state, "reconnect")) {
    return (
      <Button
        disabled={isConnecting}
        onClick={() => startConnecting(() => connect(service.connector))}
        size="sm"
        type="button"
        variant="outline"
      >
        {t("reconnect")}
      </Button>
    );
  }
  if (!Option.contains(state, "connected")) {
    return null;
  }
  if (service.key === "classroom") {
    return <ClassroomImport />;
  }
  if (service.key === "forms" && canOpenExams) {
    return (
      <Button
        nativeButton={false}
        render={<Link {...schoolExamsTarget(slug)} />}
        size="sm"
        variant="outline"
      >
        {t("open-exams")}
      </Button>
    );
  }
  return null;
}
