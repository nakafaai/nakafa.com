import { useMutation } from "@confect/react";
import tenancy from "@repo/backend/confect/_generated/refs/tenancy";
import { SchoolName } from "@repo/backend/confect/tenancy/schema";
import type { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Button } from "@repo/design-system/components/ui/button";
import {
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/design-system/components/ui/card";
import {
  Field,
  FieldDescription,
  FieldLabel,
} from "@repo/design-system/components/ui/field";
import { Input } from "@repo/design-system/components/ui/input";
import { Schema } from "effect";
import { startTransition, useId, useState } from "react";
import { useTranslations } from "use-intl";
import {
  CardSection,
  CardSectionActions,
  CardSectionFooter,
} from "@/components/shared/card/section";
import { setNameChange } from "@/components/tenant/settings/mutation";
import { saveSchool } from "@/components/tenant/settings/save";

const SOURCE = "components/tenant/settings/name";

/** Whether a trimmed name can name the school: three to 120 characters on one line. */
const isSchoolName = Schema.is(SchoolName);

/**
 * The school's name, which its Owner and its Admin change. A save shows the new
 * name at once in the sidebar and on every settings page, and a refusal steps it
 * back. The field follows the stored name whenever that name changes, so it never
 * keeps a draft of a name the school no longer has.
 */
export function SchoolNameCard({
  name,
  slug,
}: {
  name: string;
  slug: TenantSlug;
}) {
  const t = useTranslations("SchoolSettings");
  const inputId = useId();
  const invalidId = useId();
  const rename = useMutation(tenancy.settings.setName).withOptimisticUpdate(
    setNameChange
  );
  const [draft, setDraft] = useState(name);
  const [seen, setSeen] = useState(name);
  if (name !== seen) {
    setSeen(name);
    setDraft(name);
  }
  const next = draft.trim();
  const changed = next !== name;
  const valid = isSchoolName(next);
  const canSave = changed && valid;
  const invalid = changed && !valid;

  return (
    <CardSection>
      <CardHeader>
        <CardTitle>{t("name-title")}</CardTitle>
        <CardDescription>{t("name-description")}</CardDescription>
      </CardHeader>
      <CardContent>
        <Field>
          <FieldLabel htmlFor={inputId}>{t("name-label")}</FieldLabel>
          <Input
            aria-describedby={invalid ? invalidId : undefined}
            aria-invalid={invalid}
            autoComplete="organization"
            className="max-w-sm"
            id={inputId}
            maxLength={120}
            onChange={(event) => setDraft(event.target.value)}
            placeholder={t("name-placeholder")}
            value={draft}
          />
          {invalid ? (
            <FieldDescription id={invalidId}>
              {t("name-invalid")}
            </FieldDescription>
          ) : null}
        </Field>
      </CardContent>
      <CardSectionFooter hint={t("name-footer")}>
        <CardSectionActions>
          <Button
            disabled={!canSave}
            onClick={() =>
              startTransition(() =>
                saveSchool(() => rename({ name: next, slug }), SOURCE)
              )
            }
            size="sm"
            type="button"
          >
            {t("save")}
          </Button>
        </CardSectionActions>
      </CardSectionFooter>
    </CardSection>
  );
}
