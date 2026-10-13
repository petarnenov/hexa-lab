// App - the shell: a header with the project name and an empty main.
//
// STORY-3.2 puts the form and the report inside <main>. The shell itself
// knows nothing about fees, which is why it can be tested with nothing
// behind it (App.test.tsx).
export function App() {
  return (
    <div className="shell">
      <header className="header">
        <h1>hexa-lab</h1>
        <p>Household fees</p>
      </header>
      <main />
    </div>
  );
}
