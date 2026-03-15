import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    { label: "Adanya tulang benulang di ruang rahasia", value: false },
    { label: "Penemuan alat bunuh diri", value: false },
    { label: "Penemuan gambar dari para budak", value: false },
    { label: 'Penemuan "penjara" di sebuah toko roti', value: true },
    { label: "Ditemukan ruangan sempit dan penuh alat penyiksa", value: false },
  ],
  en: [
    { label: "Adanya tulang benulang di ruang rahasia", value: false },
    { label: "Penemuan alat bunuh diri", value: false },
    { label: "Penemuan gambar dari para budak", value: false },
    { label: 'Penemuan "penjara" di sebuah toko roti', value: true },
    { label: "Ditemukan ruangan sempit dan penuh alat penyiksa", value: false },
  ],
};

export default choices;
