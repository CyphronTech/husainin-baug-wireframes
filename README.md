# Husainin Baug — Hall & Room Booking

Next.js 16 (App Router, server actions) + Firestore. Razorpay Payment Links (mocked until keys are set), MSG91 WhatsApp.
Built from the admin (A1–A9) and Sector / Mohalla (Login, M1–M8) wireframes on `main`.

## Run locally against a real Firebase project (free Spark plan — no hosting needed)

1. [console.firebase.google.com](https://console.firebase.google.com) → create a project (Spark plan is fine).
2. Build → Firestore Database → Create database → **production mode** (deny-all rules; the app uses the Admin SDK,
   which bypasses them).
3. Note the **Project ID** (Project settings → General).
4. Project settings → Service accounts → Generate new private key → save the JSON **outside** this folder.
5. `cp .env.example .env.local` (Windows: `copy .env.example .env.local`) and fill in `NEXT_PUBLIC_FIREBASE_PROJECT_ID`, `GOOGLE_APPLICATION_CREDENTIALS=/full/path/to/that.json`
   and the four `B2_*` lines. Leave the emulator, Razorpay and MSG91 lines empty (both run as mocks).
6. `npm i`
7. `node --env-file=.env.local scripts/seed.mjs` (admin `50450028` / `Password`; pass `<username> <password>` to change)
8. `npm run dev` → http://localhost:3000

## Run locally (emulators, no cloud project needed)

```bash
npm i && npm i -g firebase-tools
cp .env.example .env.local        # uncomment FIRESTORE_EMULATOR_HOST, set any project id
npm run emulators                 # terminal 1 (needs Java)
node --env-file=.env.local scripts/seed.mjs
npm run dev                       # terminal 2 → http://localhost:3000
```

## How it works

- **Login**: username + password stored in Firestore `users/{username}` (plain text for now — marked `shortcut:`
  in `login()`). Sessions are random tokens in `sessions/{token}`. Admin sets and resets passwords on the Users screen.
- **Holds**: a new booking holds its slots for 10 minutes (`HOLD_MINUTES`). Holds lapse lazily: every reader treats
  a pending lock past `holdUntil` as free, so there's no cron. If a payment arrives after the hold lapsed and the slot was
  taken meanwhile, the booking is marked *Refund due* (Payments page). Razorpay links expire at 16 min (their minimum is 15).
- **Booking wizard** (`/book` → `/book/review`): state lives in the URL. Household is picked from the sector's
  household master. The booking's sector is the household's sector, so Admin can book for any sector.
- **Households**: HOF ID (8–10 digits) is the doc id, so it's unique across sectors. A HOF registered to one sector can't be
  overwritten from another. CSV import is previewed in the browser, then re-validated on the server.
- **Double booking**: every venue/date/slot is a doc in `locks/` (`{venueId}_{date}_{M|E|D}`). A booking creates all its locks
  in one Firestore transaction with `tx.create`, so concurrent attempts can't both succeed. Hall full day = M + E locks.
  Slot is held at creation (status `pending`); payment flips it to `confirmed`.
- **Access**: Firestore rules deny all client access. Every read/write runs server-side with the Admin SDK after
  `requireUser()` / `requireAdmin()`. Sector users only get their own sector's booking details (`/bookings/[id]` 404s otherwise).
- **Payments**: `lib/razorpay.ts`. With `RAZORPAY_KEY_ID` unset, links point to `/mock-pay/...`, which calls the same
  `markPaid()` the webhook does. Going live: set the 3 keys, add webhook `{APP_URL}/api/razorpay/webhook` for `payment_link.paid`.
- **WhatsApp**: `lib/whatsapp.ts`. With `MSG91_AUTHKEY` unset, it logs to the console . Three templates
  are needed (hold, confirmed, cancelled). Variables are listed in the file. Nothing is sent to households without WhatsApp consent.
- **Receipt**: on payment the PDF is generated (no dependency) and uploaded to a public Backblaze B2 bucket
  (`lib/b2.ts`). The WhatsApp confirmation carries only that link. Without B2 env vars, or if an upload fails, the link
  falls back to `/r/{bookingDocId}/pdf`, which the app generates live.
- **Cancellations**: unpaid hold → creator/admin releases it directly. Paid → creator requests, admin approves and records the manual refund.
- **Audit**: every mutation writes to `audit/` within the same transaction.

## Deploy

Firebase App Hosting (Blaze): `firebase apphosting:backends:create`, fill in `apphosting.yaml`, set secrets, `firebase deploy --only firestore:rules`.
Seed with `GOOGLE_APPLICATION_CREDENTIALS` set: `node --env-file=.env.local scripts/seed.mjs <username> <password>`.

## Not built (deliberately)

- Expenses screen (wireframe marks it "future").
