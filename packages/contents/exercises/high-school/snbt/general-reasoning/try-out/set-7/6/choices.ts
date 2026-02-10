import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    {
      label: "Lebih tahan lama dan lebih mahal daripada lampu di teras rumah.",
      value: false,
    },
    {
      label:
        "Tidak lebih tahan lama dan lebih mahal daripada lampu di teras rumah.",
      value: false,
    },
    {
      label:
        "Tidak lebih tahan lama dan tidak lebih mahal daripada lampu di teras rumah.",
      value: true,
    },
    {
      label:
        "Lebih tahan lama dan tidak lebih mahal daripada lampu di teras rumah.",
      value: false,
    },
    {
      label: "Sama tahan lama dan sama mahalnya dengan di teras rumah.",
      value: false,
    },
  ],
  en: [
    {
      label: "More durable and more expensive than the terrace light.",
      value: false,
    },
    {
      label: "Not more durable and more expensive than the terrace light.",
      value: false,
    },
    {
      label: "Not more durable and not more expensive than the terrace light.",
      value: true,
    },
    {
      label: "More durable and not more expensive than the terrace light.",
      value: false,
    },
    {
      label: "Equally durable and equally expensive as the terrace light.",
      value: false,
    },
  ],
};

export default choices;
