"use client";

import { useActionState } from "react";
import { forgotAction, loginAction, registerAction, resetAction, type FormState } from "@/lib/actions/auth";
import { PasswordField } from "@/components/password-field";

const initial: FormState = { error: "" };

export function RegisterForm({ next }: { next?: string }) {
  const [state, action, pending] = useActionState(registerAction, initial);
  return (
    <form action={action} aria-labelledby="registrace-nadpis">
      {next ? <input type="hidden" name="dal" value={next} /> : null}
      <EmailField />
      <PasswordField name="heslo" label="Heslo" autoComplete="new-password" />
      <PasswordField name="heslo-znovu" label="Heslo znovu" autoComplete="new-password" />
      <FormError error={state.error} />
      <button type="submit" disabled={pending}>
        Vytvořit účet
      </button>
    </form>
  );
}

export function LoginForm({ next }: { next?: string }) {
  const [state, action, pending] = useActionState(loginAction, initial);
  return (
    <form action={action} aria-labelledby="prihlaseni-nadpis">
      {next ? <input type="hidden" name="dal" value={next} /> : null}
      <EmailField />
      <PasswordField name="heslo" label="Heslo" autoComplete="current-password" />
      <FormError error={state.error} />
      <button type="submit" disabled={pending}>
        Přihlásit se
      </button>
    </form>
  );
}

export function ForgotForm() {
  const [state, action, pending] = useActionState(forgotAction, initial);
  return (
    <form action={action} aria-labelledby="zapomenute-nadpis">
      <EmailField />
      {state.sent ? <p role="status">Pokud účet existuje, poslali jsme odkaz na e-mail.</p> : null}
      <FormError error={state.error} />
      <button type="submit" disabled={pending}>
        Poslat odkaz
      </button>
    </form>
  );
}

export function ResetForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState(resetAction, initial);
  return (
    <form action={action} aria-labelledby="obnoveni-nadpis">
      <input type="hidden" name="token" value={token} />
      <PasswordField name="heslo" label="Nové heslo" autoComplete="new-password" />
      <FormError error={state.error} />
      <button type="submit" disabled={pending}>
        Uložit heslo
      </button>
    </form>
  );
}

function EmailField() {
  return (
    <div className="field">
      <label htmlFor="email">E-mail</label>
      <input
        id="email"
        name="email"
        type="email"
        autoComplete="username"
        inputMode="email"
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        required
      />
    </div>
  );
}

function FormError({ error }: { error: string }) {
  if (!error) return null;
  return (
    <p role="alert" className="notice">
      {error}
    </p>
  );
}
