"use client";

import { useActionState } from "react";
import type { ActionState } from "@/lib/actions";

/**
 * Small wrapper that runs a server action and shows its failure state inline.
 * Success is reflected by the revalidated page content.
 */
export function ActionForm({
  action,
  className,
  children,
}: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  className?: string;
  children: React.ReactNode;
}) {
  const [state, formAction, pending] = useActionState(action, null);
  return (
    <form action={formAction} className={className}>
      <fieldset
        disabled={pending}
        style={{ border: "none", padding: 0, margin: 0, display: "contents" }}
      >
        {children}
      </fieldset>
      {state && "error" in state && (
        <div className="error-text" role="alert">
          {state.error}
        </div>
      )}
    </form>
  );
}
