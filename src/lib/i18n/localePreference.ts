import {
  DEFAULT_LOCALE,
  PUBLISHED_LOCALES,
} from "@/lib/i18n/config";

const COOKIE_NAME = "Sensei_locale";
const COOKIE_MAX_AGE = 31_536_000;
const publishedLocales = new Set(PUBLISHED_LOCALES);

const isPublishedLocale = (value: string): boolean =>
  publishedLocales.has(value);

export function readLocalePreference(): string | null {
  try {
    const entry = document.cookie
      .split(";")
      .map((part) => part.trim())
      .find((part) => part.startsWith(`${COOKIE_NAME}=`));
    if (!entry) return null;

    const value = decodeURIComponent(entry.slice(COOKIE_NAME.length + 1));
    return isPublishedLocale(value) ? value : null;
  } catch {
    return null;
  }
}

export function writeLocalePreference(locale: string): boolean {
  if (!isPublishedLocale(locale)) return false;

  try {
    const secure = window.location.protocol === "https:" ? "; Secure" : "";
    document.cookie = `${COOKIE_NAME}=${encodeURIComponent(locale)}; Path=/; Max-Age=${COOKIE_MAX_AGE}; SameSite=Lax${secure}`;
    return true;
  } catch {
    return false;
  }
}

export function rememberExplicitLocaleFromPath(pathname: string): boolean {
  const segment = pathname.split("/").filter(Boolean)[0];
  if (!segment || segment === DEFAULT_LOCALE || !isPublishedLocale(segment)) {
    return false;
  }
  return writeLocalePreference(segment);
}
