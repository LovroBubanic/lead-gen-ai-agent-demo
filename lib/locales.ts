/** ISO 639-1 codes supported for customer-facing UI and AI/voice. */
export const DEFAULT_CUSTOMER_LOCALE = "en" as const;

export type CustomerLocaleOption = {
  code: string;
  label: string;
};

export const CUSTOMER_LOCALE_OPTIONS: CustomerLocaleOption[] = [
  { code: "en", label: "English" },
  { code: "es", label: "Spanish" },
  { code: "de", label: "German" },
  { code: "fr", label: "French" },
  { code: "it", label: "Italian" },
  { code: "pt", label: "Portuguese" },
  { code: "nl", label: "Dutch" },
  { code: "pl", label: "Polish" },
  { code: "sv", label: "Swedish" },
  { code: "da", label: "Danish" },
  { code: "no", label: "Norwegian" },
  { code: "fi", label: "Finnish" },
  { code: "ja", label: "Japanese" },
  { code: "ko", label: "Korean" },
  { code: "zh", label: "Chinese" },
];

const ALLOWED = new Set(CUSTOMER_LOCALE_OPTIONS.map((o) => o.code));

export function isAllowedCustomerLocale(code: string): boolean {
  return ALLOWED.has(code);
}

export function normalizeCustomerLocale(code: string | null | undefined): string {
  const c = typeof code === "string" ? code.trim().toLowerCase() : "";
  return isAllowedCustomerLocale(c) ? c : DEFAULT_CUSTOMER_LOCALE;
}

export function localeLabel(code: string): string {
  const n = normalizeCustomerLocale(code);
  return CUSTOMER_LOCALE_OPTIONS.find((o) => o.code === n)?.label ?? n;
}
