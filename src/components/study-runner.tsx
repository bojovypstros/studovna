"use client";

import { useEffect, useState } from "react";
import { DocumentView } from "@/components/document-view";
import { rateCardAction, rateQuestionAction, finishSessionAction } from "@/lib/actions/study";
import type { StudyDocument } from "@/lib/document";
import { intervalLabel, type CardRating, type Sm2State } from "@/lib/sm2";

export type RunnerItem =
  | {
      kind: "card";
      id: string;
      front: StudyDocument;
      back: StudyDocument;
      state: Sm2State;
      repeats: number;
    }
  | {
      kind: "question";
      id: string;
      stem: StudyDocument;
      type: string;
      options: { id: string; content: StudyDocument }[];
    };

export function StudyRunner({ sessionId, items }: { sessionId: string; items: RunnerItem[] }) {
  const [queue, setQueue] = useState(items);
  const [revealed, setRevealed] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [feedback, setFeedback] = useState("");
  const [correctIds, setCorrectIds] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [counts, setCounts] = useState({ nevim: 0, znovu: 0, vim: 0, spravne: 0, spatne: 0 });
  const current = queue[0];

  useEffect(() => {
    if (queue.length === 0) void finishSessionAction(sessionId);
  }, [queue.length, sessionId]);

  if (!current) {
    return (
      <section aria-labelledby="souhrn-nadpis">
        <h1 id="souhrn-nadpis">Souhrn bloku</h1>
        <ul className="summary">
          <li>Nevím: {counts.nevim}</li>
          <li>Znovu: {counts.znovu}</li>
          <li>Vím: {counts.vim}</li>
          <li>Správně: {counts.spravne}</li>
          <li>Špatně: {counts.spatne}</li>
        </ul>
        <p>
          <a href="/studovna">Zpět do studovny</a>
        </p>
      </section>
    );
  }

  if (current.kind === "card") {
    const now = new Date();
    return (
      <section aria-labelledby="uloha-nadpis">
        <h1 id="uloha-nadpis">Kartička</h1>
        <p className="hint">
          Zbývá {queue.length}. Nevím vrací kartičku ještě jednou a pak za 10 minut. Znovu je nejdřív za den. Vím prodlužuje odstup.
        </p>
        <DocumentView document={current.front} />
        {revealed ? <DocumentView document={current.back} /> : null}
        {error ? <p role="alert" className="notice">{error}</p> : null}
        {revealed ? (
          <div className="choices">
            {(["nevim", "znovu", "vim"] as CardRating[]).map((rating) => (
              <button
                key={rating}
                type="button"
                disabled={busy}
                onClick={() => {
                  if (busy) return;
                  setBusy(true);
                  void (async () => {
                    const result = await rateCardAction(sessionId, current.id, rating);
                    if ("error" in result) {
                      setError(result.error);
                      setBusy(false);
                      return;
                    }
                    setCounts((value) => ({ ...value, [rating]: value[rating] + 1 }));
                    setQueue((value) => {
                      const rest = value.slice(1);
                      if (rating === "nevim" && current.repeats < 1) {
                        const again = { ...current, repeats: current.repeats + 1, state: result.state };
                        rest.splice(Math.min(2, rest.length), 0, again);
                      }
                      return rest;
                    });
                    setRevealed(false);
                    setError("");
                    setBusy(false);
                  })();
                }}
              >
                {rating === "nevim" ? "Nevím" : rating === "znovu" ? "Znovu" : "Vím"} ({intervalLabel(current.state, rating, now)})
              </button>
            ))}
          </div>
        ) : (
          <button type="button" onClick={() => setRevealed(true)} disabled={busy}>
            Ukázat rub
          </button>
        )}
      </section>
    );
  }

  const multiple = current.type === "multi";
  return (
    <section aria-labelledby="uloha-nadpis">
      <h1 id="uloha-nadpis">Otázka</h1>
      <p className="hint">Zbývá {queue.length}. U více správných odpovědí platí jen přesná shoda.</p>
      <DocumentView document={current.stem} />
      <fieldset>
        <legend>{multiple ? "Vyberte všechny správné možnosti" : "Vyberte jednu možnost"}</legend>
        {current.options.map((option) => (
          <label key={option.id} className="option">
            <input
              type={multiple ? "checkbox" : "radio"}
              name="odpoved"
              value={option.id}
              checked={selected.includes(option.id)}
              onChange={() => {
                setSelected((value) => {
                  if (multiple) return value.includes(option.id) ? value.filter((id) => id !== option.id) : [...value, option.id];
                  return [option.id];
                });
              }}
            />
            <DocumentView document={option.content} />
            {feedback && correctIds.includes(option.id) ? <span className="tag">Správná odpověď</span> : null}
          </label>
        ))}
      </fieldset>
      {feedback ? <p role="status">{feedback}</p> : null}
      {error ? <p role="alert" className="notice">{error}</p> : null}
      {feedback ? (
        <button
          type="button"
          onClick={() => {
            setQueue((value) => value.slice(1));
            setSelected([]);
            setFeedback("");
            setCorrectIds([]);
          }}
        >
          Další
        </button>
      ) : (
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            if (busy) return;
            setBusy(true);
            void (async () => {
              const result = await rateQuestionAction(sessionId, current.id, selected);
              setBusy(false);
              if ("error" in result) {
                setError(result.error);
                return;
              }
              setFeedback(result.correct ? "Správně" : "Špatně");
              setCorrectIds(result.correctIds);
              setCounts((value) => ({
                ...value,
                spravne: value.spravne + (result.correct ? 1 : 0),
                spatne: value.spatne + (result.correct ? 0 : 1),
              }));
            })();
          }}
        >
          Vyhodnotit
        </button>
      )}
    </section>
  );
}
