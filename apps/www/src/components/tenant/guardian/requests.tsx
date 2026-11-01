import type { GenericId, Ref } from "@confect/core";
import { QueryResult, useMutation, useQuery } from "@confect/react";
import {
  Cancel01Icon,
  CheckmarkCircle02Icon,
  Clock01Icon,
  Copy01Icon,
  PencilEdit02Icon,
} from "@hugeicons/core-free-icons";
import guardians from "@repo/backend/confect/_generated/refs/guardians";
import { RequestKind } from "@repo/backend/confect/guardians/request";
import { Button } from "@repo/design-system/components/ui/button";
import { ButtonGroup } from "@repo/design-system/components/ui/button-group";
import { ResponsiveDialog } from "@repo/design-system/components/ui/responsive-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/design-system/components/ui/select";
import { Textarea } from "@repo/design-system/components/ui/textarea";
import { Array as Arr, Record as Rec, Schema } from "effect";
import { useOptimistic, useState, useTransition } from "react";
import { useTranslations } from "use-intl";
import { useConvexAuth } from "@/components/auth/convex";
import { tableColumns } from "@/components/shared/table/columns";
import { DataTable } from "@/components/shared/table/data";
import { TableFrame } from "@/components/shared/table/frame";
import { TableFiltersProvider } from "@/components/shared/table/toolbar";
import { useTenant } from "@/components/tenant/context";
import { saveSchool } from "@/components/tenant/settings/save";

const SOURCE = "components/tenant/guardian/requests";

/** The longest request, which the server also holds a parent to. */
const REQUEST_LIMIT = 500;

/** One request as a parent reads it. */
type ParentRequest = Ref.Returns<typeof guardians.requests.ofLink>[number];

/** One request that waits for the school office. */
type WaitingRequest = Ref.Returns<typeof guardians.requests.waiting>[number];

/** The columns of a parent's requests. */
const parentColumns = tableColumns<ParentRequest>();

/** The columns of the requests that wait for the school office. */
const waitingColumns = tableColumns<WaitingRequest>();

/** The look of each state of a request in its column's filter. */
const REQUEST_STATE_ICONS = {
  approved: CheckmarkCircle02Icon,
  declined: Cancel01Icon,
  waiting: Clock01Icon,
};

/** The look of each kind of request in its column's filter. */
const REQUEST_KIND_ICONS = {
  dataCorrection: PencilEdit02Icon,
  reportCopy: Copy01Icon,
};

/** The kinds of request, as a column's filter offers them. */
function useKindOptions() {
  const t = useTranslations("SchoolGuardians");

  return Arr.map(RequestKind.literals, (kind) => ({
    icon: REQUEST_KIND_ICONS[kind],
    label: t(`request-kind-${kind}`),
    value: kind,
  }));
}

/** What a parent asked about one child, and the button that asks again. */
export function ParentRequests({
  linkId,
}: {
  linkId: GenericId.GenericId<"guardianLinks">;
}) {
  const t = useTranslations("SchoolGuardians");
  const { slug } = useTenant();
  const isSettled = useConvexAuth((auth) => !auth.isLoading);
  const kindOptions = useKindOptions();
  const requests = useQuery(
    guardians.requests.ofLink,
    isSettled ? { linkId, slug } : "skip"
  );

  if (QueryResult.isFailure(requests)) {
    throw requests.error;
  }
  return (
    <div className="flex flex-col items-start gap-3">
      {QueryResult.isSuccess(requests) &&
      !Arr.isReadonlyArrayEmpty(requests.value) ? (
        <TableFiltersProvider>
          <TableFrame>
            <DataTable
              columns={[
                parentColumns.values((request) => request.kind, {
                  cell: (info) => t(`request-kind-${info.getValue()}`),
                  header: t("request-kind"),
                  id: "kind",
                  options: kindOptions,
                }),
                parentColumns.text((request) => request.text, {
                  cell: (info) => (
                    <span
                      className="block max-w-xs truncate"
                      dir="auto"
                      title={info.getValue()}
                    >
                      {info.getValue()}
                    </span>
                  ),
                  header: t("request-text"),
                  id: "text",
                }),
                parentColumns.values((request) => request.state, {
                  cell: (info) => t(`request-state-${info.getValue()}`),
                  header: t("request-state"),
                  id: "state",
                  options: Arr.map(
                    Rec.toEntries(REQUEST_STATE_ICONS),
                    ([state, icon]) => ({
                      icon,
                      label: t(`request-state-${state}`),
                      value: state,
                    })
                  ),
                }),
              ]}
              data={requests.value}
              plain
              rowId={(request) => request.id}
            />
          </TableFrame>
        </TableFiltersProvider>
      ) : null}
      <AskDialog linkId={linkId} />
    </div>
  );
}

/** The button and the dialog that send one request to the school office. */
function AskDialog({
  linkId,
}: {
  linkId: GenericId.GenericId<"guardianLinks">;
}) {
  const t = useTranslations("SchoolGuardians");
  const common = useTranslations("Common");
  const { slug } = useTenant();
  const ask = useMutation(guardians.requests.ask);
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<typeof RequestKind.Type>("reportCopy");
  const [text, setText] = useState("");
  const [isSaving, startSaving] = useTransition();
  const items = Arr.map(RequestKind.literals, (value) => ({
    label: t(`request-kind-${value}`),
    value,
  }));

  return (
    <>
      <Button onClick={() => setOpen(true)} type="button" variant="outline">
        {t("request-ask")}
      </Button>
      <ResponsiveDialog
        description={t("request-description")}
        footer={
          <>
            <Button
              onClick={() => setOpen(false)}
              type="button"
              variant="outline"
            >
              {common("cancel")}
            </Button>
            <Button
              disabled={isSaving || text.trim() === ""}
              onClick={() =>
                startSaving(async () => {
                  await saveSchool(
                    () => ask({ kind, linkId, slug, text: text.trim() }),
                    SOURCE
                  );
                  setText("");
                  setOpen(false);
                })
              }
              type="button"
            >
              {t("request-send")}
            </Button>
          </>
        }
        open={open}
        setOpen={setOpen}
        title={t("request-ask")}
      >
        <div className="flex flex-col gap-3">
          <Select
            items={items}
            onValueChange={(value) =>
              setKind(Schema.decodeUnknownSync(RequestKind)(value))
            }
            value={kind}
          >
            <SelectTrigger aria-label={t("request-kind")} className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Arr.map(items, (item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Textarea
            aria-label={t("request-text")}
            maxLength={REQUEST_LIMIT}
            onChange={(event) => setText(event.target.value)}
            placeholder={t("request-placeholder")}
            rows={4}
            value={text}
          />
        </div>
      </ResponsiveDialog>
    </>
  );
}

/** The waiting requests. An answer takes one off the list at once, and a refused one brings it back. */
export function WaitingRequests({
  requests,
}: {
  requests: readonly WaitingRequest[];
}) {
  const t = useTranslations("SchoolGuardians");
  const { slug } = useTenant();
  const answer = useMutation(guardians.requests.answer);
  const kindOptions = useKindOptions();
  const [answered, setAnswered] = useOptimistic<
    readonly WaitingRequest["id"][],
    WaitingRequest["id"]
  >([], (ids, id) => Arr.append(ids, id));
  const [, startSaving] = useTransition();

  /** Sends one answer, and hides the row until the live list agrees. */
  function decide(request: WaitingRequest, decision: "approved" | "declined") {
    startSaving(async () => {
      setAnswered(request.id);
      await saveSchool(
        () =>
          answer({
            decision,
            linkId: request.linkId,
            requestId: request.id,
            slug,
          }),
        SOURCE
      );
    });
  }

  return (
    <TableFiltersProvider>
      <TableFrame>
        <DataTable
          columns={[
            waitingColumns.text((request) => request.student, {
              cell: (info) => <span dir="auto">{info.getValue()}</span>,
              header: t("request-student"),
              id: "student",
            }),
            waitingColumns.values((request) => request.kind, {
              cell: (info) => t(`request-kind-${info.getValue()}`),
              header: t("request-kind"),
              id: "kind",
              options: kindOptions,
            }),
            waitingColumns.text((request) => request.text, {
              cell: (info) => (
                <span
                  className="block max-w-xs truncate"
                  dir="auto"
                  title={info.getValue()}
                >
                  {info.getValue()}
                </span>
              ),
              header: t("request-text"),
              id: "text",
            }),
            waitingColumns.menu((info) => (
              <ButtonGroup>
                <Button
                  onClick={() => decide(info.row.original, "approved")}
                  type="button"
                >
                  {t("request-approve")}
                </Button>
                <Button
                  onClick={() => decide(info.row.original, "declined")}
                  type="button"
                  variant="outline"
                >
                  {t("request-decline")}
                </Button>
              </ButtonGroup>
            )),
          ]}
          data={Arr.filter(
            requests,
            (request) => !Arr.contains(answered, request.id)
          )}
          plain
          rowId={(request) => request.id}
        />
      </TableFrame>
    </TableFiltersProvider>
  );
}
