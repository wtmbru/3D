"use client";

import { useActionState } from "react";
import { login } from "../actions";

export function LoginForm() {
  const [state, action, pending] = useActionState(login, {});
  return (
    <form action={action} className="mt-5 space-y-4">
      <label className="block">
        <span className="text-sm font-semibold">Password</span>
        <input
          type="password"
          name="password"
          required
          autoFocus
          autoComplete="current-password"
          className="admin-input mt-1"
        />
      </label>
      {state.error && (
        <p role="alert" className="rounded-xl bg-tomato-soft px-3 py-2 text-sm font-semibold">
          {state.error}
        </p>
      )}
      <button type="submit" className="btn btn-primary w-full" disabled={pending}>
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
