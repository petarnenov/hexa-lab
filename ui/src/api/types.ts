// The JSON contract of `POST /households/:id/fees`, as the UI sees it.
//
// These are a copy of the shapes in src/domain/FeeReport.ts, not an import:
// the UI is a separate client and knows only the JSON the HTTP adapter
// sends, not the domain. If the server contract changes, the fixture in
// test/fixtures.ts (the README's curl output) is what breaks first.
// `period` is two strings here - there is no BillingPeriod object on the
// client, only what JSON.stringify produced.

export type FeeRequest = {
  readonly householdId: string;
  readonly from: string;
  readonly to: string;
};

export type FeeLine = {
  readonly accountId: string;
  readonly accountName: string;
  readonly aum: number;
  readonly feeScheduleId: string;
  readonly fee: number;
};

export type FeeReport = {
  readonly householdId: string;
  readonly period: { readonly from: string; readonly to: string };
  readonly lines: readonly FeeLine[];
  readonly total: number;
};
