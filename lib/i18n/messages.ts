import type { Locale } from "./config";
import type { Messages } from "./translate";
import zhHans from "./messages/zh-hans.json";
import zhHant from "./messages/zh-hant.json";

// zh-hant.json is generated from zh-hans.json (scripts/i18n/hant.mjs), with hand-checked overrides.
export const MESSAGES: Record<Locale, Messages> = { en: {}, "zh-hans": zhHans, "zh-hant": zhHant };
