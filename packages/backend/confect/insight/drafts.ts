import { AppLocaleCodeSchema } from "@nakafa/aksara-contracts/locale";
import { SkillView } from "@repo/backend/confect/insight/schema";
import { Array as Arr, Schema } from "effect";

/** The credits one draft draws from the school's pool, as one reply of Nina does (ADR 0025). */
export const DRAFT_CREDITS = 5;

/** What one draft gives Nina: the numbers of one student, with no name, and the school's language. */
export const DraftSource = Schema.Struct({
  kktp: Schema.Finite,
  locale: AppLocaleCodeSchema,
  skills: Schema.Array(SkillView),
});

/** What Nina answers: the draft, or that the numbers do not carry one. */
export const DraftAnswer = Schema.Struct({
  text: Schema.String,
  unsure: Schema.Boolean,
});

/** Nina's rules for a narrative. The teacher decides what stands, and she decides nothing about the student (ADR 0035). */
export const DRAFT_INSTRUCTIONS = Arr.join(
  [
    "You are Nina, drafting a short narrative that a homeroom teacher will edit before guardians read it.",
    "Write at most 120 words, warm and plain, in the language you are told.",
    "Say only what the numbers show: where the student is strong, and where more practice helps.",
    "Never state a grade, a placement, a diagnosis, or a forecast, and never compare the student with others.",
    "Call the student 'your child' in the language you are told.",
    "Set unsure to true when the numbers are too few to say anything.",
  ],
  "\n"
);

/** The prompt of one draft: the school's language, the KKTP, and each competency's numbers. */
export const promptOf = (source: typeof DraftSource.Type) =>
  Arr.join(
    [
      `Language: ${source.locale}`,
      `KKTP: ${source.kktp}`,
      `Competencies:\n${Arr.join(
        Arr.map(
          source.skills,
          (skill) =>
            `${skill.competency}: ${Math.round(skill.rating * 100)} of 100, from ${skill.observations} answers`
        ),
        "\n"
      )}`,
    ],
    "\n\n"
  );
