"use client";

import { useActionState, useState } from "react";
import { DocumentEditor } from "@/components/document-editor";
import { saveCardAction, type FormState } from "@/lib/actions/library";
import { emptyDocument, type StudyDocument } from "@/lib/document";

const initial: FormState = { error: "" };

export function CardForm({
  materialId,
  cardId,
  front,
  back,
}: {
  materialId: string;
  cardId?: string;
  front?: StudyDocument;
  back?: StudyDocument;
}) {
  const [lic, setLic] = useState(front ?? emptyDocument());
  const [rub, setRub] = useState(back ?? emptyDocument());
  const [state, action, pending] = useActionState(saveCardAction, initial);
  return (
    <form action={action} aria-label={cardId ? "Úprava kartičky" : "Nová kartička"}>
      <input type="hidden" name="material" value={materialId} />
      {cardId ? <input type="hidden" name="karta" value={cardId} /> : null}
      <input type="hidden" name="lic" value={JSON.stringify(lic)} />
      <input type="hidden" name="rub" value={JSON.stringify(rub)} />
      <DocumentEditor label="Líc" value={lic} onChange={setLic} />
      <DocumentEditor label="Rub" value={rub} onChange={setRub} />
      {state.error ? (
        <p role="alert" className="notice">
          {state.error}
        </p>
      ) : null}
      <button type="submit" disabled={pending}>
        Uložit kartičku
      </button>
    </form>
  );
}
