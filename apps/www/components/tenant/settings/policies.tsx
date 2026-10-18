"use client";

import { QueryResult, useMutation, useQuery } from "@confect/react";
import tenancy from "@repo/backend/confect/_generated/refs/tenancy";
import {
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
import { Label } from "@repo/design-system/components/ui/label";
import { Switch } from "@repo/design-system/components/ui/switch";
import { Textarea } from "@repo/design-system/components/ui/textarea";
import { Array as Arr, Option, Schema } from "effect";
import { useTranslations } from "next-intl";
import { startTransition, useId, useState } from "react";
import {
  CardSection,
  CardSectionActions,
  CardSectionFooter,
  CardSectionHint,
} from "@/components/shared/card/section";
import { setPolicyChange } from "@/components/tenant/settings/mutation.client";
import { saveSchool } from "@/components/tenant/settings/save.client";
import { SchoolTrailAction } from "@/components/tenant/settings/trail";

const SOURCE = "components/tenant/settings/policies";

/** The policies of the school as the settings page reads them. */
type SchoolPolicies = typeof TenantPolicies.Type;

/**
 * Renders the policies of the school: the students' card with the Nina and thread
 * switches, and the allowed email domains.
 */
export function SchoolPoliciesSettings({ slug }: { slug: TenantSlug }) {
  const viewer = useQuery(tenancy.viewer.get, { slug });

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
      <CardContent className="grid gap-4">
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
      </CardContent>
      <CardSectionFooter>
        <CardSectionHint>{t("policy-students-footer")}</CardSectionHint>
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
    <div className="flex items-center justify-between gap-4">
      <div className="grid min-w-0 gap-1">
        <Label htmlFor={id}>{t(title)}</Label>
        <p className="text-muted-foreground text-sm">{t(description)}</p>
      </div>
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
    </div>
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
  const id = useId();
  const domains = parseDomains(draft);
  const isChanged =
    Arr.join(domains, "\n") !== Arr.join(policies.emailDomains, "\n");

  return (
    <CardSection>
      <CardHeader>
        <CardTitle>{t("policy-domains")}</CardTitle>
        <CardDescription>{t("policy-domains-description")}</CardDescription>
      </CardHeader>
      <CardContent>
        <Label className="sr-only" htmlFor={id}>
          {t("policy-domains")}
        </Label>
        <Textarea
          className="w-full max-w-md"
          id={id}
          onChange={(event) => setDraft(event.target.value)}
          placeholder={t("policy-domains-placeholder")}
          value={draft}
        />
      </CardContent>
      <CardSectionFooter>
        <CardSectionHint>{t("policy-domains-footer")}</CardSectionHint>
        <CardSectionActions>
          <Button
            disabled={!isChanged || Option.isNone(parsedDomains(domains))}
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
