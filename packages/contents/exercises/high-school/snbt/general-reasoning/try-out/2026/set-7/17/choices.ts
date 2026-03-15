import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    { label: "Tubuh bagian depan tidak terasa sakit.", value: true },
    { label: "Tubuh bagian depan akan terasa sakit.", value: false },
    { label: "Berpotensi untuk terkena asam lambung.", value: false },
    { label: "Leher akan terhindar dari rasa sakit.", value: false },
    { label: "Dengkuran akan semakin berkurang.", value: false },
  ],
  en: [
    { label: "The front part of the body will not feel pain.", value: true },
    { label: "The front part of the body will feel pain.", value: false },
    { label: "Potential to get acid reflux.", value: false },
    { label: "The neck will be free from pain.", value: false },
    { label: "Snoring will decrease.", value: false },
  ],
};

export default choices;
