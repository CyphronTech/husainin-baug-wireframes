import { forgotPassword, login, sendOtp, verifyOtp } from "@/app/actions";
import { Msg, type SP } from "@/lib/ui";

export default async function Login({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  return (
    <main className="login">
      <div className="card stack" style={{ width: 360 }}>
        <div><h1>Husainin Baug</h1><p className="muted" style={{ margin: 0 }}>Hall &amp; Room Booking</p></div>
        <Msg msg={sp.msg} />
        {sp.otp === undefined ? (
          <form action={login} className="stack">
            <h2 style={{ margin: 0 }}>Sign in</h2>
            <label>Mobile number or User ID<input name="id" required autoFocus /></label>
            <label>Password<input name="password" type="password" required /></label>
            <label className="check"><input type="checkbox" name="remember" />Remember me</label>
            <button className="btn primary">Sign in</button>
            <button className="link" formAction={forgotPassword} formNoValidate>Forgot password?</button>
          </form>
        ) : (
          <form action={verifyOtp} className="stack">
            <h2 style={{ margin: 0 }}>Sign in with OTP on WhatsApp</h2>
            <label>Mobile number or User ID<input name="id" required defaultValue={sp.otp} /></label>
            <label>6-digit code<input name="code" inputMode="numeric" autoComplete="one-time-code" /></label>
            <label className="check"><input type="checkbox" name="remember" />Remember me</label>
            <div className="row">
              <button className="btn" formAction={sendOtp} formNoValidate>Send code</button>
              <button className="btn primary">Verify &amp; sign in</button>
            </div>
            <a href="/login">Use password instead</a>
          </form>
        )}
        {sp.otp === undefined && <a className="btn" href="/login?otp=" style={{ textAlign: "center" }}>Sign in with OTP on WhatsApp</a>}
        <p className="muted" style={{ margin: 0 }}>Accounts are created by Admin. There is no self sign-up.</p>
      </div>
    </main>
  );
}
