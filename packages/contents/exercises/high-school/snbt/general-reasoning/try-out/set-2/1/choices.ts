import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    {
      label:
        "Mahasiswa baru mencari perguruan tinggi swasta dengan fasilitas yang lengkap",
      value: false,
    },
    {
      label:
        "Kualitas dosen yang baik dapat meningkatkan banyaknya mahasiswa baru yang mendaftar",
      value: false,
    },
    {
      label:
        "Mahasiswa baru memilih perguruan tinggi swasta yang biayanya murah",
      value: false,
    },
    {
      label:
        "Perguruan tinggi yang baik memiliki dosen yang baik dan fasilitas yang memadai",
      value: false,
    },
    {
      label:
        "Mahasiswa baru akan tetap memilih perguruan tinggi swasta yang baik meskipun biayanya mahal",
      value: true,
    },
  ],
  en: [
    {
      label:
        "New students look for private universities with complete facilities",
      value: false,
    },
    {
      label:
        "Good lecturer quality can increase the number of new students enrolling",
      value: false,
    },
    {
      label: "New students choose private universities with low costs",
      value: false,
    },
    {
      label: "A good university has good lecturers and adequate facilities",
      value: false,
    },
    {
      label:
        "New students will still choose a good private university even if it is expensive",
      value: true,
    },
  ],
};

export default choices;
