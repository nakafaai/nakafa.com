import { Button } from "@repo/design-system/components/ui/button";
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
 * signed-in hint of the root picks the one that shows, as `LogoCta` does.
 */
export function HeaderCta() {
  const t = useTranslations("Marketing");

  return (
    <>
      <span className="contents" data-account="visitor">
        <Button
          nativeButton={false}
          render={
            <Link activeOptions={EXACT_ACTIVE_OPTIONS} to="/$locale/auth">
              {t("try-nakafa")}
            </Link>
          }
          variant="secondary"
        />
      </span>
      <span className="contents" data-account="member">
        <Button
          nativeButton={false}
          render={
            <Link activeOptions={EXACT_ACTIVE_OPTIONS} to="/$locale/home">
              {t("try-nakafa")}
            </Link>
          }
          variant="secondary"
        />
      </span>
    </>
  );
}
