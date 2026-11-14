"use client";

import { useRef } from "react";

export function ConfirmForm({
  action,
  label,
  message,
  fields,
}: {
  action: (formData: FormData) => void | Promise<void>;
  label: string;
  message: string;
  fields: Record<string, string>;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  return (
    <>
      <button type="button" className="quiet" onClick={() => dialogRef.current?.showModal()}>
        {label}
      </button>
      <dialog ref={dialogRef}>
        <form action={action}>
          {Object.entries(fields).map(([name, value]) => (
            <input key={name} type="hidden" name={name} value={value} />
          ))}
          <p>{message}</p>
          <div className="choices">
            <button type="button" className="quiet" onClick={() => dialogRef.current?.close()}>
              Zrušit
            </button>
            <button type="submit">Smazat</button>
          </div>
        </form>
      </dialog>
    </>
  );
}
