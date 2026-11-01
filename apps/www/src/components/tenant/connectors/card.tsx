import {
  Add01Icon,
  Clock01Icon,
  RefreshIcon,
  SquareLock02Icon,
  Tick02Icon,
} from "@hugeicons/core-free-icons";
import { ServiceLogo } from "@repo/design-system/components/logos/service";
import { Badge } from "@repo/design-system/components/ui/badge";
import { Button } from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
} from "@repo/design-system/components/ui/item";
import { Spinner } from "@repo/design-system/components/ui/spinner";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@repo/design-system/components/ui/tooltip";
import { STATUS_BADGES } from "@repo/design-system/lib/status";
import { cva } from "class-variance-authority";
import { Array as Arr, Option } from "effect";
import { useTransition } from "react";
import { useTranslations } from "use-intl";
import { useConnectorActions } from "@/components/connectors/actions";
import {
  CONNECTABLE,
  type DirectoryEntry,
  LOST,
} from "@/components/connectors/directory";
import { usePanes } from "@/components/shared/panes";
import type { StatusLook } from "@/components/shared/table/status";
import {
  ServiceContext,
  useService,
} from "@/components/tenant/connectors/service";

/** The states a card shows by a mark in its corner, as nothing in them starts from the card. */
const MARKS = {
  connected: { icon: Tick02Icon, tone: "success" },
  locked: { icon: SquareLock02Icon, tone: "neutral" },
  soon: { icon: Clock01Icon, tone: "neutral" },
} as const satisfies Record<string, StatusLook>;

/** The states a card says in words in place of its maker, as its corner alone cannot tell them. */
const SPOKEN = ["failed", "locked", "reconnect", "refused", "soon"] as const;

const bylineVariants = cva("text-sm", {
  defaultVariants: { tone: "muted" },
  variants: {
    tone: { destructive: "text-destructive", muted: "text-muted-foreground" },
  },
});

/**
 * One service of the directory: its logo in a tile, its name, one line, and its maker, or the words
 * of a state that asks for the reader. A press on the card opens the service's detail beside the
 * list. The corner connects with one press, or marks where the service stands, so a state that
 * changes moves nothing.
 */
export function ServiceCard({ entry }: { entry: typeof DirectoryEntry.Type }) {
  const t = useTranslations("Connectors");

  return (
    <ServiceContext value={entry}>
      <Item
        className="hover:bg-muted has-data-open:bg-muted relative items-start"
        render={<li />}
        variant="outline"
      >
        <ServiceTile />
        <ItemContent className="min-w-0">
          <ItemTitle className="w-full">
            <ServiceOpen />
          </ItemTitle>
          <ItemDescription>{t(`${entry.service.key}-line`)}</ItemDescription>
          <ServiceByline />
        </ItemContent>
        <ItemActions className="relative">
          <CornerAction />
        </ItemActions>
      </Item>
    </ServiceContext>
  );
}

/** A service's logo in its tile, at the size of every other logo of the directory. */
export function ServiceTile() {
  const { service } = useService();

  return (
    <ItemMedia className="bg-background ring-foreground/10 size-10 rounded-lg ring-1">
      <ServiceLogo className="size-6" name={service.key} />
    </ItemMedia>
  );
}

/** The service's name, whose press covers the card and opens the detail. */
function ServiceOpen() {
  const t = useTranslations("Connectors");
  const { service } = useService();
  const show = usePanes((state) => state.show);
  const isOpen = usePanes((state) => Option.contains(state.open, service.key));

  return (
    <button
      className="focus-visible:ring-ring min-w-0 cursor-pointer rounded-sm text-start outline-none after:absolute after:inset-0 focus-visible:ring-2"
      data-open={isOpen ? "" : undefined}
      onClick={() => show(service.key)}
      type="button"
    >
      {t(service.key)}
    </button>
  );
}

/** Who makes a service, or the words of a state that asks for the reader. */
function ServiceByline() {
  const t = useTranslations("Connectors");
  const { service, state } = useService();
  const spoken = Option.filter(state, (now) => Arr.contains(SPOKEN, now));

  if (Option.isNone(spoken)) {
    return (
      <p className={bylineVariants()}>
        {t("by", { provider: service.provider })}
      </p>
    );
  }
  const lost = Arr.contains(LOST, spoken.value);

  return (
    <p
      className={bylineVariants({ tone: lost ? "destructive" : "muted" })}
      role={lost ? "alert" : undefined}
    >
      {t(`status-${spoken.value}`)}
    </p>
  );
}

/** What the corner of a card holds: the press that connects, or the mark of where it stands. */
function CornerAction() {
  const { state } = useService();

  if (Option.isNone(state)) {
    return <span className="size-8" />;
  }
  const now = state.value;

  if (now === "reconnect" || Arr.contains(CONNECTABLE, now)) {
    return <ConnectAction />;
  }

  return <StateMark state={now} />;
}

/** The plus of a card, or its way back to a lost connection: one press goes straight to the consent screen. */
function ConnectAction() {
  const t = useTranslations("Connectors");
  const { service, state } = useService();
  const { connect } = useConnectorActions();
  const [isConnecting, startConnecting] = useTransition();
  const again = Option.contains(state, "reconnect");
  const label = t(again ? "reconnect-service" : "connect-service", {
    name: t(service.key),
  });

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
            <Spinner
              icon={again ? RefreshIcon : Add01Icon}
              isLoading={isConnecting}
            />
          </Button>
        }
      />
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

/** The check of a connected service, or what holds one back, named for a screen reader. */
function StateMark({ state }: { state: keyof typeof MARKS }) {
  const t = useTranslations("Connectors");
  const { icon, tone } = MARKS[state];

  return (
    <Badge
      aria-label={t(`status-${state}`)}
      className="size-8 p-0 [&>svg]:size-4"
      role="img"
      variant={STATUS_BADGES[tone]}
    >
      <HugeIcons icon={icon} />
    </Badge>
  );
}
