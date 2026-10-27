import { login } from "@/app/actions";
import { Msg, type SP } from "@/lib/ui";

export default async function Login({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  return (
    <main className="login">
      <form action={login} className="card stack narrow">
        <div><h1>Husainin Baug</h1><p className="muted m0">Hall &amp; Room Booking</p></div>
        <Msg msg={sp.msg} />
        <h2 className="m0">Sign in</h2>
        <label>Username<input name="username" required autoFocus autoComplete="username" /></label>
        <label>Password<input name="password" type="password" required autoComplete="current-password" /></label>
        <label className="check"><input type="checkbox" name="remember" />Remember me</label>
        <button className="btn primary">Sign in</button>
        <p className="muted m0">Accounts are created by Admin. Forgot your password? Ask Admin to reset it.</p>
      </form>
    </main>
  );
}
