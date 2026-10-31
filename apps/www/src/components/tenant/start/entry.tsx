import {
  PaginatedQueryResult,
  QueryResult,
  usePaginatedQuery,
  useQuery,
} from "@confect/react";
import onboarding from "@repo/backend/confect/_generated/refs/onboarding";
import tenancy from "@repo/backend/confect/_generated/refs/tenancy";
import type { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Button } from "@repo/design-system/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@repo/design-system/components/ui/field";
import { Input } from "@repo/design-system/components/ui/input";
import { Spinner } from "@repo/design-system/components/ui/spinner";
import { Navigate } from "@tanstack/react-router";
import { Array as Arr, Effect, Option } from "effect";
import {
  type FormEvent,
  useEffect,
  useId,
  useState,
  useTransition,
} from "react";
import { useTranslations } from "use-intl";
import { useConvexAuth } from "@/components/auth/convex";
import { useAuthSession } from "@/components/auth/session";
import {
  getPostAuthSignInHref,
  resolvePostAuthIntent,
} from "@/lib/auth/admission";
import {
  loadKnownSchoolsText,
  readKnownSchools,
  saveKnownSchools,
} from "@/lib/identity/schools";
import { Link, useCurrentLocale } from "@/lib/routing/link";
import { schoolOrigin } from "@/lib/routing/school/host";
import { readSchoolAddress, schoolEntryOf } from "@/lib/tenant/entry";

/** Long enough for the school's page to arrive, so a press that went nowhere can press again. */
const LEAVING = "4 seconds";

/** Reads the schools the browser kept, as their stored text. */
function readKeptText() {
  return Effect.runSync(loadKnownSchoolsText());
}

/** What this page shows while it leaves or while it reads where to go. */
function EntryWaiting() {
  return <Spinner className="text-muted-foreground" />;
}

/** Leaves for one school's own address, replacing this page in the history. */
function EnterSchool({ slug }: { slug: TenantSlug }) {
  useEffect(() => {
    window.location.replace(schoolOrigin(slug).href);
  }, [slug]);

  return <EntryWaiting />;
}

/** Sends a signed-out visitor to sign in, and back to this page after. */
function SignInFirst() {
  const locale = useCurrentLocale();

  useEffect(() => {
    const intent = resolvePostAuthIntent(`/${locale}/school`, locale);
    window.location.replace(`/${locale}${getPostAuthSignInHref(intent)}`);
  }, [locale]);

  return <EntryWaiting />;
}

/**
 * The form that finds a school for an account with none: its address, a host or
 * the whole link the school sent all work. A school's own page then signs the
 * person in, or takes the room code from there.
 */
function SchoolJoin({ guardian }: { guardian: boolean }) {
  const t = useTranslations("SchoolStart");
  const locale = useCurrentLocale();
  const id = useId();
  const [typed, setTyped] = useState("");
  const [isInvalid, setInvalid] = useState(false);
  const [isLeaving, startLeaving] = useTransition();

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const school = readSchoolAddress(typed);
    setInvalid(Option.isNone(school));
    if (Option.isNone(school)) {
      return;
    }
    startLeaving(async () => {
      window.location.assign(schoolOrigin(school.value).href);
      await Effect.runPromise(Effect.sleep(LEAVING));
    });
  };

  return (
    <div className="flex w-full max-w-sm flex-col gap-6">
      <div className="flex flex-col gap-2 text-center">
        <h1 className="text-2xl font-medium tracking-tight">
          {t("entry-title")}
        </h1>
        <p className="text-muted-foreground text-pretty">
          {t(guardian ? "entry-parent" : "entry-student")}
        </p>
      </div>
      <form className="flex flex-col gap-6" noValidate onSubmit={submit}>
        <Field data-invalid={isInvalid}>
          <FieldLabel htmlFor={id}>{t("entry-field")}</FieldLabel>
          <Input
            aria-invalid={isInvalid}
            autoCapitalize="none"
            autoComplete="off"
            autoCorrect="off"
            enterKeyHint="go"
            id={id}
            inputMode="url"
            onChange={(event) => {
              setTyped(event.target.value);
              setInvalid(false);
            }}
            placeholder="harapan.nakafa.com"
            spellCheck={false}
            value={typed}
          />
          <FieldDescription>{t("entry-hint")}</FieldDescription>
          <FieldError>{isInvalid ? t("entry-invalid") : null}</FieldError>
        </Field>
        <div className="flex flex-col gap-2">
          <Button disabled={isLeaving} type="submit">
            {isLeaving ? <Spinner /> : null}
            {t("entry-submit")}
          </Button>
          <Button
            render={<Link params={{ locale }} to="/$locale/school/new" />}
            variant="outline"
          >
            {t("entry-open")}
          </Button>
        </div>
      </form>
    </div>
  );
}

/**
 * Decides from the account's live schools and role, once Convex holds its session.
 * A school the account has always wins, and the live list is kept for the next visit.
 */
function SchoolEntryLive() {
  const locale = useCurrentLocale();
  const sessionId = useAuthSession((session) => session.sessionId);
  const memberships = usePaginatedQuery(
    tenancy.memberships.list,
    {},
    { initialNumItems: 1 }
  );
  const status = useQuery(onboarding.queries.getStatus, {});
  const isAnswered = !(
    PaginatedQueryResult.isLoadingFirstPage(memberships) ||
    PaginatedQueryResult.isFailure(memberships)
  );

  useEffect(() => {
    if (isAnswered && sessionId !== null) {
      Effect.runSync(
        saveKnownSchools(
          sessionId,
          Arr.map(memberships.results, ({ tenant }) => tenant)
        )
      );
    }
  }, [isAnswered, memberships.results, sessionId]);

  if (PaginatedQueryResult.isFailure(memberships)) {
    throw memberships.error;
  }
  if (QueryResult.isFailure(status)) {
    throw status.error;
  }
  if (!(isAnswered && QueryResult.isSuccess(status))) {
    return <EntryWaiting />;
  }
  const entry = schoolEntryOf(
    Option.map(Arr.head(memberships.results), ({ tenant }) => tenant.slug),
    status.value.profile?.role
  );
  if (entry._tag === "Enter") {
    return <EnterSchool slug={entry.slug} />;
  }
  if (entry._tag === "Open") {
    return <Navigate params={{ locale }} replace to="/$locale/school/new" />;
  }
  return <SchoolJoin guardian={entry.guardian} />;
}

/**
 * The address School leads to, which knows the account. A school the browser kept
 * goes at once, so a person who has one never waits for a read; everyone else waits
 * for Convex's session and the live answer.
 */
export function SchoolEntry() {
  const sessionId = useAuthSession((session) => session.sessionId);
  const [kept] = useState(readKeptText);
  const isSettled = useConvexAuth((auth) => !auth.isLoading);
  const isSignedIn = useConvexAuth((auth) => auth.isAuthenticated);
  const school = Arr.head(readKnownSchools(kept, sessionId));

  if (Option.isSome(school)) {
    return <EnterSchool slug={school.value.slug} />;
  }
  if (!isSettled) {
    return <EntryWaiting />;
  }
  return isSignedIn ? <SchoolEntryLive /> : <SignInFirst />;
}
