import { QueryResult, useMutation, useQuery } from "@confect/react";
import insight from "@repo/backend/confect/_generated/refs/insight";
import { Button } from "@repo/design-system/components/ui/button";
import {
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/design-system/components/ui/card";
import {
  Field,
  FieldGroup,
  FieldLabel,
} from "@repo/design-system/components/ui/field";
import { Input } from "@repo/design-system/components/ui/input";
import { DateTime } from "effect";
import { useId, useState, useTransition } from "react";
import { useFormatter, useTranslations } from "use-intl";
import { useConvexAuth } from "@/components/auth/convex";
import {
  CardSection,
  CardSectionFooter,
} from "@/components/shared/card/section";
import { useTenant } from "@/components/tenant/context";
import { saveSchool } from "@/components/tenant/settings/save";

const SOURCE = "components/tenant/settings/dpia";

/**
 * The school's impact assessment (ADR 0035): the one in force, and the record of a new version. Insight stays off until
 * one is on record.
 */
export function SchoolDpia() {
  const t = useTranslations("SchoolSettings");
  const format = useFormatter();
  const { slug } = useTenant();
  const id = useId();
  const isSettled = useConvexAuth((auth) => !auth.isLoading);
  const dpia = useQuery(insight.dpia.get, isSettled ? { slug } : "skip");
  const record = useMutation(insight.dpia.record);
  const [version, setVersion] = useState("");
  const [reviewer, setReviewer] = useState("");
  const [isSaving, startSaving] = useTransition();
  const current =
    QueryResult.isSuccess(dpia) && dpia.value !== null ? dpia.value : null;

  return (
    <CardSection>
      <CardHeader>
        <CardTitle>{t("dpia-title")}</CardTitle>
        <CardDescription>
          {current === null
            ? t("dpia-off")
            : t("dpia-on", {
                date: format.dateTime(
                  DateTime.toDateUtc(DateTime.makeUnsafe(current.recordedAt)),
                  { dateStyle: "medium" }
                ),
                reviewer: current.reviewer,
                version: current.version,
              })}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor={`${id}-version`}>
              {t("dpia-version")}
            </FieldLabel>
            <Input
              id={`${id}-version`}
              onChange={(event) => setVersion(event.target.value)}
              value={version}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor={`${id}-reviewer`}>
              {t("dpia-reviewer")}
            </FieldLabel>
            <Input
              id={`${id}-reviewer`}
              onChange={(event) => setReviewer(event.target.value)}
              value={reviewer}
            />
          </Field>
        </FieldGroup>
      </CardContent>
      <CardSectionFooter>
        <Button
          disabled={isSaving || version.trim() === "" || reviewer.trim() === ""}
          onClick={() =>
            startSaving(() =>
              saveSchool(
                () =>
                  record({
                    reviewer: reviewer.trim(),
                    slug,
                    version: version.trim(),
                  }),
                SOURCE,
                () => {
                  setVersion("");
                  setReviewer("");
                }
              )
            )
          }
          type="button"
        >
          {t("dpia-record")}
        </Button>
      </CardSectionFooter>
    </CardSection>
  );
}
