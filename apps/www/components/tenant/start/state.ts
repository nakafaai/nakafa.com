import type { Ref } from "@confect/core";
import type tenancy from "@repo/backend/confect/_generated/refs/tenancy";
import { UnitLevel } from "@repo/backend/confect/tenancy/schema";
import { answerFields } from "@repo/backend/confect/tenancy/start";
import { Array as Arr, Match, Option } from "effect";

/** The account's saved answers, or null before its first one. */
export type StartDraft = Ref.Returns<typeof tenancy.start.draft>;
/** One answer the questionnaire saves. */
export type StartAnswer = Ref.Args<typeof tenancy.start.save>["answer"];
/** The answers a school opens with. */
type StartRequest = Ref.Args<typeof tenancy.start.open>;
type Country = StartRequest["country"];
type Level = StartRequest["units"][number]["level"];

/** The questions in the order the questionnaire asks them. */
export const START_ITEMS = [
  "name",
  "country",
  "levels",
  "role",
  "size",
] as const satisfies readonly StartAnswer["kind"][];
export type StartItem = (typeof START_ITEMS)[number];

/**
 * The longest school name the questionnaire takes, which is the longest a school
 * name may be. A unit with a level label after the name stays within `UnitName`.
 */
export const START_NAME_LIMIT = 120;

/**
 * The levels a school in the country chooses from: Indonesia's own levels, or the
 * stages every other country shares, each kept as the level it stands for.
 */
export const levelsOf = (country: Country): readonly Level[] =>
  country === "ID"
    ? UnitLevel.literals
    : ["paud", "sd", "smp", "sma", "smk", "slb", "other"];

/** The draft after one more answer, as the server's save writes it. */
export const applyAnswer = (
  draft: StartDraft,
  answer: StartAnswer,
  updatedAt: number
): NonNullable<StartDraft> => ({
  ...draft,
  ...answerFields(answer),
  updatedAt,
});

/** The levels of the draft that its country offers, in the order it offers them. */
export const chosenLevels = (draft: StartDraft) =>
  draft?.country === undefined
    ? []
    : Arr.filter(levelsOf(draft.country), (level) =>
        Arr.contains(draft.levels ?? [], level)
      );

/** Whether the draft answers one question. */
const answers = (draft: StartDraft, item: StartItem) =>
  Match.value(item).pipe(
    Match.when("levels", () =>
      Arr.isReadonlyArrayNonEmpty(chosenLevels(draft))
    ),
    Match.when(
      "name",
      () => draft?.name !== undefined && draft.slug !== undefined
    ),
    Match.orElse((answered) => draft?.[answered] !== undefined)
  );

/** The first question the draft leaves open, where the questionnaire resumes; the last when it answers all. */
export const resumeItem = (draft: StartDraft): StartItem =>
  Option.getOrElse(
    Arr.findFirst(START_ITEMS, (item) => !answers(draft, item)),
    () => "size" as const
  );

/** Combining marks, which NFKD splits off a letter's accent. */
const ACCENTS = /\p{M}/gu;
/** Each run of anything a slug cannot hold, in a suggested address. */
const NON_SLUG_RUNS = /[^a-z0-9]+/g;
/** Hyphens at either end of a suggested address. */
const EDGE_HYPHENS = /^-+|-+$/g;
/** Hyphens at the end of an address cut to its limit. */
const TRAILING_HYPHENS = /-+$/;
/** Spaces and underscores in a typed address, which read as hyphens. */
const SPACES = /[\s_]+/g;
/** Anything else a typed address cannot hold. */
const NON_SLUG = /[^a-z0-9-]/g;

/** Text without its accents, in lower case. */
const plain = (text: string) =>
  text.normalize("NFKD").replace(ACCENTS, "").toLowerCase();

/**
 * A school address suggested from its name: the letters without their accents,
 * in lower case, each run of anything else one hyphen, at most 63 characters.
 */
export const suggestSlug = (name: string) =>
  plain(name)
    .replace(NON_SLUG_RUNS, "-")
    .replace(EDGE_HYPHENS, "")
    .slice(0, 63)
    .replace(TRAILING_HYPHENS, "");

/** What the founder types into the address: lower case without accents, a space as a hyphen, and nothing a slug cannot hold. */
export const typedSlug = (text: string) =>
  plain(text).replace(SPACES, "-").replace(NON_SLUG, "").slice(0, 63);

/**
 * The name of one unit: Indonesia writes the level first, as in "SMA Harapan
 * Bangsa"; every other country follows the founder's language, which `compose`
 * writes.
 */
export const unitName = (
  country: Country,
  level: string,
  name: string,
  compose: (level: string, name: string) => string
) => (country === "ID" ? `${level} ${name}` : compose(level, name));

/**
 * The opening's answers when the draft answers every question. A school with
 * one level gives its unit the school's own name; with more, each unit is named
 * by `name`.
 */
export const startRequest = (
  draft: StartDraft,
  timeZone: string,
  name: (level: Level, school: string) => string
): Option.Option<StartRequest> => {
  const levels = chosenLevels(draft);
  if (
    draft?.country === undefined ||
    draft.name === undefined ||
    draft.role === undefined ||
    draft.size === undefined ||
    draft.slug === undefined ||
    !Arr.isReadonlyArrayNonEmpty(levels)
  ) {
    return Option.none();
  }
  const school = draft.name;
  return Option.some({
    country: draft.country,
    name: school,
    role: draft.role,
    size: draft.size,
    slug: draft.slug,
    timeZone,
    units: Arr.map(levels, (level) => ({
      level,
      name: levels.length === 1 ? school : name(level, school),
    })),
  });
};
