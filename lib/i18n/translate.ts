import { createElement, Fragment, type ReactNode } from "react";

// Messages are keyed by their English text, so English needs no dictionary and a missing
// translation falls back to English. Placeholders are {name}; rich messages wrap parts in
// <tag>…</tag>, each tag rendered by a function the caller passes ("Go to <a>Plan my path</a>").

export type Messages = Record<string, string>;
export type Vars = Record<string, string | number>;
type RichVars = Record<string, ReactNode>;
type Tags = Record<string, (chunk: ReactNode) => ReactNode>;

const fill = (s: string, vars?: Vars) => (vars ? s.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m)) : s);

/** Splits text into strings and placeholder nodes. */
function placeholders(s: string, vars: RichVars | undefined): ReactNode[] {
  if (!vars) return [s];
  return s.split(/(\{\w+\})/).map((part) => {
    const m = /^\{(\w+)\}$/.exec(part);
    return m && m[1] in vars ? vars[m[1]] : part;
  });
}

function rich(s: string, tags: Tags, vars?: RichVars): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /<(\w+)>([\s\S]*?)<\/\1>/g;
  let last = 0;
  for (let m = re.exec(s); m; m = re.exec(s)) {
    out.push(...placeholders(s.slice(last, m.index), vars));
    const render = tags[m[1]];
    const inner = createElement(Fragment, null, ...placeholders(m[2], vars));
    out.push(render ? render(inner) : inner);
    last = re.lastIndex;
  }
  out.push(...placeholders(s.slice(last), vars));
  return out;
}

export type T = {
  (key: string, vars?: Vars): string;
  /** A message with markup: tags are rendered by `tags`, placeholders may be elements. */
  rich: (key: string, tags: Tags, vars?: RichVars) => ReactNode;
  /** Whether a translation exists (English always "has" one). */
  has: (key: string) => boolean;
};

export function makeT(messages: Messages): T {
  const t = ((key: string, vars?: Vars) => fill(messages[key] ?? key, vars)) as T;
  t.rich = (key, tags, vars) => createElement(Fragment, null, ...rich(messages[key] ?? key, tags, vars));
  t.has = (key) => key in messages;
  return t;
}

/** Marks an English message translated later with t(), so scripts/i18n/extract.mjs finds it. */
export const msg = (s: string) => s;

/** A translated aside after other text: " (…)" in English, "（…）" with no space in Chinese. */
export const aside = (s: string) => (s.startsWith("（") ? s : ` ${s}`);
