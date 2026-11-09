import type { Ref } from "@confect/core";
import {
  PaginatedQueryResult,
  useMutation,
  usePaginatedQuery,
} from "@confect/react";
import { Key01Icon } from "@hugeicons/core-free-icons";
import integrations from "@repo/backend/confect/_generated/refs/integrations";
import {
  ReceiverUrl,
  WebhookChanges,
} from "@repo/backend/confect/integrations/hook";
import { Button } from "@repo/design-system/components/ui/button";
import { Checkbox } from "@repo/design-system/components/ui/checkbox";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@repo/design-system/components/ui/field";
import { PopupHold } from "@repo/design-system/components/ui/hold";
import { Input } from "@repo/design-system/components/ui/input";
import { ResponsiveDialog } from "@repo/design-system/components/ui/responsive-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/design-system/components/ui/select";
import { buttonVariants } from "@repo/design-system/lib/button";
import { Array as Arr, Option, Schema } from "effect";
import { useId, useState, useTransition } from "react";
import { useTranslations } from "use-intl";
import { useConvexAuth } from "@/components/auth/convex";
import { useTenant } from "@/components/tenant/context";
import {
  offeredChanges,
  toggleChange,
} from "@/components/tenant/settings/changes";
import { changeWebhookChange } from "@/components/tenant/settings/mutation";
import { runSchoolWrite, schoolCall } from "@/components/tenant/write";
import { Link } from "@/lib/routing/link";

/** How many clients the dialog offers: more than a school keeps. */
const CLIENT_PAGE = 100;

/** One webhook as the school's list shows it. */
type Webhook = Ref.Returns<typeof integrations.webhooks.list>["page"][number];

/** One change a webhook can carry. */
type Change = Webhook["changes"][number];

/** Decodes a typed receiver address, when it is one. */
const decodeUrl = Schema.decodeOption(ReceiverUrl);

/** Decodes a chosen list of changes, when it holds one. */
const decodeChanges = Schema.decodeUnknownOption(WebhookChanges);

/**
 * The fields of a webhook: where it posts, and the changes it carries, from those its
 * client's actions open. A list keeps at least one change, a client that opens none says
 * so, and an address shows its error in the place of its description once it holds text.
 */
function WebhookFields({
  offered,
  setChanges,
  setUrl,
  changes,
  url,
}: {
  changes: readonly Change[];
  offered: readonly Change[];
  setChanges: (changes: readonly Change[]) => void;
  setUrl: (url: string) => void;
  url: string;
}) {
  const t = useTranslations("SchoolSettings");
  const id = useId();
  const refused = url !== "" && Option.isNone(decodeUrl(url.trim()));

  return (
    <>
      <Field data-invalid={refused}>
        <FieldLabel htmlFor={`${id}-url`}>{t("webhook-url")}</FieldLabel>
        <Input
          aria-invalid={refused}
          id={`${id}-url`}
          inputMode="url"
          onChange={(event) => setUrl(event.target.value)}
          placeholder={t("webhook-url-placeholder")}
          value={url}
        />
        <FieldDescription>{t("webhook-url-description")}</FieldDescription>
        <FieldError>{refused ? t("webhook-url-error") : null}</FieldError>
      </Field>
      <FieldSet>
        <FieldLegend variant="label">{t("webhook-changes")}</FieldLegend>
        <FieldDescription>
          {Arr.isReadonlyArrayEmpty(offered)
            ? t("webhook-changes-none")
            : t("webhook-changes-description")}
        </FieldDescription>
        <FieldGroup data-slot="checkbox-group">
          {Arr.map(offered, (change) => {
            const checked = Arr.contains(changes, change);
            return (
              <Field key={change} orientation="horizontal">
                <Checkbox
                  checked={checked}
                  disabled={checked && changes.length === 1}
                  id={`${id}-${change}`}
                  onCheckedChange={(next) =>
                    setChanges(toggleChange(offered, changes, change, next))
                  }
                />
                <FieldLabel htmlFor={`${id}-${change}`}>
                  {t(`webhook-change.${change}`)}
                </FieldLabel>
              </Field>
            );
          })}
        </FieldGroup>
      </FieldSet>
    </>
  );
}

/**
 * The dialog that creates a webhook: the client it belongs to, the first one from the start,
 * where it posts, and what it carries, every change the client's actions open at first. A
 * school with no client gets the field disabled, the sentence that says why, and the way to
 * create one. The secret the server answers goes to `onIssued`, and the dialog closes.
 */
export function SchoolWebhookCreateDialog({
  onIssued,
  open,
  setOpen,
}: {
  onIssued: (secret: string) => void;
  open: boolean;
  setOpen: (open: boolean) => void;
}) {
  const { slug } = useTenant();
  const t = useTranslations("SchoolSettings");
  const common = useTranslations("Common");
  const isSettled = useConvexAuth((auth) => !auth.isLoading);
  const clients = usePaginatedQuery(
    integrations.clients.list,
    isSettled && open ? { slug } : "skip",
    { initialNumItems: CLIENT_PAGE }
  );
  const create = useMutation(integrations.webhooks.create);
  const id = useId();
  const [isPending, startTransition] = useTransition();
  const [clientId, setClientId] = useState<string | undefined>(undefined);
  const [url, setUrl] = useState("");
  const [chosen, setChosen] = useState<readonly Change[] | undefined>(
    undefined
  );

  const active = PaginatedQueryResult.isFailure(clients)
    ? []
    : Arr.filter(clients.results, (client) => client.status === "active");
  const client = Option.orElse(
    Arr.findFirst(active, (each) => each.id === clientId),
    () => Arr.head(active)
  );
  const hasNoClient =
    (PaginatedQueryResult.isCanLoadMore(clients) ||
      PaginatedQueryResult.isExhausted(clients)) &&
    Arr.isReadonlyArrayEmpty(active);
  const held = Option.match(client, {
    onNone: () => [],
    onSome: (each) => offeredChanges(each.actions),
  });
  const changes = chosen ?? held;
  const address = decodeUrl(url.trim());
  const carried = decodeChanges(changes);

  const submit = () => {
    if (
      Option.isNone(client) ||
      Option.isNone(address) ||
      Option.isNone(carried)
    ) {
      return;
    }
    startTransition(() =>
      runSchoolWrite(
        schoolCall(() =>
          create({
            changes: carried.value,
            clientId: client.value.id,
            slug,
            url: address.value,
          })
        ),
        {
          onSaved: (issued) => {
            setOpen(false);
            setUrl("");
            onIssued(issued.secret);
          },
        }
      )
    );
  };

  return (
    <ResponsiveDialog
      action={
        <Button
          disabled={
            Option.isNone(client) ||
            Option.isNone(address) ||
            Option.isNone(carried)
          }
          inert={isPending}
          onClick={submit}
          type="button"
        >
          {common("create")}
        </Button>
      }
      description={t("webhook-add-description")}
      open={open}
      setOpen={setOpen}
      title={t("webhook-add")}
    >
      <FieldGroup>
        {clients._tag === "LoadingFirstPage" ? <PopupHold /> : null}
        <Field>
          <FieldLabel htmlFor={`${id}-client`}>
            {t("webhook-client")}
          </FieldLabel>
          <Select
            disabled={Arr.isReadonlyArrayEmpty(active)}
            items={Arr.map(active, (each) => ({
              label: each.name,
              value: each.id,
            }))}
            onValueChange={(value) => {
              if (typeof value === "string") {
                setClientId(value);
                setChosen(undefined);
              }
            }}
            value={Option.getOrNull(Option.map(client, (each) => each.id))}
          >
            <SelectTrigger className="w-full" id={`${id}-client`}>
              <SelectValue placeholder={t("webhook-client-placeholder")} />
            </SelectTrigger>
            <SelectContent label={common("menu-client")}>
              {Arr.map(active, (each) => (
                <SelectItem icon={Key01Icon} key={each.id} value={each.id}>
                  {each.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {hasNoClient ? (
            <>
              <FieldDescription>{t("webhook-client-none")}</FieldDescription>
              <Link
                className={buttonVariants({ variant: "outline" })}
                params={{ slug }}
                to="/school/$slug/settings/clients"
              >
                {t("client-add")}
              </Link>
            </>
          ) : null}
        </Field>
        {Option.isSome(client) ? (
          <WebhookFields
            changes={changes}
            offered={held}
            setChanges={setChosen}
            setUrl={setUrl}
            url={url}
          />
        ) : null}
      </FieldGroup>
    </ResponsiveDialog>
  );
}

/**
 * The dialog that changes a webhook. The list shows the new values at once, and a refusal
 * steps back. It offers the changes its client's actions open now.
 */
export function SchoolWebhookEditDialog({
  open,
  setOpen,
  webhook,
}: {
  open: boolean;
  setOpen: (open: boolean) => void;
  webhook: Webhook;
}) {
  const { slug } = useTenant();
  const t = useTranslations("SchoolSettings");
  const tCommon = useTranslations("Common");
  const change = useMutation(integrations.webhooks.change).withOptimisticUpdate(
    changeWebhookChange
  );
  const [isPending, startTransition] = useTransition();
  // The fields hold what the admin chose, and the webhook's own values until they choose.
  const [typedUrl, setUrl] = useState<string | null>(null);
  const [chosenChanges, setChanges] = useState<readonly Change[] | null>(null);
  const url = typedUrl ?? webhook.url;
  const changes = chosenChanges ?? webhook.changes;
  const offered = offeredChanges(webhook.clientActions);
  const address = decodeUrl(url.trim());
  const carried = decodeChanges(changes);

  const submit = () => {
    if (Option.isNone(address) || Option.isNone(carried)) {
      return;
    }
    setOpen(false);
    startTransition(() =>
      runSchoolWrite(
        schoolCall(() =>
          change({
            changes: carried.value,
            clientId: webhook.clientId,
            slug,
            url: address.value,
            webhookId: webhook.id,
          })
        )
      )
    );
  };

  return (
    <ResponsiveDialog
      action={
        <Button
          disabled={Option.isNone(address) || Option.isNone(carried)}
          inert={isPending}
          onClick={submit}
          type="button"
        >
          {tCommon("save")}
        </Button>
      }
      description={t("webhook-edit-description")}
      open={open}
      setOpen={setOpen}
      title={tCommon("edit")}
    >
      <FieldGroup>
        <WebhookFields
          changes={changes}
          offered={offered}
          setChanges={setChanges}
          setUrl={setUrl}
          url={url}
        />
      </FieldGroup>
    </ResponsiveDialog>
  );
}
