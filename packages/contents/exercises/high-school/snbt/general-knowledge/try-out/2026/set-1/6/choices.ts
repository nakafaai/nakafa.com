import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    {
      label:
        "DNA virus dari jenis cacar purba yang paling akhir tertanggal 603 SM.",
      value: false,
    },
    {
      label: "Jejak penyakit cacar sudah tidak terlihat lagi.",
      value: false,
    },
    {
      label:
        "Informasi genetika berusia 1.400 tahun memiliki peranan penting karena mengajarkan kita tentang sejarah evolusi virus variola yang menjadi penyebab cacar.",
      value: true,
    },
    {
      label:
        "Temuan tentang penemuan DNA virus dari jenis cacar purba memberi bukti bahwa asal-usul sudah muncul lebih dari 1.400 tahun lebih awal.",
      value: false,
    },
    {
      label: "Semua pernyataan di atas salah.",
      value: false,
    },
  ],
  en: [
    {
      label:
        "The most recent viral DNA from ancient smallpox dates back to 603 BCE.",
      value: false,
    },
    {
      label: "Traces of the smallpox disease are no longer visible.",
      value: false,
    },
    {
      label:
        "The 1,400-year-old genetic information plays an important role because it teaches us about the evolutionary history of the variola virus that causes smallpox.",
      value: true,
    },
    {
      label:
        "The discovery of viral DNA from ancient smallpox provides evidence that the origin emerged more than 1,400 years earlier.",
      value: false,
    },
    {
      label: "All of the statements above are false.",
      value: false,
    },
  ],
};

export default choices;
