import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    { label: "Warga kehilangan motor", value: false },
    { label: "Warga resah dan gelisah", value: false },
    {
      label: "Hampir setiap minggu terjadi pencurian di Gang Mawar",
      value: false,
    },
    { label: "Petugas keamanan tidak berpatroli secara rutin", value: false },
    { label: "Petugas keamanan berpatroli secara rutin", value: true },
  ],
  en: [
    { label: "Residents lost their motorcycles", value: false },
    { label: "Residents are anxious and restless", value: false },
    { label: "Theft occurs almost every week in Gang Mawar", value: false },
    { label: "Security guards do not patrol regularly", value: false },
    { label: "Security guards patrol regularly", value: true },
  ],
};

export default choices;
