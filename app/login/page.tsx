import { forgotPassword, login } from "@/app/actions";
import { Msg, type SP } from "@/lib/ui";

export default async function Login({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  return (
    <main className="login">
      <form action={login} className="card stack" style={{ width: 360 }}>
        <div><h1>Husainin Baug</h1><p className="muted" style={{ margin: 0 }}>Hall &amp; Room Booking</p></div>
        <Msg msg={sp.msg} />
        <h2 style={{ margin: 0 }}>Sign in</h2>
        <label>Username (mobile number or email)<input name="id" required autoFocus /></label>
        <label>Password<input name="password" type="password" required /></label>
        <label className="check"><input type="checkbox" name="remember" />Remember me</label>
        <button className="btn primary">Sign in</button>
        <button className="link" formAction={forgotPassword} formNoValidate>Forgot password?</button>
        <p className="muted" style={{ margin: 0 }}>Accounts are created by Admin. There is no self sign-up.</p>
      </form>
    </main>
  );
}
