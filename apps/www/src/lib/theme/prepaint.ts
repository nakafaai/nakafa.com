import {
  concreteThemeValues,
  THEME_STORAGE_KEY,
  themes,
} from "@repo/design-system/lib/theme/registry";
import { Array as Arr, Record as Rec, Schema } from "effect";

/** The registry values that the inline script reads, as one JSON document. */
const PrepaintConfig = Schema.Struct({
  appearances: Schema.Record(Schema.String, Schema.String),
  concreteThemes: Schema.Array(Schema.String),
  storageKey: Schema.String,
});

/** Escapes markup characters, so the JSON cannot close the script element. */
const configJson = Schema.encodeSync(Schema.fromJsonString(PrepaintConfig))({
  appearances: Rec.fromEntries(
    Arr.map(
      Arr.filter(themes, (theme) => theme.appearance !== "dynamic"),
      (theme): readonly [string, string] => [theme.value, theme.appearance]
    )
  ),
  concreteThemes: concreteThemeValues,
  storageKey: THEME_STORAGE_KEY,
}).replaceAll("<", "\\u003c");

/**
 * Applies the visitor's stored theme before the first paint. A concrete theme
 * names the class on the root element, as the theme store does once it mounts; a
 * missing, system or unknown value resolves to the system appearance.
 */
export const THEME_PREPAINT_SCRIPT = `(function () {
  var root = document.documentElement;
  var config = ${configJson};
  var stored = null;
  try {
    stored = window.localStorage.getItem(config.storageKey);
  } catch (error) {}
  var system = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  var isConcrete = config.concreteThemes.indexOf(stored) !== -1;
  root.classList.add(isConcrete ? stored : system);
  root.style.colorScheme = isConcrete ? config.appearances[stored] : system;
})();`;
