# Husainin Baug — Hall & Room Booking

Next.js 16 (App Router, server actions) + Firebase Auth + Firestore. Razorpay Payment Links (mocked until keys are set), MSG91 WhatsApp.

## Run locally (emulators, no cloud project needed)

```bash
npm i && npm i -g firebase-tools
cp .env.example .env.local        # uncomment the emulator lines; any fake API key works
npm run emulators                 # terminal 1 (needs Java)
node --env-file=.env.local scripts/seed.mjs admin@example.org "Husainin Baug Admin" 9822000100 secret123
npm run dev                       # terminal 2 → http://localhost:3000
```

## How it works

- **Double booking**: every venue/date/slot is a doc in `locks/` (`{venueId}_{date}_{M|E|D}`). A booking creates all its locks
  in one Firestore transaction with `tx.create`, so concurrent attempts can't both succeed. Hall full day = M + E locks.
  Slot is held at creation (status `pending`); payment flips it to `confirmed`.
- **Access**: Firestore rules deny all client access. Every read/write runs server-side with the Admin SDK after
  `requireUser()` / `requireAdmin()`. Sector users only get their own sector's booking details (`/bookings/[id]` 404s otherwise).
- **Payments**: `lib/razorpay.ts`. With `RAZORPAY_KEY_ID` unset, links point to `/mock-pay/...`, which calls the same
  `markPaid()` the webhook does. Going live: set the 3 keys, add webhook `{APP_URL}/api/razorpay/webhook` for `payment_link.paid`.
- **WhatsApp**: `lib/whatsapp.ts`. With `MSG91_AUTHKEY` unset, it logs to the console. Two templates are needed (variables listed in the file).
- **Receipt**: `/r/{bookingDocId}`, a public, printable page linked from WhatsApp. No PDF lib or file storage.
- **Cancellations**: unpaid hold → creator/admin releases it directly. Paid → creator requests, admin approves and records the manual refund.
- **Audit**: every mutation writes to `audit/` within the same transaction.

## Deploy

Firebase App Hosting (Blaze): `firebase apphosting:backends:create`, fill in `apphosting.yaml`, set secrets, `firebase deploy --only firestore:rules`.
Seed against prod with `GOOGLE_APPLICATION_CREDENTIALS` set and no password argument, then use "Forgot password" on /login.

## Not built (deliberately)

- Expenses screen (wireframe marks it "future").
- Backblaze B2: no Phase 1 feature stores files. Add it with the expenses bill upload (S3-compatible presigned PUT).
- Household master / counts: households are captured per booking.
- Sector dashboard: sector users land on Booking options.
