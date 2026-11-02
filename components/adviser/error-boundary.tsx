"use client";

import { Component, type ReactNode } from "react";
import { useT } from "@/components/i18n/I18nProvider";
import { Button } from "@/components/ui/button";

// Keeps a rendering error inside the AI adviser's area: the rest of the page stays, with a way to start again.

function Fallback({ onReset }: { onReset: () => void }) {
  const t = useT();
  return (
    <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm" role="alert">
      <p className="mb-2 font-medium text-destructive">{t("Something went wrong. Try again in a moment.")}</p>
      <Button size="sm" variant="outline" onClick={onReset}>
        {t("Start again")}
      </Button>
    </div>
  );
}

export class AdviserErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean; key: number }> {
  state = { failed: false, key: 0 };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    console.warn("AI adviser:", error);
  }

  render() {
    if (this.state.failed) return <Fallback onReset={() => this.setState((s) => ({ failed: false, key: s.key + 1 }))} />;
    return <div key={this.state.key}>{this.props.children}</div>;
  }
}
