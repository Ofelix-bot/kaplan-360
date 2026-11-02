// Paths into /careers, without a locale: render them with components/i18n/Link (it adds /zh-hans or
// /zh-hant), and wrap them in exampleHref() (lib/example-link.ts) where the link opens the worked example.

/** The entry page: pick a degree, see its industries. */
export const careersHref = (): string => "/careers";

/** An industry page (sticky band and dropdown). `id` is an IndustryMeta id. */
export const industryHref = (id: string): string => `/careers/industries/${encodeURIComponent(id)}`;

/** A role page. `id` is a Role id. */
export const roleHref = (id: string): string => `/careers/roles/${encodeURIComponent(id)}`;
