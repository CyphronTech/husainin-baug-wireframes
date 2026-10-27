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

---

## Wireframe presentation site (GitHub Pages)

A static presentation site for client review of the **Husainin Baug Hall & Room Booking** wireframes.
It contains 18 clickable screens covering three areas:

- **Login**
- **Admin** (A1–A9): dashboard, booking options, hall/room configuration, sector/mohalla setup, payments, users, cancellations, Miqaat details, expenses
- **Sector / Mohalla user** (M1–M8): dashboard, booking flow, payment and WhatsApp, bookings list, households, cancellation, and the WhatsApp message as seen on a phone

The overview page (`index.html`) shows every screen as a thumbnail and in a full-screen viewer.
Each screen is also a normal web page: links inside the wireframes navigate between screens, and when a
screen is opened on its own a small pill at the bottom-right offers **← Overview**, previous / next screen
and the screen title (press `[` / `]` for previous / next; the × button hides it).

No build step, framework or server code is needed: it is plain HTML, CSS and JavaScript.

### Folder structure

```
site/
├── index.html              Overview page (gallery + full-screen viewer)
├── 404.html                "Page not found" page, links back to the overview
├── .nojekyll               Tells GitHub Pages to serve files as-is (no Jekyll processing)
├── README.md               This file
├── screens.json            Canvas metadata: screen titles, order and page groups
├── assets/
│   ├── presentation.css    Styles for the overview page
│   ├── presentation.js     Gallery / viewer behaviour for the overview page
│   ├── screen-nav.css      Floating navigation pill + page-fill rules for the screens
│   └── screen-nav.js       Pill (only when not inside an iframe) and placeholder-link handling
└── screens/
    ├── Login.html
    ├── Main.html            (A1 Admin dashboard)
    ├── A2_Booking.html … A9_Miqaat.html
    └── M1_Dashboard.html … M8_WhatsApp_Mobile.html
```

Screen order (used by the overview and the prev / next links): Login, Main, A2_Booking, A3_Venues,
A4_Mohalla, A5_Payments, A6_Users, A8_Cancellations, A9_Miqaat, A7_Expenses, M1_Dashboard, M2_Booking,
M3_BookingReview, M4_Payment, M5_Bookings, M6_Households, M7_Cancel, M8_WhatsApp_Mobile.
If you add, remove or rename a screen, update `screens.json` and the `SCREENS` list at the top of
`assets/screen-nav.js`.

Links such as "Forgot password?", "Sign in with OTP" and the WhatsApp "Pay" button are intentional
placeholders (`href="#..."`); they do nothing when clicked.

### Preview locally

Option A — just open it: double-click `site/index.html` (or any file in `site/screens/`) to open it in a browser.
Most things work directly from disk. Some browsers restrict iframes or `fetch` on `file://` URLs, so if the
overview looks empty, use option B.

Option B — run a tiny local web server (recommended; matches GitHub Pages behaviour):

```bash
npx serve site
# then open the URL it prints, usually http://localhost:3000
```

Alternatives if you don't have Node.js: `python -m http.server 8000 --directory site` and open
http://localhost:8000.

### Deploy to GitHub Pages

1. **Create a repository** on GitHub (e.g. `husainin-baug-wireframes`). It can be public, or private if your
   GitHub plan supports Pages for private repositories.
2. **Push the contents of `site/` to the `main` branch**, so that `index.html` sits at the repository root
   (not inside a `site/` folder):

   ```bash
   cd site
   git init
   git add .
   git commit -m "Wireframe presentation site"
   git branch -M main
   git remote add origin https://github.com/<your-account>/husainin-baug-wireframes.git
   git push -u origin main
   ```

   Make sure the hidden `.nojekyll` file is included (`git add .` does include it).
3. On GitHub, open the repository → **Settings** → **Pages**.
4. Under **Build and deployment**, set **Source** to **Deploy from a branch**, then choose
   **Branch: `main`** and folder **`/ (root)`**, and click **Save**.
5. Wait a minute or two. The site will be published at
   `https://<your-account>.github.io/husainin-baug-wireframes/` (the address is shown at the top of the
   Pages settings). Share that link with the client.

To update the site later, edit the files, commit and `git push` again; Pages redeploys automatically.

**Alternative — `/docs` folder:** if the wireframes live inside a larger repository, copy the contents of
`site/` into a `docs/` folder at that repository's root, push to `main`, and in **Settings → Pages** choose
**Branch: `main`** and folder **`/docs`**.

All links in the site are relative, so it works both at a project URL (`/<repo>/`) and on a custom domain.

### Editing the placeholder client / company / version text

The overview page header and footer contain placeholder text — the client name, your company / studio name,
and the version or date label of this review round. To change them:

1. Open `index.html` in any text editor.
2. Search for `<!-- EDITABLE` — every placeholder (version/date, "[Client]", "[Your company]", next steps, footer contact) is marked with that comment. Replace the text next to it and keep the surrounding HTML tags unchanged.
3. Also update the `<title>` near the top of `index.html` if you want the browser tab to show the client
   name.
4. Save, refresh the browser to check, then commit and push to republish.

The wireframe screens themselves (`screens/*.html`) are the reviewed designs; avoid editing them unless the
design changes.
