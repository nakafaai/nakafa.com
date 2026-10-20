import { QueryResult, useMutation } from "@confect/react";
import tenancy from "@repo/backend/confect/_generated/refs/tenancy";
import {
  EMAIL_DOMAIN_LIMIT,
  type Policy,
  TenantPolicies,
} from "@repo/backend/confect/tenancy/policy";
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
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@repo/design-system/components/ui/field";
import { Switch } from "@repo/design-system/components/ui/switch";
import { Textarea } from "@repo/design-system/components/ui/textarea";
import { Array as Arr, Option, Schema } from "effect";
import { startTransition, useId, useState } from "react";
import { useTranslations } from "use-intl";
import {
  CardSection,
  CardSectionActions,
  CardSectionFooter,
} from "@/components/shared/card/section";
import { useViewerQuery } from "@/components/tenant/context";
import { ReadBoundary } from "@/components/tenant/read/boundary";
import { setPolicyChange } from "@/components/tenant/settings/mutation";
import { SettingsPage } from "@/components/tenant/settings/page";
import { saveSchool } from "@/components/tenant/settings/save";
import { SchoolTrailAction } from "@/components/tenant/settings/trail";

const SOURCE = "components/tenant/settings/policies";

/** The policies of the school as the settings page reads them. */
type SchoolPolicies = typeof TenantPolicies.Type;

/** The section in the settings page frame, whose header shows while its body loads. */
export function SchoolPoliciesSettings({ slug }: { slug: TenantSlug }) {
  return (
    <SettingsPage>
      <ReadBoundary read={{ args: { slug }, ref: tenancy.viewer.get }}>
        <SchoolPoliciesBody slug={slug} />
      </ReadBoundary>
    </SettingsPage>
  );
}

/**
 * Renders the policies of the school: the students' card with the Nina and thread
 * switches, and the allowed email domains.
 */
function SchoolPoliciesBody({ slug }: { slug: TenantSlug }) {
  const viewer = useViewerQuery();

  if (QueryResult.isFailure(viewer)) {
    throw viewer.error;
  }
  if (!QueryResult.isSuccess(viewer)) {
    return null;
  }

  return (
    <>
      <SchoolStudentsPolicy
        policies={viewer.value.tenant.policies}
        slug={slug}
      />
      <SchoolDomainsPolicy
        policies={viewer.value.tenant.policies}
        slug={slug}
      />
    </>
  );
}

/**
 * Renders the policies of the students as one card: the Nina and thread switches,
 * each saved at once, with the audit trail in its footer.
 */
function SchoolStudentsPolicy({
  policies,
  slug,
}: {
  policies: SchoolPolicies;
  slug: TenantSlug;
}) {
  const t = useTranslations("SchoolSettings");

  return (
    <CardSection>
      <CardHeader>
        <CardTitle>{t("policy-students")}</CardTitle>
        <CardDescription>{t("policy-students-description")}</CardDescription>
      </CardHeader>
      <CardContent>
        <FieldGroup>
          <SchoolSwitchPolicy
            buildPolicy={(value) => ({ key: "nina", value })}
            checked={policies.nina}
            description="policy-nina-description"
            slug={slug}
            title="policy-nina"
          />
          <SchoolSwitchPolicy
            buildPolicy={(value) => ({ key: "studentThreads", value })}
            checked={policies.studentThreads}
            description="policy-threads-description"
            slug={slug}
            title="policy-threads"
          />
        </FieldGroup>
      </CardContent>
      <CardSectionFooter hint={t("policy-students-footer")}>
        <CardSectionActions>
          <SchoolTrailAction />
        </CardSectionActions>
      </CardSectionFooter>
    </CardSection>
  );
}

/**
 * Renders one policy that is on or off as a row of the students' card, with its
 * description under its label, and saves each change at once.
 */
function SchoolSwitchPolicy({
  buildPolicy,
  checked,
  description,
  slug,
  title,
}: {
  buildPolicy: (value: boolean) => typeof Policy.Type;
  checked: boolean;
  description: "policy-nina-description" | "policy-threads-description";
  slug: TenantSlug;
  title: "policy-nina" | "policy-threads";
}) {
  const t = useTranslations("SchoolSettings");
  const setPolicy = useMutation(
    tenancy.settings.setPolicy
  ).withOptimisticUpdate(setPolicyChange);
  const id = useId();

  return (
    <Field orientation="horizontal">
      <FieldContent>
        <FieldLabel htmlFor={id}>{t(title)}</FieldLabel>
        <FieldDescription>{t(description)}</FieldDescription>
      </FieldContent>
      <Switch
        checked={checked}
        id={id}
        onCheckedChange={(value) => {
          startTransition(() =>
            saveSchool(
              () => setPolicy({ policy: buildPolicy(value), slug }),
              SOURCE
            )
          );
        }}
      />
    </Field>
  );
}

/**
 * Renders the allowed email domains, one domain a line. An empty list admits every
 * address, and the server refuses a domain it does not accept, so the form saves
 * only a list that the policy schema reads.
 */
function SchoolDomainsPolicy({
  policies,
  slug,
}: {
  policies: SchoolPolicies;
  slug: TenantSlug;
}) {
  const t = useTranslations("SchoolSettings");
  const setPolicy = useMutation(
    tenancy.settings.setPolicy
  ).withOptimisticUpdate(setPolicyChange);
  const [draft, setDraft] = useState(() =>
    Arr.join(policies.emailDomains, "\n")
  );
  const errorId = useId();
  const domains = parseDomains(draft);
  const isChanged =
    Arr.join(domains, "\n") !== Arr.join(policies.emailDomains, "\n");
  const invalid = Arr.filter(domains, (domain) =>
    Option.isNone(parsedDomains([domain]))
  );
  let problem: string | null = null;
  if (Arr.isReadonlyArrayNonEmpty(invalid)) {
    problem = t("policy-domains-invalid", { domains: Arr.join(invalid, ", ") });
  } else if (Option.isNone(parsedDomains(domains))) {
    problem = t("policy-domains-limit", { limit: EMAIL_DOMAIN_LIMIT });
  }

  return (
    <CardSection>
      <CardHeader>
        <CardTitle>{t("policy-domains")}</CardTitle>
        <CardDescription>{t("policy-domains-description")}</CardDescription>
      </CardHeader>
      <CardContent>
        <Textarea
          aria-describedby={problem === null ? undefined : errorId}
          aria-invalid={problem !== null}
          aria-label={t("policy-domains")}
          className="max-w-md"
          onChange={(event) => setDraft(event.target.value)}
          placeholder={t("policy-domains-placeholder")}
          value={draft}
        />
        {problem === null ? null : (
          <FieldError className="max-w-md" id={errorId}>
            {problem}
          </FieldError>
        )}
      </CardContent>
      <CardSectionFooter hint={t("policy-domains-footer")}>
        <CardSectionActions>
          <Button
            disabled={!isChanged || problem !== null}
            onClick={() => {
              const value = parsedDomains(domains);
              if (Option.isSome(value)) {
                startTransition(() =>
                  saveSchool(
                    () =>
                      setPolicy({
                        policy: { key: "emailDomains", value: value.value },
                        slug,
                      }),
                    SOURCE
                  )
                );
              }
            }}
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

/** Reads the lines of the form as domain names: lowercase, one per non-empty line. */
function parseDomains(text: string) {
  return Arr.filter(
    Arr.map(text.split("\n"), (line) => line.trim().toLowerCase()),
    (line) => line !== ""
  );
}

/** The domains of the form as the policy schema reads them, or none when the schema refuses them. */
function parsedDomains(domains: readonly string[]) {
  return Schema.decodeOption(TenantPolicies.fields.emailDomains)(domains);
}
