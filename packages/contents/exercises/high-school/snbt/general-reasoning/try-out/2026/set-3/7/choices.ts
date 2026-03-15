import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    {
      label:
        "Sulitnya mengembalikan kerugian negara karena berkurangnya ketentuan minimum denda bagi koruptor.",
      value: false,
    },
    {
      label:
        "Efek jera bagi koruptor semakin berkurang dan sulit mengembalikan kerugian negara.",
      value: false,
    },
    {
      label:
        "Beberapa pasal RKUHP lebih ringan dibandingkan UU Tipikor dan korupsi di Indonesia berkurang.",
      value: true,
    },
    {
      label: "Sejumlah pasal-pasal RKUHP lebih ringan dibandingkan UU Tipikor.",
      value: false,
    },
    {
      label:
        "Semua pasal RKUHP lebih berat dibandingkan UU Tipikor atau korupsi di Indonesia semakin marak.",
      value: false,
    },
  ],
  en: [
    {
      label:
        "It is difficult to recover state losses due to the reduction in minimum fine provisions for corruptors.",
      value: false,
    },
    {
      label:
        "The deterrent effect for corruptors is decreasing and it is difficult to recover state losses.",
      value: false,
    },
    {
      label:
        "Some articles of the RKUHP are lighter than the Corruption Law and corruption in Indonesia is decreasing.",
      value: true,
    },
    {
      label: "A number of RKUHP articles are lighter than the Corruption Law.",
      value: false,
    },
    {
      label:
        "All RKUHP articles are heavier than the Corruption Law or corruption in Indonesia is becoming more rampant.",
      value: false,
    },
  ],
};

export default choices;
