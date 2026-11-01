import type { GenericId } from "@confect/core";
import { QueryResult, useMutation, useQuery } from "@confect/react";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@repo/design-system/components/ui/table";
import { Textarea } from "@repo/design-system/components/ui/textarea";
import { Array as Arr, Schema } from "effect";
import { useOptimistic, useState, useTransition } from "react";
import { useTranslations } from "use-intl";
import { useConvexAuth } from "@/components/auth/convex";
import { columnAlign } from "@/components/shared/table/align";
import { TableFrame } from "@/components/shared/table/frame";
import { useTenant } from "@/components/tenant/context";
import { saveSchool } from "@/components/tenant/settings/save";

const SOURCE = "components/tenant/guardian/requests";

/** The longest request, which the server also holds a parent to. */
const REQUEST_LIMIT = 500;

/** What a parent asked about one child, and the button that asks again. */
export function ParentRequests({
  linkId,
}: {
  linkId: GenericId.GenericId<"guardianLinks">;
}) {
  const t = useTranslations("SchoolGuardians");
  const { slug } = useTenant();
  const isSettled = useConvexAuth((auth) => !auth.isLoading);
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
        <TableFrame>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className={columnAlign({ align: "start" })}>
                  {t("request-kind")}
                </TableHead>
                <TableHead className={columnAlign({ align: "start" })}>
                  {t("request-text")}
                </TableHead>
                <TableHead className={columnAlign()}>
                  {t("request-state")}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Arr.map(requests.value, (request) => (
                <TableRow key={request.id}>
                  <TableCell className={columnAlign({ align: "start" })}>
                    {t(`request-kind-${request.kind}`)}
                  </TableCell>
                  <TableCell
                    className={columnAlign({ align: "start" })}
                    dir="auto"
                  >
                    {request.text}
                  </TableCell>
                  <TableCell className={columnAlign()}>
                    {t(`request-state-${request.state}`)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableFrame>
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

/** What waits for the school office, above the links, and nothing while none does. */
export function StaffRequests() {
  const t = useTranslations("SchoolGuardians");
  const { slug } = useTenant();
  const isSettled = useConvexAuth((auth) => !auth.isLoading);
  const waiting = useQuery(
    guardians.requests.waiting,
    isSettled ? { slug } : "skip"
  );

  if (QueryResult.isFailure(waiting)) {
    throw waiting.error;
  }
  if (
    !QueryResult.isSuccess(waiting) ||
    Arr.isReadonlyArrayEmpty(waiting.value)
  ) {
    return null;
  }
  return (
    <TableFrame>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className={columnAlign({ align: "start" })}>
              {t("request-student")}
            </TableHead>
            <TableHead className={columnAlign({ align: "start" })}>
              {t("request-kind")}
            </TableHead>
            <TableHead className={columnAlign({ align: "start" })}>
              {t("request-text")}
            </TableHead>
            <TableHead className={columnAlign()}>
              {t("request-state")}
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {Arr.map(waiting.value, (request) => (
            <StaffRequestRow key={request.id} request={request} />
          ))}
        </TableBody>
      </Table>
    </TableFrame>
  );
}

/** One waiting request. An answer takes it off the list at once, and a refused one brings it back. */
function StaffRequestRow({
  request,
}: {
  request: {
    readonly id: GenericId.GenericId<"guardianRequests">;
    readonly kind: typeof RequestKind.Type;
    readonly linkId: GenericId.GenericId<"guardianLinks">;
    readonly student: string;
    readonly text: string;
  };
}) {
  const t = useTranslations("SchoolGuardians");
  const { slug } = useTenant();
  const answer = useMutation(guardians.requests.answer);
  const [answered, setAnswered] = useOptimistic(false);
  const [, startSaving] = useTransition();

  /** Sends one answer, and hides the row until the live list agrees. */
  function decide(decision: "approved" | "declined") {
    startSaving(async () => {
      setAnswered(true);
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

  if (answered) {
    return null;
  }
  return (
    <TableRow>
      <TableCell className={columnAlign({ align: "start" })} dir="auto">
        {request.student}
      </TableCell>
      <TableCell className={columnAlign({ align: "start" })}>
        {t(`request-kind-${request.kind}`)}
      </TableCell>
      <TableCell className={columnAlign({ align: "start" })} dir="auto">
        {request.text}
      </TableCell>
      <TableCell className={columnAlign()}>
        <ButtonGroup>
          <Button onClick={() => decide("approved")} type="button">
            {t("request-approve")}
          </Button>
          <Button
            onClick={() => decide("declined")}
            type="button"
            variant="outline"
          >
            {t("request-decline")}
          </Button>
        </ButtonGroup>
      </TableCell>
    </TableRow>
  );
}
