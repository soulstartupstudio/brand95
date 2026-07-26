"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { createBrand, type CreateBrandPayload } from "@/lib/actions";

const STEPS = ["Idea", "Constraints", "Blueprint setup"] as const;

export function CreateBrandWizard() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState<CreateBrandPayload>({
    name: "",
    concept: "",
  });

  function set<K extends keyof CreateBrandPayload>(
    key: K,
    value: CreateBrandPayload[K],
  ) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function next() {
    setError(null);
    if (step === 0) {
      if (form.name.trim().length < 2) {
        setError("Give the brand a working name or codename.");
        return;
      }
      if (form.concept.trim().length < 10) {
        setError("Describe the product idea in a sentence or two.");
        return;
      }
    }
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  }

  function submit() {
    setError(null);
    startTransition(async () => {
      const result = await createBrand(form);
      if ("error" in result) {
        setError(result.error);
      } else {
        router.push(`/brands/${result.brandId}`);
      }
    });
  }

  return (
    <div style={{ maxWidth: 680 }}>
      <div className="wizard-steps">
        {STEPS.map((label, i) => (
          <span key={label} className={`step ${i === step ? "current" : ""}`}>
            {i + 1}. {label}
          </span>
        ))}
      </div>

      {step === 0 && (
        <div className="form">
          <div className="field">
            <label>Brand or codename *</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="e.g. Camera95"
            />
          </div>
          <div className="field">
            <label>Product idea *</label>
            <textarea
              value={form.concept}
              onChange={(e) => set("concept", e.target.value)}
              placeholder="What is the product, in plain words?"
            />
          </div>
          <div className="field">
            <label>Problem or desire addressed</label>
            <textarea
              value={form.problem ?? ""}
              onChange={(e) => set("problem", e.target.value)}
            />
          </div>
          <div className="field">
            <label>Target customer</label>
            <input
              type="text"
              value={form.customerHypothesis ?? ""}
              onChange={(e) => set("customerHypothesis", e.target.value)}
            />
          </div>
          <div className="field">
            <label>Target geography</label>
            <input
              type="text"
              value={form.geography ?? ""}
              onChange={(e) => set("geography", e.target.value)}
              placeholder="e.g. Benelux first, then EU"
            />
          </div>
          <div className="field">
            <label>Expected price</label>
            <input
              type="text"
              value={form.priceRange ?? ""}
              onChange={(e) => set("priceRange", e.target.value)}
              placeholder="e.g. €19–€35 retail"
            />
          </div>
          <div className="field">
            <label>Why should Brand95 build it?</label>
            <textarea
              value={form.convictionStatement ?? ""}
              onChange={(e) => set("convictionStatement", e.target.value)}
              placeholder="Founder conviction statement"
            />
          </div>
        </div>
      )}

      {step === 1 && (
        <div className="form">
          <div className="field">
            <label>Starting budget</label>
            <input
              type="text"
              value={form.startingBudget ?? ""}
              onChange={(e) => set("startingBudget", e.target.value)}
              placeholder="e.g. €15,000"
            />
          </div>
          <div className="field">
            <label>Maximum initial inventory exposure</label>
            <input
              type="text"
              value={form.maxInventoryExposure ?? ""}
              onChange={(e) => set("maxInventoryExposure", e.target.value)}
              placeholder="e.g. €8,000"
            />
          </div>
          <div className="field">
            <label>Desired launch date</label>
            <input
              type="date"
              value={form.desiredLaunchDate ?? ""}
              onChange={(e) => set("desiredLaunchDate", e.target.value)}
            />
          </div>
          <div className="field">
            <label>Founder hours available per week</label>
            <input
              type="number"
              min={0}
              max={100}
              value={form.founderHoursPerWeek ?? ""}
              onChange={(e) => set("founderHoursPerWeek", e.target.value)}
            />
          </div>
          <div className="field">
            <label>Compliance concerns</label>
            <textarea
              value={form.complianceConcerns ?? ""}
              onChange={(e) => set("complianceConcerns", e.target.value)}
            />
          </div>
          <div className="field">
            <label>Existing supplier / sample / assets</label>
            <textarea
              value={form.existingAssets ?? ""}
              onChange={(e) => set("existingAssets", e.target.value)}
            />
          </div>
          <div className="field">
            <label>Known constraints</label>
            <textarea
              value={form.knownConstraints ?? ""}
              onChange={(e) => set("knownConstraints", e.target.value)}
            />
          </div>
          <div className="field">
            <label>Preferred first channel</label>
            <select
              value={form.preferredChannel ?? ""}
              onChange={(e) =>
                set(
                  "preferredChannel",
                  (e.target.value || undefined) as CreateBrandPayload["preferredChannel"],
                )
              }
            >
              <option value="">Undecided — recommend at validation</option>
              <option value="RETAIL_FIRST">Retail-first</option>
              <option value="D2C_FIRST">D2C-first</option>
              <option value="DUAL_VALIDATION">Dual validation</option>
            </select>
          </div>
          <div className="field">
            <label>Initial D2C and retail hypothesis</label>
            <textarea
              value={form.channelHypothesis ?? ""}
              onChange={(e) => set("channelHypothesis", e.target.value)}
            />
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="card">
          <h3>Ready to set up “{form.name || "…"}”</h3>
          <p className="muted">Creating this brand will instantiate:</p>
          <ul style={{ fontSize: 14, paddingLeft: 18 }}>
            <li>The 11-stage Blueprint with all gates and criteria (Stage 0 active)</li>
            <li>Brand and Commercial workstream tracks</li>
            <li>Stage 0 intake tasks (including the research-spend approval prep)</li>
            <li>The initial risk register</li>
            <li>An audit event trail from the moment of creation</li>
          </ul>
          <p className="muted">
            Nothing external happens: research spend, outreach, and every stage
            gate still require explicit approval in the inbox.
          </p>
        </div>
      )}

      {error && (
        <div className="error-text" style={{ marginTop: 12 }} role="alert">
          {error}
        </div>
      )}

      <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
        {step > 0 && (
          <button className="btn" onClick={() => setStep((s) => s - 1)} disabled={pending}>
            Back
          </button>
        )}
        {step < STEPS.length - 1 && (
          <button className="btn primary" onClick={next}>
            Continue
          </button>
        )}
        {step === STEPS.length - 1 && (
          <button className="btn primary" onClick={submit} disabled={pending}>
            {pending ? "Setting up…" : "Create brand"}
          </button>
        )}
      </div>
    </div>
  );
}
