"use client";

import { useActionState, useState } from "react";
import { DocumentEditor } from "@/components/document-editor";
import { saveNoteAction, type FormState } from "@/lib/actions/library";
import type { StudyDocument } from "@/lib/document";

const initial: FormState = { error: "" };

export function NoteForm({ materialId, document }: { materialId: string; document: StudyDocument }) {
  const [value, setValue] = useState(document);
  const [state, action, pending] = useActionState(saveNoteAction, initial);
  return (
    <form action={action} aria-label="Poznámka">
      <input type="hidden" name="material" value={materialId} />
      <input type="hidden" name="dokument" value={JSON.stringify(value)} />
      <DocumentEditor label="Text poznámky" value={value} onChange={setValue} />
      {state.error ? <p role="alert" className="notice">{state.error}</p> : null}
      <button type="submit" disabled={pending}>
        Uložit poznámku
      </button>
    </form>
  );
}
