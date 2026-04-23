"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useMemo, useState } from "react";

import { ApiError, apiRequest } from "@/lib/api";
import { getStoredToken, logout } from "@/lib/auth";
import type {
  Workflow,
  WorkflowActionInput,
  WorkflowDefinitionInput,
} from "@/types/api";

const DEFAULT_DEFINITION: WorkflowDefinitionInput = {
  trigger_event_type: "lead_created",
  enabled: true,
  order: 0,
  actions: [
    {
      action_type: "log",
      parameters: {
        message: "Lead created workflow trigger",
      },
      order: 0,
    },
  ],
};

function validateDefinition(input: string): WorkflowDefinitionInput {
  let parsed: unknown;
  try {
    parsed = JSON.parse(input);
  } catch {
    throw new Error("Definition must be valid JSON.");
  }

  if (!parsed || typeof parsed !== "object") {
    throw new Error("Definition must be a JSON object.");
  }

  const record = parsed as Record<string, unknown>;
  const trigger = record.trigger_event_type;
  if (typeof trigger !== "string" || trigger.trim().length === 0) {
    throw new Error("Definition requires a non-empty trigger_event_type.");
  }

  const enabled = record.enabled;
  if (typeof enabled !== "boolean") {
    throw new Error("Definition requires a boolean enabled field.");
  }

  const order = record.order;
  if (!Number.isInteger(order) || Number(order) < 0) {
    throw new Error("Definition requires a non-negative integer order.");
  }

  if (!Array.isArray(record.actions) || record.actions.length === 0) {
    throw new Error("Definition requires an actions array with at least one action.");
  }

  const actions = record.actions.map((action, index) => {
    if (!action || typeof action !== "object") {
      throw new Error(`Action at index ${index} must be an object.`);
    }
    const actionRecord = action as Record<string, unknown>;

    if (
      typeof actionRecord.action_type !== "string" ||
      actionRecord.action_type.trim().length === 0
    ) {
      throw new Error(`Action at index ${index} requires action_type.`);
    }

    const actionOrder = actionRecord.order;
    if (!Number.isInteger(actionOrder) || Number(actionOrder) < 0) {
      throw new Error(`Action at index ${index} requires a non-negative integer order.`);
    }

    const parameters = actionRecord.parameters;
    if (parameters === undefined || parameters === null || typeof parameters !== "object") {
      throw new Error(`Action at index ${index} requires parameters object.`);
    }

    return {
      action_type: actionRecord.action_type,
      parameters: parameters as Record<string, unknown>,
      order: Number(actionOrder),
    } as WorkflowActionInput;
  });

  const sortedOrders = actions
    .map((action) => action.order)
    .sort((a, b) => a - b);
  for (let i = 0; i < sortedOrders.length; i += 1) {
    if (sortedOrders[i] !== i) {
      throw new Error("Action order must be sequential starting at 0.");
    }
  }

  return {
    trigger_event_type: trigger,
    enabled,
    order: Number(order),
    actions,
  };
}

export default function NewWorkflowPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [definitionText, setDefinitionText] = useState(
    JSON.stringify(DEFAULT_DEFINITION, null, 2),
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trimmedName = useMemo(() => name.trim(), [name]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!trimmedName) {
      setError("Name is required.");
      return;
    }

    let definition: WorkflowDefinitionInput;
    try {
      definition = validateDefinition(definitionText);
    } catch (validationError) {
      setError(
        validationError instanceof Error
          ? validationError.message
          : "Invalid definition JSON.",
      );
      return;
    }

    const token = getStoredToken();
    if (!token) {
      logout();
      window.location.replace("/login");
      return;
    }

    setIsSubmitting(true);

    try {
      const created = await apiRequest<Workflow>("/api/v1/workflows", {
        method: "POST",
        authToken: token,
        body: {
          name: trimmedName,
          description: description.trim() || null,
          trigger_event_type: definition.trigger_event_type,
          enabled: definition.enabled,
          order: definition.order,
          actions: definition.actions,
        },
      });

      router.push(`/workflows/${created.id}`);
    } catch (requestError) {
      if (requestError instanceof ApiError && requestError.status === 401) {
        logout();
        window.location.replace("/login");
        return;
      }
      setError(
        requestError instanceof Error ? requestError.message : "Unable to create workflow.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-slate-900">Create Workflow</h1>
        <Link
          href="/workflows"
          className="rounded-md border border-border px-4 py-2 text-sm text-slate-700 hover:bg-slate-100"
        >
          Back to Workflows
        </Link>
      </div>

      <form
        className="space-y-4 rounded-lg border border-border bg-surface p-5"
        onSubmit={handleSubmit}
      >
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="name">
            Name
          </label>
          <input
            id="name"
            type="text"
            required
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="w-full rounded-md border border-border bg-white px-3 py-2 text-sm outline-none ring-brand/20 focus:ring-2"
            placeholder="Lead Follow-Up Workflow"
          />
        </div>

        <div>
          <label
            className="mb-1 block text-sm font-medium text-slate-700"
            htmlFor="description"
          >
            Description
          </label>
          <textarea
            id="description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            rows={3}
            className="w-full rounded-md border border-border bg-white px-3 py-2 text-sm outline-none ring-brand/20 focus:ring-2"
            placeholder="Optional description for this workflow"
          />
        </div>

        <div>
          <label
            className="mb-1 block text-sm font-medium text-slate-700"
            htmlFor="definition"
          >
            Workflow Definition JSON
          </label>
          <textarea
            id="definition"
            value={definitionText}
            onChange={(event) => setDefinitionText(event.target.value)}
            rows={14}
            className="w-full rounded-md border border-border bg-slate-900 px-3 py-2 font-mono text-xs text-slate-100 outline-none ring-brand/20 focus:ring-2"
          />
        </div>

        {error ? (
          <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        ) : null}

        <div className="flex items-center gap-2">
          <button
            type="submit"
            disabled={isSubmitting}
            className="rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? "Creating..." : "Create"}
          </button>
          <button
            type="button"
            className="rounded-md border border-border px-4 py-2 text-sm text-slate-700 hover:bg-slate-100"
            onClick={() => setDefinitionText(JSON.stringify(DEFAULT_DEFINITION, null, 2))}
          >
            Reset JSON
          </button>
        </div>
      </form>
    </section>
  );
}
