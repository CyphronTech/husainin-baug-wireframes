# Husainin Baug Hall & Room Booking — Wireframes

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

## Folder structure

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

## Preview locally

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

## Deploy to GitHub Pages

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

## Editing the placeholder client / company / version text

The overview page header and footer contain placeholder text — the client name, your company / studio name,
and the version or date label of this review round. To change them:

1. Open `index.html` in any text editor.
2. Search for `<!-- EDITABLE` — every placeholder (version/date, "[Client]", "[Your company]", next steps, footer contact) is marked with that comment. Replace the text next to it and keep the surrounding HTML tags unchanged.
3. Also update the `<title>` near the top of `index.html` if you want the browser tab to show the client
   name.
4. Save, refresh the browser to check, then commit and push to republish.

The wireframe screens themselves (`screens/*.html`) are the reviewed designs; avoid editing them unless the
design changes.
