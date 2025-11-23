import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    {
      label: "$$(1), (2), \\text{ dan } (3)$$ SAJA yang benar",
      value: true,
    },
    {
      label: "$$(1) \\text{ dan } (3)$$ SAJA yang benar",
      value: false,
    },
    {
      label: "$$(2) \\text{ dan } (4)$$ SAJA yang benar",
      value: false,
    },
    {
      label: "SEMUA pernyataan benar",
      value: false,
    },
    {
      label: "SEMUA pernyataan salah",
      value: false,
    },
  ],
  en: [
    {
      label: "$$(1), (2), \\text{ and } (3)$$ ONLY are true",
      value: true,
    },
    {
      label: "$$(1) \\text{ and } (3)$$ ONLY are true",
      value: false,
    },
    {
      label: "$$(2) \\text{ and } (4)$$ ONLY are true",
      value: false,
    },
    {
      label: "ALL statements are true",
      value: false,
    },
    {
      label: "ALL statements are false",
      value: false,
    },
  ],
};

export default choices;
