// FeeReportPublisher - a driven (outbound) port: "here is the finished
// report, deliver it".
//
// The application does not care whether the report ends up on a terminal,
// in a message queue or in an e-mail. It hands the report over and waits
// for the hand-over to finish; nothing comes back.
//
// Consumed by: CalculateHouseholdFeesService (application).
// Implemented by: the report publishers in adapters/out.

import type { FeeReport } from "../../../domain/FeeReport.ts";

export interface FeeReportPublisher {
  /**
   * Delivers the report. Returns a Promise even though some adapters are
   * synchronous by nature: the port describes the most general need, so a
   * synchronous and an asynchronous adapter share one signature.
   */
  publish(report: FeeReport): Promise<void>;
}
