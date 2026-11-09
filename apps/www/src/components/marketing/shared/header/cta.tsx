import { buttonVariants } from "@repo/design-system/lib/button";
import { useTranslations } from "use-intl";
import { Link } from "@/lib/routing/link";
import { EXACT_ACTIVE_OPTIONS } from "@/lib/routing/tree";

/**
 * The name of the header, written as text: the identity's Header card keeps the
 * letter logo out of the header. A visitor's name opens the locale's home, and a
 * learner's opens their home. Both are rendered, and the signed-in hint of the
 * root picks the one that shows, so the first paint needs no account state.
 */
export function LogoCta() {
  return (
    <>
      <span className="contents" data-account="visitor">
        <Link
          activeOptions={EXACT_ACTIVE_OPTIONS}
          className="font-medium"
          to="/$locale"
        >
          Nakafa
        </Link>
      </span>
      <span className="contents" data-account="member">
        <Link
          activeOptions={EXACT_ACTIVE_OPTIONS}
          className="font-medium"
          to="/$locale/home"
        >
          Nakafa
        </Link>
      </span>
    </>
  );
}

/**
 * The header's call to action: a visitor signs up, and a learner opens home. The
 * signed-in hint of the root picks the one that shows, as `LogoCta` does. Its words keep the width of the
 * School action's (`ActionLabel`).
 */
export function HeaderCta() {
  return (
    <>
      <span className="contents" data-account="visitor">
        <Link
          activeOptions={EXACT_ACTIVE_OPTIONS}
          className={buttonVariants({ variant: "secondary" })}
          to="/$locale/auth"
        >
          <ActionLabel label="try-nakafa" />
        </Link>
      </span>
      <span className="contents" data-account="member">
        <Link
          activeOptions={EXACT_ACTIVE_OPTIONS}
          className={buttonVariants({ variant: "secondary" })}
          to="/$locale/home"
        >
          <ActionLabel label="try-nakafa" />
        </Link>
      </span>
    </>
  );
}

/**
 * The header's call to action on a Nakafa School page: the school opens on the
 * start questionnaire, which signs the founder in first when they need it, and
 * every school begins with the free trial.
 */
export function SchoolCta() {
  return (
    <Link
      className={buttonVariants({ variant: "secondary" })}
      to="/$locale/school/new"
    >
      <ActionLabel label="start-school" />
    </Link>
  );
}

/**
 * The words of a header action, as wide as the wider of the two products' actions: the other product's words hold
 * the width unseen, so the language beside the action stays where it stands on the way between the two landings.
 */
function ActionLabel({ label }: { label: "start-school" | "try-nakafa" }) {
  const t = useTranslations("Marketing");

  return (
    <span className="grid justify-items-center">
      <span className="col-start-1 row-start-1">{t(label)}</span>
      <span aria-hidden="true" className="invisible col-start-1 row-start-1">
        {t(label === "try-nakafa" ? "start-school" : "try-nakafa")}
      </span>
    </span>
  );
}
