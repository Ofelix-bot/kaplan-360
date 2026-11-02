"use client";

import { ChevronLeftIcon, EllipsisIcon, PlusIcon, ReplyIcon, SearchIcon, VideoIcon } from "lucide-react";
import { cn } from "cn";
import { useT } from "@/components/i18n/I18nProvider";
import type { Chat, FeedNote } from "@/content/landing.en";

// The chat cards (/move's The problem and What they go on), each drawn in the look of where it would
// reach you: a WeChat-like chat from Mum, a LinkedIn-like message from a recruiter, an ad panel in a
// train carriage, a WhatsApp-like chat from the agent, and a social feed of notes in the look of a
// Xiaohongshu-style waterfall. Look only: no logos, no app, school or brand names, no photos and no
// like counts. Each keeps its app's own dark appearance. The last is this
// site's own notification, in the brand colour: the only one that doesn't ask. On phones the cards are
// compact; from 640px they show more of their app. The app's small print is hidden from screen readers,
// so each card reads as "sender: message"; the feed reads as its label, then its notes' titles.

export function ChatCard({ chat }: { chat: Chat }) {
  switch (chat.app) {
    case "wechat":
      return <WeChat chat={chat} />;
    case "linkedin":
      return <LinkedIn chat={chat} />;
    case "whatsapp":
      return <WhatsApp chat={chat} />;
    case "xhs":
      return <Feed chat={chat} />;
    case "mrt":
      return <MrtAd chat={chat} />;
    case "kaplan":
      return <Kaplan chat={chat} />;
  }
}

function Card({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn("w-full overflow-hidden rounded-2xl text-left shadow-[0_1px_2px_rgb(22_19_43/0.08),0_12px_28px_-16px_rgb(22_19_43/0.35)] ring-1 ring-black/5 dark:ring-white/10", className)}>{children}</div>;
}

const initials = (name: string) =>
  name
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

function WeChat({ chat }: { chat: Extract<Chat, { app: "wechat" }> }) {
  const t = useT();
  const sender = t(chat.sender);
  return (
    <Card className="bg-[#EDEDED] text-[#191919] dark:bg-[#111111] dark:text-[#E5E5E5]">
      <div className="grid grid-cols-[1fr_auto_1fr] items-center px-3 pt-1.5 pb-0.5 sm:pt-2 sm:pb-1">
        <ChevronLeftIcon aria-hidden className="size-4 opacity-70" />
        <p className="text-[13px] font-semibold">{sender}</p>
        <EllipsisIcon aria-hidden className="size-4 justify-self-end opacity-70" />
      </div>
      <div className="flex items-start gap-2 px-3 pt-1 pb-2.5 sm:pb-3">
        <span aria-hidden className="grid size-8 shrink-0 place-items-center rounded-[6px] bg-[#F3D3B5] text-[13px] font-semibold text-[#6B3410]">
          {sender[0]}
        </span>
        <div className="flex min-w-0 flex-col gap-1.5">
          <p aria-hidden className="hidden w-fit items-center gap-1.5 rounded-[6px] bg-white px-2.5 py-1.5 text-[12px] sm:inline-flex dark:bg-[#2C2C2C]">
            <VideoIcon className="size-3.5" />
            {t(chat.call)} {chat.duration}
          </p>
          <p className="text-pretty relative w-fit rounded-[6px] bg-white px-2.5 py-1.5 text-[13px] leading-[18px] sm:text-[14px] sm:leading-[19px] dark:bg-[#2C2C2C]">
            {/* The bubble's tail, pointing at the avatar. */}
            <span aria-hidden className="absolute top-3 -left-1 size-2 rotate-45 bg-inherit" />
            <span className="relative">{t(chat.message)}</span>
          </p>
        </div>
      </div>
    </Card>
  );
}

function LinkedIn({ chat }: { chat: Extract<Chat, { app: "linkedin" }> }) {
  const t = useT();
  return (
    <Card className="bg-white text-[#191919] dark:bg-[#1B1F23] dark:text-[#E6E6E6]">
      <div className="flex gap-2.5 px-3 pt-2 pb-2.5 sm:pt-2.5 sm:pb-3">
        <span aria-hidden className="grid size-9 shrink-0 place-items-center rounded-full bg-[#DCE6F1] text-[13px] font-semibold text-[#004182] dark:bg-[#2A3B4D] dark:text-[#9BCBFB]">
          {initials(chat.sender)}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <p className="truncate text-[13px] leading-[18px]">
              <span className="font-semibold">{chat.sender}</span>
              {/* On phones the headline shares the name's line. */}
              <span className="text-[#666666] sm:hidden dark:text-[#A8A8A8]"> · {t(chat.headline)}</span>
              <span aria-hidden className="hidden text-[#666666] sm:inline dark:text-[#A8A8A8]">
                {" "}
                · {t(chat.degree)}
              </span>
            </p>
            <span aria-hidden className="hidden shrink-0 text-[11px] text-[#666666] sm:inline dark:text-[#A8A8A8]">
              {chat.time}
            </span>
          </div>
          <p className="hidden text-[12px] leading-4 text-[#666666] sm:block dark:text-[#A8A8A8]">{t(chat.headline)}</p>
          <p className="text-pretty mt-0.5 text-[13px] sm:mt-1 leading-[18px] sm:text-[14px] sm:leading-[19px]">{t(chat.message)}</p>
          <p aria-hidden className="mt-2 hidden items-center gap-1 text-[12px] font-semibold text-[#0A66C2] sm:flex dark:text-[#70B5F9]">
            <ReplyIcon className="size-3.5" />
            {t("Reply")}
          </p>
        </div>
      </div>
    </Card>
  );
}

function WhatsApp({ chat }: { chat: Extract<Chat, { app: "whatsapp" }> }) {
  const t = useT();
  const sender = t(chat.sender);
  return (
    <Card className="bg-[#EFEAE2] dark:bg-[#0B141A]">
      <div className="flex items-center gap-2 bg-[#008069] px-3 py-1 text-white sm:py-1.5 dark:bg-[#202C33] dark:text-[#E9EDEF]">
        <ChevronLeftIcon aria-hidden className="size-4" />
        <span aria-hidden className="grid size-6 shrink-0 place-items-center rounded-full bg-[#DFF3EE] text-[11px] font-semibold text-[#005C4B]">
          {sender[0]}
        </span>
        <p className="text-[13px] leading-tight font-semibold">{sender}</p>
        <span aria-hidden className="text-[11px] text-white dark:text-[#AEBAC1]">
          {t(chat.status)}
        </span>
      </div>
      <div className="px-3 py-2 sm:py-2.5">
        <p className="text-pretty relative w-fit max-w-[92%] rounded-[8px] rounded-tl-none bg-white px-2.5 pt-1.5 pb-1 text-[13px] leading-[18px] text-[#111B21] shadow-[0_1px_0.5px_rgb(11_20_26/0.13)] sm:text-[14px] sm:leading-[19px] dark:bg-[#202C33] dark:text-[#E9EDEF]">
          <span aria-hidden className="absolute top-0 -left-1.5 size-0 border-t-[8px] border-l-[8px] border-t-white border-l-transparent dark:border-t-[#202C33]" />
          {t(chat.message)}
          <span aria-hidden className="float-right mt-1 ml-2 text-[11px] leading-4 text-[#5B6B75] dark:text-[#AEBAC1]">
            {chat.time}
          </span>
        </p>
      </div>
    </Card>
  );
}

function Kaplan({ chat }: { chat: Extract<Chat, { app: "kaplan" }> }) {
  const t = useT();
  return (
    <Card className="bg-(--brand) text-(--on-brand) ring-white/15">
      <div className="flex items-start gap-2.5 px-3 pt-2 pb-2.5 sm:pt-2.5 sm:pb-3">
        <span aria-hidden className="grid size-8 shrink-0 place-items-center rounded-[9px] bg-white text-[13px] font-bold text-[#240f6e]">
          K
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <p className="truncate text-[13px] leading-[18px] font-semibold" translate="no">
              {chat.sender}
            </p>
            <span aria-hidden className="shrink-0 text-[11px] text-(--on-brand-muted)">
              {t(chat.time)}
            </span>
          </div>
          <p className="text-pretty text-[13px] leading-[18px] font-semibold sm:text-[14px] sm:leading-[19px]">{t(chat.message)}</p>
        </div>
      </div>
    </Card>
  );
}

/** The ad's code block: a fixed 5×5 pattern of filled cells (drawn, not a real code). */
const CODE = [1, 1, 0, 1, 1, 1, 0, 1, 0, 1, 0, 1, 1, 0, 0, 1, 0, 0, 1, 1, 1, 1, 0, 1, 1];

/** An ad panel in a train carriage: grab handles above it, a stripe, the ad's line and a drawn code. No school or brand. */
function MrtAd({ chat }: { chat: Extract<Chat, { app: "mrt" }> }) {
  const t = useT();
  return (
    <Card className="bg-[#E6E9ED] text-[#1B1F24] dark:bg-[#1A1D21] dark:text-[#EEF0F2]">
      <div role="group" aria-label={t(chat.label)}>
        {/* The carriage: a rail with four grab handles, then the panel's frame. */}
        <div aria-hidden className="relative h-6">
          <span className="absolute inset-x-3 top-1.5 h-[3px] rounded-full bg-[#A7AFB8] dark:bg-[#4A525B]" />
          <span className="absolute inset-x-6 top-2.5 flex justify-between">
            {[0, 1, 2, 3].map((i) => (
              <span key={i} className="block size-3 rounded-full border-2 border-solid border-[#A7AFB8] dark:border-[#4A525B]" />
            ))}
          </span>
        </div>
        <div className="mx-3 mb-3 overflow-hidden rounded-[10px] border-[3px] border-solid border-[#C9CED4] dark:border-[#3A4048]">
          <span aria-hidden className="block h-1.5 bg-[#E4002B]" />
          <div className="flex items-center gap-3 bg-[#FFD84D] px-3 py-3 text-[#141414]">
            <p className="m-0 flex-1 font-heading text-[20px] [font-stretch:var(--display-stretch)] leading-[1.1] font-extrabold text-balance">{t(chat.ad)}</p>
            <span aria-hidden className="grid size-12 shrink-0 grid-cols-5 gap-px rounded-[4px] bg-white p-1">
              {CODE.map((on, i) => (
                <span key={i} className={on ? "bg-[#141414]" : undefined} />
              ))}
            </span>
          </div>
        </div>
      </div>
    </Card>
  );
}

/**
 * Each note's cover (a coloured block, no photo), its height in px, and the poster's avatar dot: a
 * two-column waterfall, notes 1, 3, 5 on the left and 2, 4 on the right, as the feed lays them out.
 */
const NOTE_LOOK: { cover: string; h: number; dot: string }[] = [
  { cover: "bg-[#FFD9DE] dark:bg-[#4A2A30]", h: 40, dot: "bg-[#F7A1AC]" },
  { cover: "bg-[#DCEBFF] dark:bg-[#24344A]", h: 30, dot: "bg-[#9CC2F2]" },
  { cover: "bg-[#FFEBC2] dark:bg-[#4A3D22]", h: 24, dot: "bg-[#F2C46B]" },
  { cover: "bg-[#E2F4E4] dark:bg-[#26402B]", h: 38, dot: "bg-[#97D3A0]" },
  { cover: "bg-[#EDE3FF] dark:bg-[#352B4D]", h: 26, dot: "bg-[#BDA6F0]" },
];

/** The feed's red, for its tab marker, its plus button and the comment's mark. */
const RED = "bg-[#FF2442]";

function Note({ note, index }: { note: FeedNote; index: number }) {
  const look = NOTE_LOOK[index % NOTE_LOOK.length];
  return (
    <li className="flex flex-col overflow-hidden rounded-[6px] bg-white shadow-[0_1px_2px_rgb(0_0_0/0.06)] dark:bg-[#1C1C1E]">
      <span aria-hidden className={cn("block w-full", look.cover)} style={{ height: look.h }} />
      <div className="flex flex-col gap-1 px-1.5 pt-1 pb-1.5">
        <p lang="zh" className="line-clamp-2 text-[11px] leading-[14px] font-medium text-[#333333] dark:text-[#E5E5E5]">
          {note.title}
        </p>
        {/* The poster: an avatar dot and a username line, drawn as a bar (no name, no count). */}
        <span aria-hidden className="flex items-center gap-1">
          <span className={cn("size-3 shrink-0 rounded-full", look.dot)} />
          <span className="h-1.5 w-8 rounded-full bg-[#E3E3E3] dark:bg-[#3A3A3C]" />
        </span>
        {note.comment && (
          <p className="relative mt-0.5 w-fit rounded-[8px] rounded-tl-none bg-[#F5F5F5] px-1.5 py-0.5 text-[11px] leading-[14px] text-[#333333] dark:bg-[#2C2C2E] dark:text-[#E5E5E5]">
            <span lang="zh">{note.comment}</span>
          </p>
        )}
      </div>
    </li>
  );
}

function Feed({ chat }: { chat: Extract<Chat, { app: "xhs" }> }) {
  const t = useT();
  const left = chat.notes.flatMap((n, i) => (i % 2 === 0 ? [{ n, i }] : []));
  const right = chat.notes.flatMap((n, i) => (i % 2 === 1 ? [{ n, i }] : []));
  return (
    <Card className="bg-[#F6F6F6] text-[#333333] dark:bg-[#0E0E0E] dark:text-[#E5E5E5]">
      <div role="group" aria-label={t(chat.label)}>
        {/* The feed's top bar: three tabs as bars, the middle one marked in red, and a search icon. */}
        <div aria-hidden className="flex items-center justify-between bg-white px-3 pt-2 pb-1.5 dark:bg-[#161616]">
          <EllipsisIcon className="size-4 opacity-60" />
          <span className="flex items-end gap-3">
            <span className="mb-[5px] h-1.5 w-6 rounded-full bg-[#CFCFCF] dark:bg-[#4A4A4A]" />
            <span className="flex flex-col items-center gap-1">
              <span className="h-2 w-7 rounded-full bg-[#333333] dark:bg-[#E5E5E5]" />
              <span className={cn("h-[3px] w-4 rounded-full", RED)} />
            </span>
            <span className="mb-[5px] h-1.5 w-6 rounded-full bg-[#CFCFCF] dark:bg-[#4A4A4A]" />
          </span>
          <SearchIcon className="size-4 opacity-60" />
        </div>
        <div className="grid grid-cols-2 items-start gap-1.5 px-1.5 pt-1.5">
          <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
            {left.map(({ n, i }) => (
              <Note key={i} note={n} index={i} />
            ))}
          </ul>
          <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
            {right.map(({ n, i }) => (
              <Note key={i} note={n} index={i} />
            ))}
          </ul>
        </div>
        {/* The bottom bar: the red plus between two bars. */}
        <div aria-hidden className="mt-1.5 flex items-center justify-around bg-white px-3 py-1.5 dark:bg-[#161616]">
          <span className="h-1.5 w-6 rounded-full bg-[#CFCFCF] dark:bg-[#4A4A4A]" />
          <span className={cn("grid h-5 w-8 place-items-center rounded-[6px] text-white", RED)}>
            <PlusIcon className="size-3.5" strokeWidth={3} />
          </span>
          <span className="h-1.5 w-6 rounded-full bg-[#CFCFCF] dark:bg-[#4A4A4A]" />
        </div>
      </div>
    </Card>
  );
}
