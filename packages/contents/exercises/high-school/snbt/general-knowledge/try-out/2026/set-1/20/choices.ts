import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    {
      label: "perlunya peringatan dini bencana guna pengurangan risiko.",
      value: false,
    },
    {
      label: "investasi pembangunan sebagai elemen mitigasi bencana.",
      value: true,
    },
    {
      label: "perlunya pengawasan ketat terhadap kontraktor bangunan.",
      value: false,
    },
    {
      label: "banyaknya bangunan yang berada di daerah rawan bencana.",
      value: false,
    },
    {
      label: "investasi pembangunan dalam kerentanan kemanusiaan.",
      value: false,
    },
  ],
  en: [
    {
      label: "the need for disaster early warning for risk reduction.",
      value: false,
    },
    {
      label: "development investment as an element of disaster mitigation.",
      value: true,
    },
    {
      label: "the need for strict supervision of building contractors.",
      value: false,
    },
    {
      label: "the large number of buildings located in disaster-prone areas.",
      value: false,
    },
    {
      label: "development investment in humanitarian vulnerability.",
      value: false,
    },
  ],
};

export default choices;
