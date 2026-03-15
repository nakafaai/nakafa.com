import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    { label: "Baju pada tahun 2011—2012", value: false },
    { label: "Jas pada tahun 2014—2015", value: true },
    { label: "Baju pada tahun 2012—2013", value: false },
    { label: "Jas pada tahun 2012—2013", value: false },
    { label: "Celana pada tahun 2013—2014", value: false },
  ],
  en: [
    { label: "Shirts in 2011—2012", value: false },
    { label: "Suits in 2014—2015", value: true },
    { label: "Shirts in 2012—2013", value: false },
    { label: "Suits in 2012—2013", value: false },
    { label: "Pants in 2013—2014", value: false },
  ],
};

export default choices;
