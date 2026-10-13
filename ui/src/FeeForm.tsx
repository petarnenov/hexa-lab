// FeeForm - household and period, prefilled with the README example.
//
// A controlled native <form>: Enter in any field submits through the
// browser, and a disabled submit button also blocks Enter, so "no second
// request while pending" needs no code here. No client-side validation of
// the dates on purpose - that is the use case's job; the UI only shows
// whatever error it returns (INVALID_BILLING_PERIOD for a reversed period).
import { useState, type FormEvent } from "react";

import type { FeeRequest } from "./api/types";

type Props = {
  readonly onSubmit: (request: FeeRequest) => void;
  readonly isPending: boolean;
};

export function FeeForm({ onSubmit, isPending }: Props) {
  const [householdId, setHouseholdId] = useState("hh-1");
  const [from, setFrom] = useState("2026-01-01");
  const [to, setTo] = useState("2026-03-31");

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit({ householdId, from, to });
  }

  return (
    <form className="fee-form" onSubmit={submit}>
      <label>
        Household
        <input value={householdId} onChange={(e) => setHouseholdId(e.target.value)} />
      </label>
      <label>
        From
        <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
      </label>
      <label>
        To
        <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
      </label>
      <button type="submit" disabled={isPending}>
        Calculate
      </button>
    </form>
  );
}
