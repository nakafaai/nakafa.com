import type { Ref } from "@confect/core";
import {
  type PaginatedQueryItem,
  PaginatedQueryResult,
  useMutation,
  usePaginatedQuery,
} from "@confect/react";
import {
  Alert02Icon,
  CheckmarkCircle02Icon,
  Clock01Icon,
  MinusSignCircleIcon,
} from "@hugeicons/core-free-icons";
import integrations from "@repo/backend/confect/_generated/refs/integrations";
import { Button } from "@repo/design-system/components/ui/button";
import { Intersection } from "@repo/design-system/components/ui/intersection";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@repo/design-system/components/ui/sheet";
import { Array as Arr } from "effect";
import { useTranslations } from "use-intl";
import { useConvexAuth } from "@/components/auth/convex";
import { DataFailure } from "@/components/shared/failure";
import { reloadPage } from "@/components/shared/reload";
import { type StatusLook, TableStatus } from "@/components/shared/table/status";
import { useTenant } from "@/components/tenant/context";
import { resendDeliveryChange } from "@/components/tenant/settings/mutation";
import { saveSchool } from "@/components/tenant/settings/save";
import { SchoolDateTime } from "@/components/tenant/settings/time";

const SOURCE = "components/tenant/settings/deliveries";

/** How many attempts one page of the log loads, and each page after it. */
const PAGE_SIZE = 30;

/** One webhook as the school's list shows it. */
type Webhook = Ref.Returns<typeof integrations.webhooks.list>["page"][number];

/** One attempt as the log shows it. */
type Delivery = PaginatedQueryItem<typeof integrations.webhooks.deliveries>;

/** The look of each state of an attempt. */
const DELIVERY_LOOKS = {
  delivered: { icon: CheckmarkCircle02Icon, tone: "success" },
  dropped: { icon: MinusSignCircleIcon, tone: "neutral" },
  due: { icon: Clock01Icon, tone: "neutral" },
  failed: { icon: Alert02Icon, tone: "destructive" },
} as const satisfies Record<Delivery["state"]["status"], StatusLook>;

/**
 * One attempt: its change and when it ran, then its state. A failed attempt says why and
 * offers Send again, which writes one more attempt of the same change.
 */
function DeliveryRow({
  delivery,
  webhook,
}: {
  delivery: Delivery;
  webhook: Webhook;
}) {
  const { slug } = useTenant();
  const t = useTranslations("SchoolSettings");
  const resend = useMutation(integrations.webhooks.resend).withOptimisticUpdate(
    resendDeliveryChange
  );
  const { state } = delivery;
  const look = DELIVERY_LOOKS[state.status];

  return (
    <li className="flex flex-col gap-2 p-4 text-sm">
      <div className="flex items-center justify-between gap-3">
        <span className="min-w-0 truncate font-medium">
          {t(`webhook-change.${delivery.change}`)}
        </span>
        <TableStatus
          icon={look.icon}
          label={t(`delivery-status.${state.status}`)}
          tone={look.tone}
        />
      </div>
      <div className="text-muted-foreground flex items-center justify-between gap-3">
        <span className="tabular-nums">
          {t("delivery-attempt", { attempt: delivery.attempt })}
        </span>
        <span className="tabular-nums">
          <SchoolDateTime at={delivery.createdAt} />
        </span>
      </div>
      {state.status === "failed" || state.status === "dropped" ? (
        <div className="flex items-center justify-between gap-3">
          <span className="text-muted-foreground">
            {t(`delivery-reason.${state.reason}`)}
          </span>
          {state.status === "failed" && webhook.status === "active" ? (
            <Button
              onClick={() =>
                saveSchool(
                  () =>
                    resend({
                      clientId: webhook.clientId,
                      deliveryId: delivery.id,
                      slug,
                      webhookId: webhook.id,
                    }),
                  SOURCE
                )
              }
              size="sm"
              type="button"
              variant="outline"
            >
              {t("delivery-resend")}
            </Button>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}

/** The attempts of one webhook, newest first, loading more as the end comes into view. */
function DeliveryList({ webhook }: { webhook: Webhook }) {
  const { slug } = useTenant();
  const t = useTranslations("SchoolSettings");
  const isSettled = useConvexAuth((auth) => !auth.isLoading);
  const pagination = usePaginatedQuery(
    integrations.webhooks.deliveries,
    isSettled
      ? { clientId: webhook.clientId, slug, webhookId: webhook.id }
      : "skip",
    { initialNumItems: PAGE_SIZE }
  );

  if (pagination._tag === "LoadingFirstPage") {
    return null;
  }
  if (PaginatedQueryResult.isFailure(pagination)) {
    return <DataFailure onRetry={reloadPage} />;
  }
  if (Arr.isReadonlyArrayEmpty(pagination.results)) {
    return (
      <p className="text-muted-foreground p-4 text-sm">
        {t("webhook-deliveries-empty")}
      </p>
    );
  }
  return (
    <>
      <ul className="divide-border flex flex-col divide-y">
        {Arr.map(pagination.results, (delivery) => (
          <DeliveryRow
            delivery={delivery}
            key={delivery.id}
            webhook={webhook}
          />
        ))}
      </ul>
      {PaginatedQueryResult.isCanLoadMore(pagination) ? (
        <Intersection onIntersect={() => pagination.loadMore(PAGE_SIZE)} />
      ) : null}
    </>
  );
}

/** The delivery log of one webhook, in a sheet that reads it while it is open. */
export function SchoolDeliverySheet({
  open,
  setOpen,
  webhook,
}: {
  open: boolean;
  setOpen: (open: boolean) => void;
  webhook: Webhook;
}) {
  const t = useTranslations("SchoolSettings");
  const common = useTranslations("Common");

  return (
    <Sheet onOpenChange={setOpen} open={open}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>{t("webhook-deliveries")}</SheetTitle>
          <SheetDescription className="break-all">
            {webhook.url}
          </SheetDescription>
        </SheetHeader>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {open ? <DeliveryList webhook={webhook} /> : null}
        </div>
        <SheetFooter>
          <SheetClose
            render={
              <Button type="button" variant="outline">
                {common("close")}
              </Button>
            }
          />
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
