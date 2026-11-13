import { assert, describe, it } from "@effect/vitest";
import { Array as Arr, Effect } from "effect";
import { inspectOptionSource } from "#scripts/check/options";
import { parseSources } from "#scripts/check/source";

const VIEW = "apps/www/src/components/example.tsx";

/** Inspects one module with the option icon policy alone. */
function inspect(sourceText: string, file = VIEW) {
  return Effect.scoped(
    Effect.map(parseSources([{ file, sourceText }]), ({ modules }) =>
      Arr.flatMap(modules, (parsed) =>
        inspectOptionSource(parsed.file, parsed.sourceFile)
      )
    )
  );
}

describe("Option icon source policy", () => {
  it.effect(
    "rejects a list whose options all show one icon, mapped or written",
    () =>
      Effect.gen(function* () {
        assert.deepStrictEqual(
          yield* inspect(`
export function Languages({ icon }) {
  return (
    <>
      <SelectContent label={t("menu-language")}>
        {Arr.map(languages, (language) => (
          <SelectItem icon={TranslateIcon} key={language.value} value={language.value}>
            {language.label}
          </SelectItem>
        ))}
      </SelectContent>
      <DropdownMenuContent label={t("menu-speed")}>
        {speeds.map(function (speed) {
          return <DropdownMenuRadioItem icon={icon} value={speed} />;
        })}
      </DropdownMenuContent>
      <DropdownMenuContent label={t("menu-actions")}>
        <DropdownMenuItem icon={Add01Icon}>{t("add")}</DropdownMenuItem>
        <DropdownMenuItem icon={Add01Icon}>{t("copy")}</DropdownMenuItem>
      </DropdownMenuContent>
    </>
  );
}`),
          [
            `${VIEW}:7: every option of this list shows TranslateIcon: give each option its own icon, or mark a list of values plain.`,
            `${VIEW}:14: every option of this list shows icon: give each option its own icon, or mark a list of values plain.`,
            `${VIEW}:17: 2 options side by side all show Add01Icon: give each option its own icon, or mark a list of values plain.`,
          ]
        );
      })
  );

  it.effect(
    "accepts options whose icon reads the item and options with icons of their own",
    () =>
      Effect.gen(function* () {
        assert.deepStrictEqual(
          yield* inspect(`
export function Languages() {
  return (
    <>
      <SelectContent label={t("menu-language")}>
        {Arr.map(languages, ({ country, value }) => (
          <SelectItem icon={flagOf(country)} key={value} value={value} />
        ))}
        {Arr.map(languages, (language) => {
          const flag = FLAGS[language.country];
          return <SelectItem icon={flag} value={language.value} />;
        })}
        {Arr.map(languages, (language) => <Flag language={language} />)}
        {Arr.map(languages, labelOf)}
        {languages.filter(isLive)}
      </SelectContent>
      <DropdownMenuContent label={t("menu-actions")}>
        <DropdownMenuItem icon={Add01Icon}>{t("add")}</DropdownMenuItem>
        <DropdownMenuItem icon={Copy01Icon}>{t("copy")}</DropdownMenuItem>
        <DropdownMenuItem>{t("plain")}</DropdownMenuItem>
      </DropdownMenuContent>
      <DropdownMenuContent label={t("menu-one")}>
        <DropdownMenuItem icon={Add01Icon}>{t("add")}</DropdownMenuItem>
      </DropdownMenuContent>
    </>
  );
}`),
          []
        );
        assert.deepStrictEqual(
          yield* inspect(
            "export const list = [1].map(() => <SelectItem icon={A} />);",
            "apps/www/src/components/example.ts"
          ),
          []
        );
      })
  );
});
