import Link from "next/link";
import { deleteExpense, saveExpense } from "@/app/actions";
import { getVenues, rows } from "@/lib/data";
import { db } from "@/lib/firebase-admin";
import { fmt, inr, today } from "@/lib/format";
import { requireAdmin } from "@/lib/session";
import { EXPENSE_CATEGORIES, type Booking, type Expense } from "@/lib/types";
import { Msg, type SP } from "@/lib/ui";
import { Submit } from "@/lib/submit";

export default async function Expenses({ searchParams }: { searchParams: SP }) {
  const { dmy } = await fmt();
  await requireAdmin();
  const sp = await searchParams;
  const month = sp.month || today().slice(0, 7);
  // shortcut: loads all expenses and confirmed bookings, filters by month in memory. Fine for a few thousand/year;
  // beyond that, query by date range.
  const [venues, expenses, bookings] = await Promise.all([
    getVenues(),
    db.collection("expenses").get().then(rows<Expense>),
    db.collection("bookings").where("status", "==", "confirmed").get().then(rows<Booking>),
  ]);
  const editing = expenses.find((x) => x.id === sp.edit);
  const inMonth = expenses.filter((e) => e.date.startsWith(month)).sort((a, b) => b.date.localeCompare(a.date));
  const venueName = (id: string) => (id ? venues.find((v) => v.id === id)?.name ?? id : "All / general");
  // Income = booked rate of each venue-day falling in the month (a booking spanning months splits across them).
  const report = [...venues.map((v) => v.id), ""].map((id) => {
    const income = id ? bookings.flatMap((b) => b.items).filter((i) => i.venueId === id && i.date.startsWith(month)).reduce((s, i) => s + i.rate, 0) : 0;
    const spent = inMonth.filter((e) => e.venueId === id).reduce((s, e) => s + e.amount, 0);
    return { id, income, spent };
  });
  const total = report.reduce((t, r) => ({ income: t.income + r.income, spent: t.spent + r.spent }), { income: 0, spent: 0 });

  return (
    <>
      <div className="top"><h1>Expenses</h1></div>
      <Msg msg={sp.msg} />
      <div className="grid g2e mb-5">
        <div className="card">
          <h2>{editing ? "Edit expense" : "Record an expense"}</h2>
          <form action={saveExpense} className="stack" key={editing?.id ?? "new"}>
            <input type="hidden" name="id" value={editing?.id ?? ""} />
            <div className="row">
              <label>Expense date<input type="date" name="date" required defaultValue={editing?.date ?? today()} /></label>
              <label>Venue<select name="venueId" defaultValue={editing?.venueId ?? ""}><option value="">All / general</option>{venues.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}</select></label>
            </div>
            <div className="row">
              <label>Category<select name="category" defaultValue={editing?.category}>{EXPENSE_CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></label>
              <label>Amount (₹)<input type="number" name="amount" min={1} required defaultValue={editing?.amount} /></label>
            </div>
            <label>Paid to<input name="paidTo" required defaultValue={editing?.paidTo} /></label>
            <label>{editing?.billName ? `Replace bill (current: ${editing.billName})` : "Bill / invoice (PDF or photo, max 10 MB)"}<input type="file" name="bill" accept=".pdf,image/*" /></label>
            <label>Notes<textarea name="notes" rows={2} defaultValue={editing?.notes} /></label>
            <div className="row"><Submit className="btn primary">Save expense</Submit>{editing && <Link className="btn" href={`/expenses?month=${month}`}>Cancel</Link>}</div>
          </form>
        </div>
        <div className="card">
          <div className="top mb-2">
            <h2 className="m0">Income vs expenses</h2>
            <form className="row"><input type="month" name="month" defaultValue={month} /><button className="btn">Show</button></form>
          </div>
          <table>
            <thead><tr><th>Venue</th><th className="text-right">Income</th><th className="text-right">Expenses</th><th className="text-right">Net</th></tr></thead>
            <tbody>
              {report.map((r) => (
                <tr key={r.id || "general"}><td>{venueName(r.id)}</td><td className="text-right">{inr(r.income)}</td><td className="text-right">{inr(r.spent)}</td><td className="text-right">{inr(r.income - r.spent)}</td></tr>
              ))}
              <tr><td><b>Total</b></td><td className="text-right"><b>{inr(total.income)}</b></td><td className="text-right"><b>{inr(total.spent)}</b></td><td className="text-right"><b>{inr(total.income - total.spent)}</b></td></tr>
            </tbody>
          </table>
          <p className="alert info">Income counts confirmed bookings by event date. General expenses are not split across venues.</p>
        </div>
      </div>
      <div className="card">
        <h2>Expenses · {new Date(month + "-01T00:00:00Z").toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" })}</h2>
        <table>
          <thead><tr><th>Date</th><th>Venue</th><th>Category</th><th className="text-right">Amount</th><th>Paid to</th><th>Bill</th><th>Notes</th><th><span className="sr-only">Actions</span></th></tr></thead>
          <tbody>
            {inMonth.map((e) => (
              <tr key={e.id}>
                <td>{dmy(e.date)}</td><td>{venueName(e.venueId)}</td><td>{e.category}</td><td className="text-right">{inr(e.amount)}</td><td>{e.paidTo}</td>
                <td>{e.billUrl ? <a href={e.billUrl} target="_blank" rel="noreferrer">{e.billName}</a> : "—"}</td><td>{e.notes}</td>
                <td>
                  <Link href={`/expenses?month=${month}&edit=${e.id}`}>Edit</Link>
                  {/* Native two-step confirm: open, then confirm. No JS. */}
                  <details className="inline"><summary className="link">Delete</summary>
                    <form action={deleteExpense}><input type="hidden" name="id" value={e.id} /><input type="hidden" name="month" value={month} /><button className="btn danger mt-3">Confirm delete</button></form>
                  </details>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
