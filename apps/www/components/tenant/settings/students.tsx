"use client";

import type { Ref } from "@confect/core";
import {
  type PaginatedQueryItem,
  PaginatedQueryResult,
  useMutation,
  usePaginatedQuery,
} from "@confect/react";
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
import { Intersection } from "@repo/design-system/components/ui/intersection";
import {
  Table,
  TableBody,
  TableCell,
  TableRow,
} from "@repo/design-system/components/ui/table";
import { Array as Arr } from "effect";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import {
  CardSection,
  CardSectionActions,
  CardSectionFooter,
  CardSectionHint,
} from "@/components/shared/card/section";
import type { PersonId } from "@/components/tenant/settings/people";
import { SchoolPersonCard } from "@/components/tenant/settings/person";
import { saveSchool } from "@/components/tenant/settings/save.client";
import { SchoolSecretDialog } from "@/components/tenant/settings/secret";
import { SchoolTableHeader } from "@/components/tenant/settings/table";
import { SchoolDateTime } from "@/components/tenant/settings/time";

const SOURCE = "components/tenant/settings/students";

/** How many login names one page of the list loads, and each page after it. */
const PAGE_SIZE = 25;

/** A login card as the server issues it: the code the student types once. */
type IssuedCard = Ref.Returns<typeof identity.cards.issue>;

/** One school login as the logins list shows it. */
type LoginItem = PaginatedQueryItem<typeof identity.logins.list>;

/**
 * Renders the login cards of the school's people: the login names already given, the
 * person whose card is issued, the form that issues the first card with a login name,
 * and the action that reissues a card. A card's code shows once, when the server answers.
 */
export function SchoolStudentsSettings({ slug }: { slug: TenantSlug }) {
  const t = useTranslations("SchoolSettings");
  const [personId, setPersonId] = useState<PersonId | undefined>(undefined);

  return (
    <>
      <SchoolLoginsCard slug={slug} />
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

/**
 * Renders the school logins as a list that loads more rows as its end comes into
 * view, with the person of each login and the time it was issued.
 */
function SchoolLoginsCard({ slug }: { slug: TenantSlug }) {
  const t = useTranslations("SchoolSettings");
  const pagination = usePaginatedQuery(
    identity.logins.list,
    { slug },
    { initialNumItems: PAGE_SIZE }
  );

  if (PaginatedQueryResult.isFailure(pagination)) {
    throw pagination.error;
  }

  return (
    <CardSection>
      <CardHeader>
        <CardTitle>{t("logins")}</CardTitle>
        <CardDescription>{t("logins-description")}</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <SchoolTableHeader
            columns={[t("login-name"), t("login-person"), t("login-issued")]}
          />
          <TableBody>
            {Arr.map(pagination.results, (login) => (
              <SchoolLoginRow key={login.loginName} login={login} slug={slug} />
            ))}
          </TableBody>
        </Table>
        {PaginatedQueryResult.isCanLoadMore(pagination) ? (
          <Intersection onIntersect={() => pagination.loadMore(PAGE_SIZE)} />
        ) : null}
      </CardContent>
      <CardSectionFooter>
        <CardSectionHint>{t("logins-footer")}</CardSectionHint>
      </CardSectionFooter>
    </CardSection>
  );
}

/** Renders one school login: its login name, its person, and when it was issued. */
function SchoolLoginRow({
  login,
  slug,
}: {
  login: LoginItem;
  slug: TenantSlug;
}) {
  return (
    <TableRow>
      <TableCell>{login.loginName}</TableCell>
      <TableCell>{login.person.name}</TableCell>
      <TableCell>
        <SchoolDateTime at={login.issuedAt} slug={slug} />
      </TableCell>
    </TableRow>
  );
}

/**
 * Renders the form that issues or reissues the login card of one person. The buttons
 * stay as they are while a request runs, and are inert then.
 */
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
  const [isPending, startTransition] = useTransition();
  const [loginName, setLoginName] = useState("");
  const [issued, setIssued] = useState<IssuedCard | undefined>(undefined);

  return (
    <CardSection>
      <CardHeader>
        <CardTitle>{t("card-issue-title")}</CardTitle>
        <CardDescription>{t("card-issue-description")}</CardDescription>
      </CardHeader>
      <CardContent>
        <Input
          aria-label={t("card-login-name")}
          className="w-full max-w-xs"
          onChange={(event) => setLoginName(event.target.value)}
          placeholder={t("card-login-name-placeholder")}
          value={loginName}
        />
      </CardContent>
      <CardSectionFooter>
        <CardSectionHint>{t("card-issue-footer")}</CardSectionHint>
        <CardSectionActions>
          <Button
            inert={isPending}
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
            inert={isPending}
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
      <SchoolSecretDialog
        description={t("card-code-description")}
        onClose={() => setIssued(undefined)}
        secret={issued?.code}
        title={t("card-code-title")}
      />
    </CardSection>
  );
}
