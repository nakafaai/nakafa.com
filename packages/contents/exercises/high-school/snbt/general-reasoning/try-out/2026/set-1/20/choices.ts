import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    {
      label:
        "Pasti benar bahwa pakaian adat itu menggambarkan wilayah geografis atau periode waktu bersejarah",
      value: false,
    },
    {
      label:
        "Mungkin benar bahwa pakaian adat itu mencerminkan budaya geografis tertentu",
      value: true,
    },
    {
      label:
        "Pasti salah pakaian adat itu dimiliki oleh masyarakat yang merupakan warisan budaya bangsa",
      value: false,
    },
    {
      label:
        "Mungkin salah bahwa perkawinan di suatu daerah mengenakan pakaian adat untuk mengangkat status sosial",
      value: false,
    },
    {
      label:
        "Keberadaan pakaian adat di wilayah tertentu tidak menggambarkan budayanya",
      value: false,
    },
  ],
  en: [
    {
      label:
        "It is definitely true that traditional clothing depicts a geographic region or historical time period",
      value: false,
    },
    {
      label:
        "It is possibly true that traditional clothing reflects a specific geographic culture",
      value: true,
    },
    {
      label:
        "It is definitely false that traditional clothing is owned by a community that is a national cultural heritage",
      value: false,
    },
    {
      label:
        "It is possibly false that weddings in a region wear traditional clothing to elevate social status",
      value: false,
    },
    {
      label:
        "The existence of traditional clothing in a certain region does not depict its culture",
      value: false,
    },
  ],
};

export default choices;
