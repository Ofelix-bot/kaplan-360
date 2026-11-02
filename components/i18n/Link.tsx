"use client";

import NextLink from "next/link";
import type { ComponentProps } from "react";
import { useLocalize } from "./I18nProvider";

/** next/link that keeps the current language: "/results" becomes "/zh-hans/results" on Chinese pages. */
export default function Link({ href, ...rest }: ComponentProps<typeof NextLink>) {
  const localize = useLocalize();
  const to = typeof href === "string" ? localize(href) : { ...href, pathname: href.pathname ? localize(href.pathname) : href.pathname };
  return <NextLink href={to} {...rest} />;
}
