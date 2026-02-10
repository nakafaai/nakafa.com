import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    { label: "Budi tidak rajin berlatih mengayuh sepeda.", value: true },
    { label: "Budi tidak menyukai balap sepeda.", value: false },
    { label: "Budi tidak bisa menang balap sepeda.", value: false },
    { label: "Budi tidak berlatih sepeda untuk ikut lomba.", value: false },
    {
      label: "Budi tidak dapat mengikuti lomba balap sepeda jarak jauh.",
      value: false,
    },
  ],
  en: [
    { label: "Budi does not diligently practice cycling.", value: true },
    { label: "Budi does not like bicycle racing.", value: false },
    { label: "Budi cannot win a bicycle race.", value: false },
    { label: "Budi does not practice cycling to join the race.", value: false },
    {
      label: "Budi cannot participate in a long-distance bicycle race.",
      value: false,
    },
  ],
};

export default choices;
