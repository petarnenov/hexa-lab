// money - the one place numbers become text.
//
// en-US with exactly two decimals: `maximumFractionDigits` is needed too,
// the default is 3 and 5239.734 would show three. One shared formatter so
// a line and the total can never disagree on format.
const formatter = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function money(amount: number): string {
  return formatter.format(amount);
}
