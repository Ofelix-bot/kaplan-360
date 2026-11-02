// Used by checklists.ts: when an award's wording limits who can receive it.

/**
 * Words that actually limit who can receive an award (a nationality, region or group). "International"
 * or "overseas" alone include Singapore students, so a quote without these doesn't count as a limit.
 */
export const LIMITS =
  /(refugee|asylum|sanctuary|care leaver|nationals?\b|citizens? of|passport|resident of|residents? in|countr(y|ies)|region|home students?|uk students?|domestic|\beu\b|european|africa|india|mexic|canad|german|chin(a|ese)|niger|pakistan|vietnam|indonesia|malaysia|thai|latin america|caribbean|middle east|arab|turk|kenya|ghana|egypt|brazil|chile|colombia|bangladesh|nepal|sri lanka|philippin|japan|korea|taiwan|hong kong|usa|united states|american)/i;
