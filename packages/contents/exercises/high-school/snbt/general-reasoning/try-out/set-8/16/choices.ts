import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    { label: "Simpulan tersebut pasti benar", value: false },
    { label: "Simpulan tersebut mungkin benar", value: false },
    { label: "Simpulan tersebut pasti salah", value: false },
    {
      label: "Simpulan tidak relevan dengan informasi yang diberikan",
      value: false,
    },
    {
      label: "Simpulan tidak dapat dinilai karena informasi tidak cukup",
      value: true,
    },
  ],
  en: [
    { label: "The conclusion is definitely true", value: false },
    { label: "The conclusion is possibly true", value: false },
    { label: "The conclusion is definitely false", value: false },
    {
      label: "The conclusion is irrelevant to the given information",
      value: false,
    },
    {
      label:
        "The conclusion cannot be assessed because the information is insufficient",
      value: true,
    },
  ],
};

export default choices;
