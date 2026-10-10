"use client";

import { startTransition, useActionState } from "react";

/**
 * Como useActionState, pero sin el vaciado automático del formulario que hace React 19 tras cada
 * envío: si el servidor devuelve un error, la persona no pierde lo que había escrito.
 * Uso: const [state, onSubmit, pending] = useActionForm(action, {}); <form onSubmit={onSubmit}>
 */
export function useActionForm<S>(action: (prev: Awaited<S>, formData: FormData) => S | Promise<S>, initial: Awaited<S>) {
  const [state, formAction, pending] = useActionState(action, initial);
  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLElement | null;
    const data = new FormData(e.currentTarget, submitter);
    startTransition(() => formAction(data));
  }
  return [state, onSubmit, pending] as const;
}
