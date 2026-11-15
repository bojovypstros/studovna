"use client";

import { useId, useState } from "react";

export function PasswordField({
  name,
  label,
  autoComplete,
}: {
  name: string;
  label: string;
  autoComplete: "current-password" | "new-password";
}) {
  const id = useId();
  const hintId = `${id}-napoveda`;
  const [shown, setShown] = useState(false);
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <div className="password-row">
        <input
          id={id}
          name={name}
          type={shown ? "text" : "password"}
          autoComplete={autoComplete}
          required
          minLength={8}
          maxLength={128}
          aria-describedby={hintId}
        />
        <button
          type="button"
          aria-pressed={shown}
          onClick={() => setShown((value) => !value)}
        >
          {shown ? "Skrýt heslo" : "Ukázat heslo"}
        </button>
      </div>
      <p id={hintId} className="hint">
        Alespoň 8 znaků. Zvláštní znaky nejsou povinné.
      </p>
    </div>
  );
}
