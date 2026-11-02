"use client";

import { useId, useRef, useState } from "react";
import { FileTextIcon, ImageIcon, LockIcon, PaperclipIcon, XIcon } from "lucide-react";
import { cn } from "cn";
import { useT } from "@/components/i18n/I18nProvider";
import { VoiceInput } from "@/components/finder/voice-input";
import { InfoTip } from "@/components/landing/move/InfoTip";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Spinner } from "@/components/workspace/spinner";
import { msg } from "@/lib/i18n/translate";
import { prepareFile, type PreparedFile } from "@/lib/profile-files";
import { MAX_FILES, MAX_PDF_PAGES, MAX_SENTENCE, type ProfileReading } from "@/lib/profile-reading";

// The box that reads a student's own words into their answers (app/api/profile): a sentence typed or spoken
// (voice-input.tsx, the browser's speech recognition), and screenshots or PDFs (Kaplan360, school emails;
// attached, pasted or dropped, lib/profile-files.ts). Only what is in the box is sent, and it isn't kept. Used by
// the Programme finder's "One sentence" (components/finder/sentence-fill.tsx) and /profile's autofill card, which
// each apply the reading their own way (`onRead`).

/** Where a reading came from: files, a spoken sentence, or a typed one. */
export type ReadSource = "file" | "voice" | null;

const ERRORS: Record<string, string> = {
  unavailable: msg("This shortcut isn’t available right now. Use Quick choice."),
  busy: msg("Too many tries in a row. Wait a minute, or use Quick choice."),
  "too-long": msg("Keep it to {n} characters."),
  failed: msg("That didn’t work. Try again, or use Quick choice."),
  "too-many-files": msg("Send at most {max} files."),
  "bad-file": msg("Send a screenshot (PNG, JPG, WebP, HEIC) or a PDF."),
  "too-big": msg("That file is too large: a PDF up to 2 MB."),
  "too-many-pages": msg("That PDF is longer than {pages} pages; send the pages that matter as screenshots."),
  encrypted: msg("That PDF has a password. Remove it, or send a screenshot instead."),
  heic: msg("This browser can’t open HEIC photos. Send a screenshot or a JPG."),
};

export function AutofillInput({
  title,
  hint,
  placeholder,
  button,
  errors,
  onRead,
  className,
}: {
  title: string;
  hint: string;
  placeholder: string;
  button: string;
  /** Messages in place of the defaults (which point to the finder's Quick choice). */
  errors?: Partial<Record<string, string>>;
  onRead: (reading: ProfileReading, text: string, source: ReadSource) => void;
  className?: string;
}) {
  const t = useT();
  const id = useId();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [files, setFiles] = useState<PreparedFile[]>([]);
  const [spoke, setSpoke] = useState(false);
  const [dragging, setDragging] = useState(false);
  const picker = useRef<HTMLInputElement>(null);

  const fail = (code: string) =>
    setError(
      t(errors?.[code] ?? ERRORS[code] ?? errors?.failed ?? ERRORS.failed, {
        n: MAX_SENTENCE,
        max: MAX_FILES,
        pages: MAX_PDF_PAGES,
      }),
    );

  const attach = async (list: FileList | File[]) => {
    const picked = Array.from(list);
    if (!picked.length) return;
    setError("");
    if (files.length + picked.length > MAX_FILES) return fail("too-many-files");
    try {
      const ready = await Promise.all(picked.map(prepareFile));
      setFiles((f) => [...f, ...ready].slice(0, MAX_FILES));
    } catch (e) {
      fail((e as Error).message);
    }
  };

  const read = async () => {
    if ((!text.trim() && !files.length) || busy) return;
    setBusy(true);
    setError("");
    try {
      let init: RequestInit;
      if (files.length) {
        const form = new FormData();
        form.set("text", text.trim());
        for (const f of files) form.append("file", f.file);
        init = { method: "POST", body: form };
      } else
        init = {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: text.trim() }),
        };
      const r = await fetch("/api/profile", init);
      const body = (await r.json().catch(() => ({}))) as Partial<ProfileReading> & { error?: string };
      if (!r.ok || !body.patch) throw new Error(body.error ?? "failed");
      onRead(body as ProfileReading, text, files.length ? "file" : spoke ? "voice" : null);
      // Read once: the files go, so a second press doesn't send them again.
      setFiles([]);
    } catch (e) {
      fail((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className={cn("flex flex-col gap-4 rounded-2xl border border-border bg-card p-6 transition-colors", dragging && "border-primary bg-primary/5", className)}
      onDragOver={(e) => {
        if (!e.dataTransfer.types.includes("Files")) return;
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragging(false);
      }}
      onDrop={(e) => {
        if (!e.dataTransfer.files.length) return;
        e.preventDefault();
        setDragging(false);
        void attach(e.dataTransfer.files);
      }}
    >
      <div className="flex flex-col gap-1.5">
        <label htmlFor={id} className="text-[17px] font-bold">
          {title}
        </label>
        <p id={`${id}-hint`} className="text-sm text-muted-foreground">
          {hint}
        </p>
      </div>
      <Textarea
        id={id}
        rows={4}
        maxLength={MAX_SENTENCE}
        value={text}
        aria-describedby={`${id}-hint`}
        placeholder={placeholder}
        onChange={(e) => setText(e.target.value)}
        onPaste={(e) => {
          if (!e.clipboardData.files.length) return;
          e.preventDefault();
          void attach(e.clipboardData.files);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            void read();
          }
        }}
        className="min-h-32 rounded-xl bg-card px-4 py-3 text-[15px] md:text-[15px]"
      />
      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={picker}
          type="file"
          multiple
          hidden
          accept="image/png,image/jpeg,image/webp,image/heic,image/heif,.heic,.heif,application/pdf"
          onChange={(e) => {
            if (e.target.files) void attach(e.target.files);
            e.target.value = "";
          }}
        />
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label={t("Add a screenshot or PDF")}
                disabled={files.length >= MAX_FILES}
                onClick={() => picker.current?.click()}
                className="size-10 rounded-xl"
              />
            }
          >
            <PaperclipIcon aria-hidden />
          </TooltipTrigger>
          <TooltipContent>{t("Add a screenshot or PDF")}</TooltipContent>
        </Tooltip>
        <VoiceInput value={text} onChange={setText} maxLength={MAX_SENTENCE} onUsed={() => setSpoke(true)} />
        <InfoTip
          label={t("About files")}
          text={t("Kaplan360 screenshots or your school’s course emails, up to {max} files; a PDF up to 2 MB and {pages} pages. Crop out your student ID and name first if you like.", {
            max: MAX_FILES,
            pages: MAX_PDF_PAGES,
          })}
        />
        {files.map((f, i) => (
          <span key={`${f.name}-${i}`} className="flex h-10 max-w-56 items-center gap-1.5 rounded-xl border border-border bg-muted/50 pr-1 pl-3 text-sm">
            {f.kind === "pdf" ? <FileTextIcon aria-hidden className="size-4 shrink-0" /> : <ImageIcon aria-hidden className="size-4 shrink-0" />}
            <span className="truncate">{f.name}</span>
            <Button type="button" variant="ghost" size="icon-sm" aria-label={t("Remove {name}", { name: f.name })} onClick={() => setFiles((x) => x.filter((_, j) => j !== i))}>
              <XIcon aria-hidden />
            </Button>
          </span>
        ))}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <LockIcon aria-hidden className="size-3.5 shrink-0" />
          {files.length
            ? t("Only this sentence and these files are sent, and they aren’t kept; your other answers stay in this browser.")
            : t("Only this sentence is sent, and it isn’t kept; your other answers stay in this browser.")}
        </p>
        <Button onClick={() => void read()} disabled={(!text.trim() && !files.length) || busy} aria-busy={busy} className="h-12 rounded-xl px-5 text-[15px] font-bold">
          {busy && <Spinner className="size-4" />}
          {busy ? t("Reading…") : button}
        </Button>
      </div>
      <div role="status" aria-live="polite">
        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>
    </div>
  );
}
