import rawI18nConfig from "../../../i18n.config.json";

type RawI18nConfig = {
  globalEnabled?: boolean;
  activeLocale?: string;
  defaultLocale?: string;
  supportedLocales?: string[];
  localeLabels?: Record<string, string>;
  publishedLocales?: string[];
  switcherEnabled?: boolean;
  switcherLocales?: string[];
};

const FALLBACK_LOCALE = "en";
const raw = rawI18nConfig as RawI18nConfig;

function uniq(items: string[] = []): string[] {
  return Array.from(new Set(items.filter(Boolean)));
}

const supportedLocales = uniq(raw.supportedLocales);
const defaultLocale =
  raw.defaultLocale && supportedLocales.includes(raw.defaultLocale)
    ? raw.defaultLocale
    : supportedLocales[0] || FALLBACK_LOCALE;

const activeLocale =
  raw.activeLocale && supportedLocales.includes(raw.activeLocale)
    ? raw.activeLocale
    : defaultLocale;

const publishedLocalesRaw = uniq(raw.publishedLocales);
const publishedLocales = publishedLocalesRaw
  .filter((locale) => supportedLocales.includes(locale))
  .concat(defaultLocale)
  .filter((locale, index, arr) => arr.indexOf(locale) === index);

const switcherLocalesRaw = uniq(raw.switcherLocales);
const switcherLocales = switcherLocalesRaw.filter((locale) =>
  publishedLocales.includes(locale),
);

const localeLabels: Record<string, string> = Object.fromEntries(
  supportedLocales.map((locale) => [locale, raw.localeLabels?.[locale] || locale]),
);

const globalEnabled = raw.globalEnabled !== false;
const switcherEnabled = raw.switcherEnabled === true;

export const I18N_CONFIG = {
  globalEnabled,
  activeLocale,
  defaultLocale,
  supportedLocales,
  localeLabels,
  publishedLocales,
  switcherEnabled,
  switcherLocales,
} as const;

export type LocaleCode = (typeof I18N_CONFIG.supportedLocales)[number];

export const GLOBAL_ENABLED = I18N_CONFIG.globalEnabled;
export const ACTIVE_LOCALE = I18N_CONFIG.activeLocale;
export const DEFAULT_LOCALE = I18N_CONFIG.defaultLocale;
export const SUPPORTED_LOCALES = I18N_CONFIG.supportedLocales;
export const LOCALE_LABELS = I18N_CONFIG.localeLabels;
export const PUBLISHED_LOCALES = I18N_CONFIG.publishedLocales;
export const SWITCHER_ENABLED = I18N_CONFIG.switcherEnabled;
export const SWITCHER_LOCALES = I18N_CONFIG.switcherLocales;

export function resolveLocaleFromPath(pathname: string): string {
  const segment = pathname.split("/").filter(Boolean)[0];
  if (GLOBAL_ENABLED && segment && SUPPORTED_LOCALES.includes(segment)) {
    return segment;
  }
  return ACTIVE_LOCALE;
}

export function getLocaleLabel(locale: string): string {
  return LOCALE_LABELS[locale] || locale;
}

export function buildLocalizedPath(pathname: string, targetLocale: string): string {
  const normalizedPath = pathname.startsWith("/") ? pathname : `/${pathname}`;
  const hasTrailingSlash = normalizedPath.endsWith("/");
  const segments = normalizedPath.split("/").filter(Boolean);
  const firstSegment = segments[0];

  const pathWithoutLocale =
    GLOBAL_ENABLED && firstSegment && SUPPORTED_LOCALES.includes(firstSegment)
      ? segments.slice(1)
      : segments;

  const safeLocale = SUPPORTED_LOCALES.includes(targetLocale)
    ? targetLocale
    : DEFAULT_LOCALE;

  const localizedSegments =
    safeLocale === DEFAULT_LOCALE ? pathWithoutLocale : [safeLocale, ...pathWithoutLocale];

  if (localizedSegments.length === 0) return "/";

  const localizedPath = `/${localizedSegments.join("/")}`;
  return hasTrailingSlash ? `${localizedPath}/` : localizedPath;
}
