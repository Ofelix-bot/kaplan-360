"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "cn";
import { useT } from "@/components/i18n/I18nProvider";
import type { Face, KappyEngine, KappyInfo, Pose, Tool } from "./engine";
import { Kappy, KappyBubble, KappyIcon } from "./Kappy";
import s from "./showcase.module.css";

// /kappy: Kappy on a stage with a button per state, and a still card per state that plays it on the stage. The lines
// it says here are examples, not adviser output. The adviser page drives the same engine from its events.

type Act = "idle" | "listen" | "think" | "wave" | `tool:${Tool}` | "flash" | "light" | "celebrate" | "audit" | "human";

const STATE_NAMES: Record<KappyInfo["state"], string> = { idle: "IDLE", listen: "LISTENING", think: "THINKING", blocked: "BLOCKED", human: "HAND OFF", done: "DONE" };

export function KappyShowcase() {
  const t = useT();
  const stage = useRef<KappyEngine | null>(null);
  const bubble = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const seq = useRef(0);
  const [info, setInfo] = useState<KappyInfo>({ state: "idle", bulb: "OFF", tool: "—" });
  const hello = t("Hi, I'm Kappy. Click me, or try the buttons.");
  // Kappy's own effect (its engine) runs before this one, so the stage is there to greet.
  useEffect(() => stage.current?.say(hello), [hello]);

  const TOOL_LINES: Record<Tool, string> = {
    school: t("Found 10 master's programmes in your budget and regions."),
    case: t("Your degree leads to 6 in-demand roles."),
    pass: t("Found the Employment Pass minimum salary for your age and sector."),
    chart: t("Found the official graduate employment and starting-salary figures."),
  };

  async function act(a: Act) {
    const k = stage.current;
    if (!k) return;
    const mine = ++seq.current;
    const wait = (ms: number) => new Promise<boolean>((res) => setTimeout(() => res(mine === seq.current), ms));
    if (a === "idle") {
      k.unlight();
      k.set("idle");
      k.say(t("I'm here. Click me any time."));
    } else if (a === "listen") {
      const field = input.current ?? undefined;
      k.set("listen", { target: field });
      k.say(t("I'm listening…"));
      for (let i = 0; i < 10; i++) if (await wait(170)) k.hear(field);
      if (await wait(900)) k.set("idle");
    } else if (a === "think") {
      k.unlight();
      k.set("think");
      k.say(t("Checking the Employment Pass minimum salary…"));
    } else if (a === "wave") k.poke();
    else if (a.startsWith("tool:")) {
      const kind = a.slice(5) as Tool;
      if (k.state !== "think") k.set("think");
      k.showTool(kind, 1300);
      k.say(TOOL_LINES[kind]);
    } else if (a === "flash") {
      k.set("idle");
      k.flash();
      k.say(t("This step has a result."));
    } else if (a === "light") {
      k.set("done");
      k.light();
      k.say(t("Every figure checks out. Here's your roadmap."));
    } else if (a === "celebrate") {
      k.set("done");
      k.celebrate();
      k.say(t("Saved to your plan. You can undo it."));
    } else if (a === "audit") {
      k.set("think");
      k.say(t("A second AI is checking each line against the official pages…"));
      if (!(await wait(1600))) return;
      k.set("blocked");
      k.say(t("One line doesn't match: the IELTS requirement is missing “no band below 6.0”. Fixing it."));
      if (!(await wait(2200))) return;
      k.set("think");
      k.say(t("Rewriting that line in the official wording…"));
      if (!(await wait(1500))) return;
      k.set("done");
      k.light();
      k.say(t("Fixed. Everything matches now."));
    } else if (a === "human") {
      k.set("human");
      k.say(t("Both checks failed. Please ask a human adviser this time →"));
    }
  }

  const GROUPS: { title: string; items: [Act, string, Face?][] }[] = [
    { title: t("States"), items: [["idle", t("Idle")], ["listen", t("Listening")], ["think", t("Thinking")], ["wave", t("Wave")]] },
    {
      title: t("Lookups (icon on the chest screen)"),
      items: [["tool:school", t("Programmes"), "school"], ["tool:case", t("Roles"), "case"], ["tool:pass", t("Work pass"), "pass"], ["tool:chart", t("Figures"), "chart"]],
    },
    { title: t("Getting a result"), items: [["flash", t("Step flash")], ["light", t("Full light")], ["celebrate", t("Save and celebrate")]] },
    { title: t("Checking"), items: [["audit", t("Blocked → rewrite → pass")], ["human", t("Hand off to a person")]] },
  ];

  const TILES: [Act, string, string, Pose, ("cap" | "case")?][] = [
    ["idle", t("Idle"), t("Blinks, bobs a pixel up and down, and follows your pointer."), { face: "idle" }],
    ["listen", t("Listening"), t("Turns to the input and nods while you type."), { face: "eq2", look: [-3, 2] }],
    ["think", t("Thinking"), t("Sweeps its lens left and right; dots cycle on its chest."), { face: "dots3", look: [3, 0] }],
    ["tool:pass", t("Looking up"), t("Flashes an icon on its chest for each lookup."), { face: "pass", look: [-2, 1] }],
    ["flash", t("Step flash"), t("When a step has a result, the bulb pops up and blinks."), { face: "idle", bulb: "up", lamp: true }],
    ["light", t("Full light"), t("Lights up and glows once the check passes and the roadmap appears."), { face: "happy", bulb: "full", lamp: true, cl: true, cr: true }],
    ["audit", t("Blocked"), t("Lens turns red and the screen shows ×_×, then it fixes the line."), { face: "blocked", alert: true }],
    ["human", t("Hand off"), t("After two failed checks, it points you to a human adviser."), { face: "sad", cr: true, look: [3, 1] }],
    ["celebrate", t("Saved"), t("Jumps and throws stars when you save to your plan."), { face: "wow", cl: true, cr: true }],
    ["think", t("Split · master's first"), t("Wears a mortarboard during the debate."), { face: "dots3", bulb: "up", lamp: true }, "cap"],
    ["tool:case", t("Split · work first"), t("Carries a briefcase during the debate."), { face: "case", look: [-2, 0] }, "case"],
  ];

  return (
    <div className={cn("container", s.page)}>
      <header className={s.head}>
        <p className={s.eyebrow}>Kaplan 360++ · AI adviser</p>
        <h1 className={s.title}>Kappy</h1>
        <p className={s.lead}>
          {t("The AI adviser's pixel sidekick. It listens, looks things up, and the little bulb on its head lights up when it has an answer. When a figure doesn't match the official page, its lens turns red and it fixes the line before you see it.")}
        </p>
        <p className={s.note}>{t("Original character · 64×96 pixels · Every Kappy on this page responds to a click")}</p>
      </header>

      <section className={s.sec} aria-labelledby="kappy-stage">
        <div className={s.secHead}>
          <h2 id="kappy-stage">{t("Stage")}</h2>
          <p>{t("Use the buttons to play each state. Click Kappy and it waves; move your pointer and its lens follows.")}</p>
        </div>
        <div className={s.stage}>
          <div className={cn(s.floor, s.grid)}>
            <div className={s.row}>
              <Kappy ref={stage} bubble={bubble} poke={t("Ask me: master's first, or work first?")} label={t("Kappy on the stage: click to wave")} onChange={setInfo} />
              <KappyBubble ref={bubble} />
            </div>
            <div className={s.lcd} aria-hidden="true">
              <span>
                STATE <b>{STATE_NAMES[info.state]}</b>
              </span>
              <span>
                BULB <b>{info.bulb}</b>
              </span>
              <span>
                TOOL <b>{info.tool}</b>
              </span>
            </div>
          </div>
          <div className={s.controls}>
            {GROUPS.map((g) => (
              <div key={g.title} className={s.group}>
                <h3>{g.title}</h3>
                <div className={s.btns}>
                  {g.items.map(([a, label, icon]) => (
                    <button key={a} type="button" className={s.btn} onClick={() => act(a)}>
                      {icon && <KappyIcon name={icon} className={s.ico} />}
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
            <div className={s.field}>
              <label htmlFor="kappy-hear">{t("Type something to it")}</label>
              <input
                ref={input}
                id="kappy-hear"
                type="text"
                autoComplete="off"
                placeholder={t("e.g. I want to work for two years before a master's")}
                onFocus={() => {
                  stage.current?.set("listen", { target: input.current ?? undefined });
                  stage.current?.say(t("I'm listening…"));
                }}
                onInput={() => stage.current?.hear(input.current ?? undefined)}
                onBlur={() => {
                  if (stage.current?.state === "listen") stage.current.set("idle");
                }}
              />
            </div>
          </div>
        </div>
      </section>

      <section className={s.sec} aria-labelledby="kappy-states">
        <div className={s.secHead}>
          <h2 id="kappy-states">{t("Every state")}</h2>
          <p>{t("Each card is a still of one state. Click a card and Kappy acts it out on the stage.")}</p>
        </div>
        <div className={s.sheet}>
          {TILES.map(([a, title, line, pose, acc]) => (
            <button
              key={title}
              type="button"
              className={s.tile}
              onClick={() => {
                act(a);
                document.getElementById("kappy-stage")?.scrollIntoView({ block: "start", behavior: "smooth" });
              }}
            >
              <span className={cn(s.box, s.grid)}>
                <Kappy still pose={pose} acc={acc} />
              </span>
              <b>{title}</b>
              <small>{line}</small>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
