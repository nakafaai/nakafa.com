import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    {
      label:
        "Pekerja milenial banyak memiliki ide menarik untuk tempat kerjanya",
      value: false,
    },
    {
      label: "Pekerja milenial memiliki etos kerja yang tinggi",
      value: false,
    },
    {
      label:
        "Sedikit perusahaan yang mengeluhkan kinerja dan kontribusi pekerja milenial",
      value: false,
    },
    {
      label:
        "Banyak perusahaan mengeluhkan kinerja dan kontribusi pekerja milenial",
      value: true,
    },
    {
      label:
        "Banyak pekerja milenial yang bekerja di sebuah perusahaan dalam jangka waktu lama",
      value: false,
    },
  ],
  en: [
    {
      label:
        "Millennial workers have many interesting ideas for their workplace",
      value: false,
    },
    {
      label: "Millennial workers have a high work ethic",
      value: false,
    },
    {
      label:
        "Few companies complain about the performance and contribution of millennial workers",
      value: false,
    },
    {
      label:
        "Many companies complain about the performance and contribution of millennial workers",
      value: true,
    },
    {
      label: "Many millennial workers work at a company for a long period",
      value: false,
    },
  ],
};

export default choices;
