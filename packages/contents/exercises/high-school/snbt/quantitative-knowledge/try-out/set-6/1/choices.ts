import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    {
      label:
        "Pernyataan $$(1)$$ saja cukup untuk menjawab pertanyaan tetapi pernyataan $$(2)$$ saja tidak cukup.",
      value: false,
    },
    {
      label:
        "Pernyataan $$(2)$$ saja cukup untuk menjawab pertanyaan tetapi pernyataan $$(1)$$ saja tidak cukup.",
      value: false,
    },
    {
      label:
        "Dua pernyataan bersama-sama cukup untuk menjawab pertanyaan, tetapi satu pernyataan saja tidak cukup.",
      value: true,
    },
    {
      label:
        "Pernyataan $$(1)$$ saja cukup untuk menjawab pertanyaan dan pernyataan $$(2)$$ saja cukup.",
      value: false,
    },
    {
      label:
        "Pernyataan $$(1)$$ dan pernyataan $$(2)$$ tidak cukup untuk menjawab pertanyaan.",
      value: false,
    },
  ],
  en: [
    {
      label:
        "Statement $$(1)$$ ALONE is sufficient, but statement $$(2)$$ alone is not sufficient.",
      value: false,
    },
    {
      label:
        "Statement $$(2)$$ ALONE is sufficient, but statement $$(1)$$ alone is not sufficient.",
      value: false,
    },
    {
      label:
        "BOTH statements TOGETHER are sufficient, but NEITHER statement ALONE is sufficient.",
      value: true,
    },
    {
      label: "EACH statement ALONE is sufficient.",
      value: false,
    },
    {
      label: "Statements $$(1)$$ and $$(2)$$ TOGETHER are NOT sufficient.",
      value: false,
    },
  ],
};

export default choices;
