# Husainin Baug — Hall & Room Booking

Next.js 16 (App Router, server actions) + Firebase Auth + Firestore. Razorpay Payment Links (mocked until keys are set), MSG91 WhatsApp.
Built from the admin (A1–A9) and Sector / Mohalla (Login, M1–M8) wireframes on `main`.

## Run locally (emulators, no cloud project needed)

```bash
npm i && npm i -g firebase-tools
cp .env.example .env.local        # uncomment the emulator lines; any fake API key works
npm run emulators                 # terminal 1 (needs Java)
node --env-file=.env.local scripts/seed.mjs admin@example.org "Husainin Baug Admin" 9822000100 secret123
npm run dev                       # terminal 2 → http://localhost:3000
```

## How it works

- **Login**: mobile number or email + password, or a 6-digit OTP on WhatsApp. Sign-in runs server-side via the
  Firebase Auth REST API (no Firebase SDK in the browser) and ends in an httpOnly session cookie. OTP sign-in mints a
  custom token, so in production the App Hosting service account needs the "Service Account Token Creator" role.
- **Holds**: a new booking holds its slots for 10 minutes (`HOLD_MINUTES`). Holds lapse lazily: every reader treats
  a pending lock past `holdUntil` as free, so there's no cron. If a payment arrives after the hold lapsed and the slot was
  taken meanwhile, the booking is marked *Refund due* (Payments page). Razorpay links expire at 16 min (their minimum is 15).
- **Booking wizard** (`/book` → `/book/review`): state lives in the URL. Household is picked from the sector's
  household master. The booking's sector is the household's sector, so Admin can book for any sector.
- **Households**: HOF ID is the doc id, so it's unique across sectors. A HOF registered to one sector can't be
  overwritten from another. CSV import is previewed in the browser, then re-validated on the server.
- **Double booking**: every venue/date/slot is a doc in `locks/` (`{venueId}_{date}_{M|E|D}`). A booking creates all its locks
  in one Firestore transaction with `tx.create`, so concurrent attempts can't both succeed. Hall full day = M + E locks.
  Slot is held at creation (status `pending`); payment flips it to `confirmed`.
- **Access**: Firestore rules deny all client access. Every read/write runs server-side with the Admin SDK after
  `requireUser()` / `requireAdmin()`. Sector users only get their own sector's booking details (`/bookings/[id]` 404s otherwise).
- **Payments**: `lib/razorpay.ts`. With `RAZORPAY_KEY_ID` unset, links point to `/mock-pay/...`, which calls the same
  `markPaid()` the webhook does. Going live: set the 3 keys, add webhook `{APP_URL}/api/razorpay/webhook` for `payment_link.paid`.
- **WhatsApp**: `lib/whatsapp.ts`. With `MSG91_AUTHKEY` unset, it logs to the console (OTP codes included). Four templates
  are needed (hold, confirmed, cancelled, otp). Variables are listed in the file. Nothing is sent to households without WhatsApp consent.
- **Receipt**: `/r/{bookingDocId}` (page) and `/r/{bookingDocId}/pdf` (PDF generated on request, no dependency). MSG91 fetches the
  PDF URL as the WhatsApp attachment, so no file storage is needed.
- **Cancellations**: unpaid hold → creator/admin releases it directly. Paid → creator requests, admin approves and records the manual refund.
- **Audit**: every mutation writes to `audit/` within the same transaction.

## Deploy

Firebase App Hosting (Blaze): `firebase apphosting:backends:create`, fill in `apphosting.yaml`, set secrets, `firebase deploy --only firestore:rules`.
Seed against prod with `GOOGLE_APPLICATION_CREDENTIALS` set and no password argument, then use "Forgot password" on /login.

## Not built (deliberately)

- Expenses screen (wireframe marks it "future").
- Backblaze B2: no Phase 1 feature stores files. Add it with the expenses bill upload (S3-compatible presigned PUT).
