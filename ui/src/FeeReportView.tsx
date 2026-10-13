// FeeReportView - the report and the three states around it.
//
// One component for idle / pending / error / success: they are mutually
// exclusive and share the CSS. The total is the server's `total`, never a
// client-side sum - the server already rounds to cents and is the source of
// truth, exactly as for the CLI and curl.
import type { ApiError } from "./api/ApiError";
import type { FeeReport } from "./api/types";
import { money } from "./money";

type Props = {
  readonly status: "idle" | "pending" | "error" | "success";
  readonly report: FeeReport | undefined;
  readonly error: ApiError | null;
};

export function FeeReportView({ status, report, error }: Props) {
  switch (status) {
    case "idle":
      return <p className="muted">Pick a household and a period.</p>;
    case "pending":
      return (
        <p className="muted" aria-busy="true">
          Calculating…
        </p>
      );
    case "error":
      return (
        <div role="alert" className="alert">
          <span className="badge">{error?.code ?? "UNKNOWN"}</span>
          <p>{error?.message ?? "Unknown error"}</p>
        </div>
      );
    case "success":
      return report ? <ReportTable report={report} /> : null;
  }
}

function ReportTable({ report }: { readonly report: FeeReport }) {
  return (
    <table className="report">
      <caption>
        {report.householdId} · {report.period.from} → {report.period.to}
      </caption>
      <thead>
        <tr>
          <th>Account</th>
          <th className="num">AUM</th>
          <th>Schedule</th>
          <th className="num">Fee</th>
        </tr>
      </thead>
      <tbody>
        {report.lines.map((line) => (
          <tr key={line.accountId}>
            <td>{line.accountName}</td>
            <td className="num">{money(line.aum)}</td>
            <td>{line.feeScheduleId}</td>
            <td className="num">{money(line.fee)}</td>
          </tr>
        ))}
      </tbody>
      <tfoot>
        <tr>
          <td colSpan={3}>Total</td>
          <td className="num">{money(report.total)}</td>
        </tr>
      </tfoot>
    </table>
  );
}
