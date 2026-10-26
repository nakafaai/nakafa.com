import {
  Crown02Icon,
  School01Icon,
  TeacherIcon,
  UserSettings01Icon,
} from "@hugeicons/core-free-icons";
import {
  SchoolSize,
  StartCountry,
  StartRole,
} from "@repo/backend/confect/tenancy/start";
import {
  QuestionnaireDescription,
  QuestionnaireError,
  QuestionnaireItem,
  QuestionnaireTitle,
} from "@repo/design-system/components/ui/questionnaire";
import { COMPANY_IDENTITY } from "@repo/seo/company";
import { Array as Arr } from "effect";
import type { ReactNode } from "react";
import { useTranslations } from "use-intl";
import { useStart } from "@/components/tenant/start/context";
import {
  StartChoice,
  StartChoices,
  StartLevelOption,
  StartOption,
} from "@/components/tenant/start/option";
import { levelsOf } from "@/components/tenant/start/state";

/** The icon of each role a founder can take. */
const roleIcons = {
  admin: UserSettings01Icon,
  foundation: Crown02Icon,
  principal: School01Icon,
  teacher: TeacherIcon,
} as const;

/** The second question: the country, which sets the school's currency, language and school year. */
export function StartCountryQuestion() {
  const t = useTranslations("SchoolStart");
  const { draft, save } = useStart();

  return (
    <QuestionnaireItem name="country" required>
      <QuestionnaireTitle>{t("country-title")}</QuestionnaireTitle>
      <QuestionnaireDescription>
        {t("country-description")}
      </QuestionnaireDescription>
      <StartChoices>
        {Arr.map(StartCountry.literals, (country) => (
          <StartChoice
            checked={draft?.country === country}
            key={country}
            onChange={(event) => {
              if (event.target.checked) {
                save({ kind: "country", value: country });
              }
            }}
            value={country}
          >
            <StartOption country={country} title={t(`country.${country}`)} />
          </StartChoice>
        ))}
      </StartChoices>
      <QuestionnaireError>{t("required-error")}</QuestionnaireError>
    </QuestionnaireItem>
  );
}

/**
 * The third question: the levels the school teaches, one unit each. Indonesia
 * chooses from its own levels by their names; every other country chooses from
 * the stages it shares.
 */
export function StartLevelsQuestion() {
  const t = useTranslations("SchoolStart");
  const { draft, save } = useStart();
  const country = draft?.country ?? "ID";
  const offered = levelsOf(country);
  const saved = draft?.levels ?? [];

  return (
    <QuestionnaireItem multiple name="levels" required>
      <QuestionnaireTitle>{t("levels-title")}</QuestionnaireTitle>
      <QuestionnaireDescription>
        {t("levels-description")}
      </QuestionnaireDescription>
      <StartChoices>
        {Arr.map(offered, (level) => (
          <StartChoice
            checked={Arr.contains(saved, level)}
            key={level}
            onChange={(event) => {
              const chosen = event.target.checked;
              save({
                kind: "levels",
                value: Arr.filter(offered, (each) =>
                  each === level ? chosen : Arr.contains(saved, each)
                ),
              });
            }}
            value={level}
          >
            {country === "ID" ? (
              <StartLevelOption
                description={t(`level.${level}.description`)}
                title={t(`level.${level}.title`)}
              />
            ) : (
              <StartOption title={t(`stage.${level}`)} />
            )}
          </StartChoice>
        ))}
      </StartChoices>
      <QuestionnaireError>{t("levels-error")}</QuestionnaireError>
    </QuestionnaireItem>
  );
}

/** The fourth question: the founder's role, which the school's home fits from the first visit. */
export function StartRoleQuestion() {
  const t = useTranslations("SchoolStart");
  const { draft, save } = useStart();

  return (
    <QuestionnaireItem name="role" required>
      <QuestionnaireTitle>{t("role-title")}</QuestionnaireTitle>
      <QuestionnaireDescription>
        {t("role-description")}
      </QuestionnaireDescription>
      <StartChoices>
        {Arr.map(StartRole.literals, (role) => (
          <StartChoice
            checked={draft?.role === role}
            key={role}
            onChange={(event) => {
              if (event.target.checked) {
                save({ kind: "role", value: role });
              }
            }}
            value={role}
          >
            <StartOption
              description={t(`role.${role}.description`)}
              icon={roleIcons[role]}
              title={t(`role.${role}.title`)}
            />
          </StartChoice>
        ))}
      </StartChoices>
      <QuestionnaireError>{t("required-error")}</QuestionnaireError>
    </QuestionnaireItem>
  );
}

/** The sizes for which the founder is offered help to set up. */
const LARGE_SIZES: readonly (typeof SchoolSize.Type)[] = ["l", "xl"];

/**
 * The last question: how many students the school has. A large school is
 * offered the founder's help without waiting for it, and the question ends with
 * what opening the school accepts.
 */
export function StartSizeQuestion() {
  const t = useTranslations("SchoolStart");
  const { draft, legal, save } = useStart();

  return (
    <QuestionnaireItem name="size" required>
      <QuestionnaireTitle>{t("size-title")}</QuestionnaireTitle>
      <QuestionnaireDescription>
        {t("size-description")}
      </QuestionnaireDescription>
      <StartChoices>
        {Arr.map(SchoolSize.literals, (size) => (
          <StartChoice
            checked={draft?.size === size}
            key={size}
            onChange={(event) => {
              if (event.target.checked) {
                save({ kind: "size", value: size });
              }
            }}
            value={size}
          >
            <StartOption title={t(`size.${size}`)} />
          </StartChoice>
        ))}
      </StartChoices>
      <QuestionnaireError>{t("required-error")}</QuestionnaireError>
      {draft?.size !== undefined && Arr.contains(LARGE_SIZES, draft.size) ? (
        <p className="text-pretty text-muted-foreground text-sm">
          {t("founder-line")}{" "}
          <StartLink href={`mailto:${COMPANY_IDENTITY.email}`}>
            {t("founder-link")}
          </StartLink>
        </p>
      ) : null}
      {legal === null ? null : (
        <p className="text-pretty text-muted-foreground text-xs">
          {t.rich("consent", {
            privacy: (chunks) => (
              <StartLink href={legal.privacy}>{chunks}</StartLink>
            ),
            terms: (chunks) => (
              <StartLink href={legal.terms}>{chunks}</StartLink>
            ),
          })}
        </p>
      )}
    </QuestionnaireItem>
  );
}

/** A link inside a sentence of the questionnaire, opened in a new tab so the answers stay. */
function StartLink({ children, href }: { children: ReactNode; href: string }) {
  return (
    <a
      className="font-medium text-foreground underline-offset-4 hover:underline"
      href={href}
      rel="noopener noreferrer"
      target="_blank"
    >
      {children}
    </a>
  );
}
