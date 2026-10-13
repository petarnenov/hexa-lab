// App - the one screen: header, form, report.
//
// App owns the mutation and hands its pieces down: the form gets `mutate`
// and `isPending`, the report gets `status`, `data` and `error`. Neither
// child knows about React Query or fetch. React Query clears `data`/`error`
// itself when `mutate` runs again, so a new submit hides the old error
// without any reset here.
import { FeeForm } from "./FeeForm";
import { FeeReportView } from "./FeeReportView";
import { useCalculateFees } from "./useCalculateFees";

export function App() {
  const fees = useCalculateFees();

  return (
    <div className="shell">
      <header className="header">
        <h1>hexa-lab</h1>
        <p>Household fees</p>
      </header>
      <main>
        <FeeForm onSubmit={fees.mutate} isPending={fees.isPending} />
        <FeeReportView status={fees.status} report={fees.data} error={fees.error} />
      </main>
    </div>
  );
}
