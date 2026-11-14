"use client";

import { useActionState, useState } from "react";
import { DocumentEditor } from "@/components/document-editor";
import { saveQuestionAction, saveQuizDraftAction, type FormState } from "@/lib/actions/library";
import { emptyDocument, textDocument, type StudyDocument } from "@/lib/document";
import type { QuestionDraft, QuestionType } from "@/lib/quiz";

const initial: FormState = { error: "" };

type OptionState = { key: string; content: StudyDocument; correct: boolean };

export function QuestionForm({
  materialId,
  questionId,
  initialType = "single",
  stem,
  options,
}: {
  materialId: string;
  questionId?: string;
  initialType?: QuestionType;
  stem?: StudyDocument;
  options?: { content: StudyDocument; correct: boolean }[];
}) {
  const [type, setType] = useState<QuestionType>(initialType);
  const [zadani, setZadani] = useState(stem ?? emptyDocument());
  const [items, setItems] = useState<OptionState[]>(
    options?.map((option, index) => ({ key: `${index}`, ...option })) ?? [
      { key: "a", content: emptyDocument(), correct: true },
      { key: "b", content: emptyDocument(), correct: false },
    ],
  );
  const [truth, setTruth] = useState(options?.[0]?.correct ?? true);
  const [state, action, pending] = useActionState(saveQuestionAction, initial);
  const payload = type === "boolean" ? booleanOptions(truth) : items.map(({ content, correct }) => ({ content, correct }));
  return (
    <form action={action} aria-label={questionId ? "Úprava otázky" : "Nová otázka"}>
      <input type="hidden" name="material" value={materialId} />
      {questionId ? <input type="hidden" name="otazka" value={questionId} /> : null}
      <input type="hidden" name="typ" value={type} />
      <input type="hidden" name="zadani" value={JSON.stringify(zadani)} />
      <input type="hidden" name="moznosti" value={JSON.stringify(payload)} />
      <fieldset>
        <legend>Typ otázky</legend>
        {(
          [
            ["single", "Jedna správná odpověď"],
            ["multi", "Více správných odpovědí"],
            ["boolean", "Pravda/nepravda"],
          ] as const
        ).map(([value, label]) => (
          <label key={value} className="choice">
            <input type="radio" name="typ-zobrazeni" value={value} checked={type === value} onChange={() => setType(value)} />
            {label}
          </label>
        ))}
      </fieldset>
      <DocumentEditor label="Zadání" value={zadani} onChange={setZadani} />
      {type === "boolean" ? (
        <fieldset>
          <legend>Správná odpověď</legend>
          <label className="choice">
            <input type="radio" name="pravda" checked={truth} onChange={() => setTruth(true)} />
            Pravda
          </label>
          <label className="choice">
            <input type="radio" name="pravda" checked={!truth} onChange={() => setTruth(false)} />
            Nepravda
          </label>
        </fieldset>
      ) : (
        <fieldset>
          <legend>Možnosti</legend>
          {items.map((item, index) => (
            <div key={item.key} className="option-editor">
              <label className="choice">
                <input
                  type={type === "single" ? "radio" : "checkbox"}
                  name="spravna"
                  checked={item.correct}
                  onChange={() => {
                    setItems((current) =>
                      current.map((option, optionIndex) => {
                        if (type === "single") return { ...option, correct: optionIndex === index };
                        if (optionIndex !== index) return option;
                        return { ...option, correct: !option.correct };
                      }),
                    );
                  }}
                />
                Správná
              </label>
              <DocumentEditor
                label={`Možnost ${index + 1}`}
                value={item.content}
                onChange={(content) => setItems((current) => current.map((option, optionIndex) => (optionIndex === index ? { ...option, content } : option)))}
              />
            </div>
          ))}
          <button
            type="button"
            onClick={() => setItems((current) => [...current, { key: crypto.randomUUID(), content: emptyDocument(), correct: false }])}
          >
            Přidat možnost
          </button>
        </fieldset>
      )}
      {state.error ? <p role="alert" className="notice">{state.error}</p> : null}
      <button type="submit" disabled={pending}>
        Uložit otázku
      </button>
    </form>
  );
}

export function DraftQuizEditor({ draftId, title, questions }: { draftId: string; title: string; questions: QuestionDraft[] }) {
  const [name, setName] = useState(title);
  const [items, setItems] = useState(questions);
  const [state, action, pending] = useActionState(saveQuizDraftAction, initial);
  return (
    <form action={action} aria-labelledby="navrh-nadpis">
      <input type="hidden" name="navrh" value={draftId} />
      <input type="hidden" name="otazky" value={JSON.stringify(items)} />
      <div className="field">
        <label htmlFor="nazev-kvizu">Název kvízu</label>
        <input id="nazev-kvizu" name="nazev" value={name} onChange={(event) => setName(event.target.value)} required maxLength={120} />
      </div>
      {items.map((question, index) => (
        <fieldset key={index}>
          <legend>
            Otázka {index + 1}
            {question.type === "single" ? " · jedna správná" : question.type === "boolean" ? " · pravda/nepravda" : " · více správných"}
          </legend>
          <DocumentEditor
            label={`Zadání otázky ${index + 1}`}
            value={question.stem}
            onChange={(stem) => setItems((current) => current.map((item, itemIndex) => (itemIndex === index ? { ...item, stem } : item)))}
          />
          {question.options.map((option, optionIndex) => (
            <div key={optionIndex} className="option-editor">
              <label className="choice">
                <input
                  type={question.type === "multi" ? "checkbox" : "radio"}
                  name={`spravna-${index}`}
                  checked={option.correct}
                  onChange={() => {
                    setItems((current) =>
                      current.map((item, itemIndex) => {
                        if (itemIndex !== index) return item;
                        return {
                          ...item,
                          options: item.options.map((candidate, candidateIndex) => {
                            if (question.type === "single" || question.type === "boolean") {
                              return { ...candidate, correct: candidateIndex === optionIndex };
                            }
                            if (candidateIndex !== optionIndex) return candidate;
                            return { ...candidate, correct: !candidate.correct };
                          }),
                        };
                      }),
                    );
                  }}
                />
                Správná
              </label>
              <DocumentEditor
                label={`Otázka ${index + 1}, možnost ${optionIndex + 1}`}
                value={option.content}
                onChange={(content) =>
                  setItems((current) =>
                    current.map((item, itemIndex) =>
                      itemIndex === index
                        ? {
                            ...item,
                            options: item.options.map((candidate, candidateIndex) =>
                              candidateIndex === optionIndex ? { ...candidate, content } : candidate,
                            ),
                          }
                        : item,
                    ),
                  )
                }
              />
            </div>
          ))}
          {question.type !== "boolean" ? (
            <button
              type="button"
              onClick={() =>
                setItems((current) =>
                  current.map((item, itemIndex) =>
                    itemIndex === index ? { ...item, options: [...item.options, { content: emptyDocument(), correct: false }] } : item,
                  ),
                )
              }
            >
              Přidat možnost
            </button>
          ) : null}
        </fieldset>
      ))}
      {state.error ? <p role="alert" className="notice">{state.error}</p> : null}
      <button type="submit" disabled={pending}>
        Uložit kvíz
      </button>
    </form>
  );
}

function booleanOptions(truth: boolean): { content: StudyDocument; correct: boolean }[] {
  return [
    { content: textDocument("Pravda"), correct: truth },
    { content: textDocument("Nepravda"), correct: !truth },
  ];
}
