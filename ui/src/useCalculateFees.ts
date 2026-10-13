// useCalculateFees - the mutation behind the form.
//
// A mutation, not a query: POST /households/:id/fees is a command (the
// server publishes the report as a side effect), so it must run only when
// the user asks, never on mount or on window focus. The generics make
// `error` an ApiError | null, so the report view reads `error.code` without
// instanceof - calculateFees guarantees it throws nothing else.
import { useMutation } from "@tanstack/react-query";

import { calculateFees } from "./api/calculateFees";
import type { ApiError } from "./api/ApiError";
import type { FeeReport, FeeRequest } from "./api/types";

export function useCalculateFees() {
  return useMutation<FeeReport, ApiError, FeeRequest>({ mutationFn: calculateFees });
}
