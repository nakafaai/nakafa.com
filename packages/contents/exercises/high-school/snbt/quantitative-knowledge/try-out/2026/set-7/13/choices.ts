import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    {
      label:
        "Pernyataan $$(1)$$ SAJA cukup untuk menjawab pertanyaan, tetapi pernyataan $$(2)$$ SAJA tidak cukup.",
      value: false,
    },
    {
      label:
        "Pernyataan $$(2)$$ SAJA cukup untuk menjawab pertanyaan, tetapi pernyataan $$(1)$$ SAJA tidak cukup.",
      value: true,
    },
    {
      label:
        "DUA pernyataan BERSAMA-SAMA cukup untuk menjawab pertanyaan, tetapi SATU pernyataan SAJA tidak cukup.",
      value: false,
    },
    {
      label:
        "Pernyataan $$(1)$$ SAJA cukup untuk menjawab pertanyaan dan pernyataan $$(2)$$ SAJA cukup.",
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
        "Statement $$(1)$$ ALONE is sufficient, but statement $$(2)$$ ALONE is not sufficient.",
      value: false,
    },
    {
      label:
        "Statement $$(2)$$ ALONE is sufficient, but statement $$(1)$$ ALONE is not sufficient.",
      value: true,
    },
    {
      label:
        "BOTH statements TOGETHER are sufficient, but NEITHER statement ALONE is sufficient.",
      value: false,
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
