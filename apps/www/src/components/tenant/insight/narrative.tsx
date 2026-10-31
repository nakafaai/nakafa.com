import type { GenericId } from "@confect/core";
import { QueryResult, useMutation } from "@confect/react";
import insight from "@repo/backend/confect/_generated/refs/insight";
import { Button } from "@repo/design-system/components/ui/button";
import { ResponsiveDialog } from "@repo/design-system/components/ui/responsive-dialog";
import { Textarea } from "@repo/design-system/components/ui/textarea";
import { useOptimistic, useState, useTransition } from "react";
import { useTranslations } from "use-intl";
import { useTenant, useViewerQuery } from "@/components/tenant/context";
import type { InsightStudent } from "@/components/tenant/insight/rows";
import { saveSchool } from "@/components/tenant/settings/save";

const SOURCE = "components/tenant/insight/narrative";

/** The longest narrative, which the server also holds a teacher to. */
const NARRATIVE_LIMIT = 4000;

/**
 * One student's narrative: the teacher writes it, shares it with the guardians, and takes it back from the same place.
 * Nina can draft it from the student's numbers, and the teacher reads the draft and takes it into their own words.
 */
export function StudentNarrative({
  classId,
  student,
}: {
  classId: GenericId.GenericId<"classes">;
  student: InsightStudent;
}) {
  const t = useTranslations("SchoolInsight");
  const common = useTranslations("Common");
  const { slug } = useTenant();
  const viewer = useViewerQuery();
  const names = { classId, personId: student.id, slug };
  const write = useMutation(insight.narratives.write);
  const share = useMutation(insight.narratives.share);
  const withdraw = useMutation(insight.narratives.withdraw);
  const ask = useMutation(insight.drafts.ask);
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(student.narrative?.text ?? "");
  const [isSaving, startSaving] = useTransition();
  const [asked, setAsked] = useOptimistic(student.draft !== null);
  const shared = student.narrative?.shared === true;
  const saved = student.narrative !== null;
  const ninaOn =
    QueryResult.isSuccess(viewer) && viewer.value.tenant.policies.nina;
  const draft = student.draft?.text ?? null;

  return (
    <>
      <Button onClick={() => setOpen(true)} type="button" variant="outline">
        {student.name}
      </Button>
      <ResponsiveDialog
        description={t("narrative-description")}
        footer={
          <>
            <Button
              onClick={() => setOpen(false)}
              type="button"
              variant="outline"
            >
              {common("cancel")}
            </Button>
            {ninaOn ? (
              <Button
                disabled={asked && draft === null}
                onClick={() =>
                  startSaving(async () => {
                    setAsked(true);
                    await saveSchool(() => ask(names), SOURCE);
                  })
                }
                type="button"
                variant="outline"
              >
                {t("narrative-ask")}
              </Button>
            ) : null}
            {saved ? (
              <Button
                disabled={isSaving}
                onClick={() =>
                  startSaving(() =>
                    saveSchool(
                      () => (shared ? withdraw(names) : share(names)),
                      SOURCE
                    )
                  )
                }
                type="button"
                variant="outline"
              >
                {shared ? t("narrative-withdraw") : t("narrative-share")}
              </Button>
            ) : null}
            <Button
              disabled={isSaving || text.trim() === ""}
              onClick={() =>
                startSaving(() =>
                  saveSchool(
                    () => write({ ...names, text: text.trim() }),
                    SOURCE
                  )
                )
              }
              type="button"
            >
              {t("narrative-save")}
            </Button>
          </>
        }
        open={open}
        setOpen={setOpen}
        title={t("narrative-title", { student: student.name })}
      >
        <div className="flex flex-col gap-3">
          {asked && draft === null ? (
            <p className="text-muted-foreground text-sm">
              {t("narrative-drafting")}
            </p>
          ) : null}
          {draft === null ? null : (
            <div className="flex flex-col items-start gap-2">
              <p className="text-muted-foreground text-sm">
                {t("narrative-draft")}
              </p>
              <p className="text-sm" dir="auto">
                {draft}
              </p>
              <Button
                onClick={() => setText(draft)}
                type="button"
                variant="outline"
              >
                {t("narrative-use")}
              </Button>
            </div>
          )}
          <Textarea
            aria-label={t("narrative-title", { student: student.name })}
            maxLength={NARRATIVE_LIMIT}
            onChange={(event) => setText(event.target.value)}
            rows={6}
            value={text}
          />
        </div>
      </ResponsiveDialog>
    </>
  );
}
