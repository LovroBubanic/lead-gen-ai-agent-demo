import { normalizeCustomerLocale } from "@/lib/locales";

/** Short TTS lines for voice preview, keyed by visitor locale (ISO 639-1). */
const PREVIEW: Record<string, string> = {
  en: "Hello, this is a quick preview of how this voice will sound on your visitor calls.",
  es: "Hola, esta es una muestra breve de cómo sonará esta voz en las llamadas con visitantes.",
  de: "Hallo, das ist eine kurze Vorschau, wie diese Stimme bei Anrufen mit Besuchern klingt.",
  fr: "Bonjour, voici un court aperçu de cette voix pour vos appels visiteurs.",
  it: "Ciao, questa è un'anteprima veloce di come suonerà questa voce nelle chiamate con i visitatori.",
  pt: "Olá, esta é uma prévia rápida de como esta voz soará nas chamadas com visitantes.",
  nl: "Hallo, dit is een korte preview van hoe deze stem klinkt bij gesprekken met bezoekers.",
  pl: "Cześć, to krótka próbka brzmienia tego głosu w rozmowach z gośćmi.",
  sv: "Hej, det här är ett kort smakprov på hur den här rösten låter i samtal med besökare.",
  da: "Hej, dette er en kort forhåndsvisning af, hvordan denne stemme lyder i opkald til besøgende.",
  no: "Hei, dette er en kort forhåndsvisning av hvordan denne stemmen høres ut i samtaler med besøkende.",
  fi: "Hei, tämä on lyhyt esikatselu siitä, miltä tämä ääni kuulostaa vierailijapuheluissa.",
  ja: "こんにちは。訪問者との通話で、この音声がどのように聞こえるかの短いプレビューです。",
  ko: "안녕하세요. 방문자 통화에서 이 음성이 어떻게 들리는지 짧게 들려 드리는 미리 듣기입니다.",
  zh: "您好，这是访客通话中该语音效果的简短试听。",
};

export function voicePreviewPhrase(locale: string): string {
  const code = normalizeCustomerLocale(locale);
  return PREVIEW[code] ?? PREVIEW.en;
}
