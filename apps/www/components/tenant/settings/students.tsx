"use client";

import type { Ref } from "@confect/core";
import { useMutation } from "@confect/react";
import identity from "@repo/backend/confect/_generated/refs/identity";
import type { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Button } from "@repo/design-system/components/ui/button";
import {
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/design-system/components/ui/card";
import { Input } from "@repo/design-system/components/ui/input";
import { ResponsiveDialog } from "@repo/design-system/components/ui/responsive-dialog";
import { useTranslations } from "next-intl";
import { startTransition, useState } from "react";
import {
  CardSection,
  CardSectionActions,
  CardSectionFooter,
  CardSectionHint,
} from "@/components/shared/card/section";
import type { PersonId } from "@/components/tenant/settings/people";
import { SchoolPersonCard } from "@/components/tenant/settings/person";
import { saveSchool } from "@/components/tenant/settings/save.client";

const SOURCE = "components/tenant/settings/students";

/** A login card as the server issues it: the code the student types once. */
type IssuedCard = Ref.Returns<typeof identity.cards.issue>;

/**
 * Renders the login cards of the school's people: the person whose card is issued,
 * the form that issues the first card with a login name, and the action that
 * reissues a card. A card's code shows once, when the server answers.
 */
export function SchoolStudentsSettings({ slug }: { slug: TenantSlug }) {
  const t = useTranslations("SchoolSettings");
  const [personId, setPersonId] = useState<PersonId | undefined>(undefined);

  return (
    <>
      <SchoolPersonCard
        description={t("students-description")}
        onChoose={setPersonId}
        personId={personId}
        slug={slug}
        title={t("students")}
      />
      {personId === undefined ? null : (
        <SchoolCardForm personId={personId} slug={slug} />
      )}
    </>
  );
}

/** Renders the form that issues or reissues the login card of one person. */
function SchoolCardForm({
  personId,
  slug,
}: {
  personId: PersonId;
  slug: TenantSlug;
}) {
  const t = useTranslations("SchoolSettings");
  const issue = useMutation(identity.cards.issue);
  const reissue = useMutation(identity.cards.reissue);
  const [loginName, setLoginName] = useState("");
  const [issued, setIssued] = useState<IssuedCard | undefined>(undefined);

  return (
    <CardSection>
      <CardHeader>
        <CardTitle>{t("card-issue")}</CardTitle>
        <CardDescription>{t("card-issue-description")}</CardDescription>
      </CardHeader>
      <CardContent>
        <Input
          aria-label={t("card-login-name")}
          onChange={(event) => setLoginName(event.target.value)}
          placeholder={t("card-login-name-placeholder")}
          value={loginName}
        />
      </CardContent>
      <CardSectionFooter>
        <CardSectionHint>{t("card-issue-footer")}</CardSectionHint>
        <CardSectionActions>
          <Button
            onClick={() =>
              startTransition(() =>
                saveSchool(() => reissue({ personId, slug }), SOURCE, setIssued)
              )
            }
            size="sm"
            type="button"
            variant="outline"
          >
            {t("card-reissue")}
          </Button>
          <Button
            disabled={loginName.trim() === ""}
            onClick={() =>
              startTransition(() =>
                saveSchool(
                  () =>
                    issue({
                      loginName: loginName.trim(),
                      personId,
                      slug,
                    }),
                  SOURCE,
                  setIssued
                )
              )
            }
            size="sm"
            type="button"
          >
            {t("card-issue")}
          </Button>
        </CardSectionActions>
      </CardSectionFooter>
      <ResponsiveDialog
        description={t("card-code-description")}
        open={issued !== undefined}
        setOpen={(open) => {
          if (!open) {
            setIssued(undefined);
          }
        }}
        title={t("card-code-title")}
      >
        <code className="break-all rounded-md bg-muted p-3 text-sm">
          {issued?.code}
        </code>
      </ResponsiveDialog>
    </CardSection>
  );
}
