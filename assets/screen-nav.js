/* Husainin Baug wireframes: screen navigation helper.
 * - Placeholder links (href="#..." with no matching element) never jump or scroll.
 * - When a screen is opened directly (not inside the overview's iframes), a small
 *   floating pill shows: Overview, previous / next screen (canvas order) and the title.
 *   It can be minimised; the choice is remembered in this browser only.
 */
(function () {
  "use strict";

  var SCREENS = [
    ["Login", "Login"],
    ["Main", "A1 Admin dashboard"],
    ["A2_Booking", "A2 Booking options"],
    ["A3_Venues", "A3 Hall / Room configuration"],
    ["A4_Mohalla", "A4 Sector / Mohalla setup"],
    ["A5_Payments", "A5 Payment collection"],
    ["A6_Users", "A6 User maintenance"],
    ["A8_Cancellations", "A7 Cancellation approval"],
    ["A9_Miqaat", "A8 Miqaat details"],
    ["A7_Expenses", "A9 Expenses (future)"],
    ["M1_Dashboard", "M1 Dashboard"],
    ["M2_Booking", "M2 Booking: venue and date"],
    ["M3_BookingReview", "M3 Booking: household and review"],
    ["M4_Payment", "M4 Payment and WhatsApp"],
    ["M5_Bookings", "M5 List of bookings"],
    ["M6_Households", "M6 Households"],
    ["M7_Cancel", "M7 Cancellation flow"],
    ["M8_WhatsApp_Mobile", "M8 WhatsApp messages on mobile"]
  ];
  var STORE_KEY = "hb-screen-nav-collapsed";

  // 1. Dead hash links: stop them from jumping to the top / changing the URL.
  document.addEventListener("click", function (e) {
    var a = e.target && e.target.closest ? e.target.closest("a[href^='#']") : null;
    if (!a) return;
    var id = a.getAttribute("href").slice(1);
    if (id && document.getElementById(id)) return; // real in-page anchor: allow
    e.preventDefault();
  });

  // 2. Floating pill, only when viewed directly.
  var inFrame;
  try { inFrame = window.self !== window.top; } catch (err) { inFrame = true; }
  if (inFrame) return;

  var file = decodeURIComponent(location.pathname.split("/").pop() || "").replace(/\.html?$/i, "");
  var idx = -1;
  for (var i = 0; i < SCREENS.length; i++) if (SCREENS[i][0] === file) idx = i;

  function el(tag, attrs, text) {
    var n = document.createElement(tag);
    for (var k in attrs) n.setAttribute(k, attrs[k]);
    if (text != null) n.textContent = text;
    return n;
  }

  function build() {
    if (document.getElementById("hb-screen-nav")) return;
    var nav = el("nav", { id: "hb-screen-nav", "aria-label": "Wireframe navigation" });
    var prev = idx > 0 ? SCREENS[idx - 1] : null;
    var next = idx >= 0 && idx < SCREENS.length - 1 ? SCREENS[idx + 1] : null;
    var title = idx >= 0 ? SCREENS[idx][1] : document.title;

    var body = el("div", { "class": "hb-sn-body" });
    body.appendChild(el("a", { href: "../index.html", "class": "hb-sn-link", title: "Back to the overview" }, "← Overview"));
    body.appendChild(el("span", { "class": "hb-sn-sep", "aria-hidden": "true" }));
    body.appendChild(prev
      ? el("a", { href: prev[0] + ".html", "class": "hb-sn-btn", title: "Previous: " + prev[1], "aria-label": "Previous screen: " + prev[1] }, "‹")
      : el("span", { "class": "hb-sn-btn is-off", "aria-hidden": "true" }, "‹"));
    var t = el("span", { "class": "hb-sn-title", title: title }, title);
    if (idx >= 0) t.appendChild(el("span", { "class": "hb-sn-count" }, " " + (idx + 1) + "/" + SCREENS.length));
    body.appendChild(t);
    body.appendChild(next
      ? el("a", { href: next[0] + ".html", "class": "hb-sn-btn", title: "Next: " + next[1], "aria-label": "Next screen: " + next[1] }, "›")
      : el("span", { "class": "hb-sn-btn is-off", "aria-hidden": "true" }, "›"));
    nav.appendChild(body);

    var toggle = el("button", { type: "button", "class": "hb-sn-toggle" });
    nav.appendChild(toggle);

    function setCollapsed(c, save) {
      nav.classList.toggle("is-collapsed", c);
      toggle.textContent = c ? "☰" : "×";
      toggle.setAttribute("aria-label", c ? "Show screen navigation" : "Hide screen navigation");
      toggle.title = c ? "Show screen navigation" : "Hide";
      toggle.setAttribute("aria-expanded", String(!c));
      if (save) { try { localStorage.setItem(STORE_KEY, c ? "1" : "0"); } catch (e) {} }
    }
    var startCollapsed = false;
    try { startCollapsed = localStorage.getItem(STORE_KEY) === "1"; } catch (e) {}
    setCollapsed(startCollapsed, false);
    toggle.addEventListener("click", function () {
      setCollapsed(!nav.classList.contains("is-collapsed"), true);
    });

    // Keyboard: Alt+Left / Alt+Right is browser back/forward, so use [ and ] instead.
    document.addEventListener("keydown", function (e) {
      var tg = e.target && e.target.tagName;
      if (e.ctrlKey || e.metaKey || e.altKey || tg === "INPUT" || tg === "TEXTAREA" || tg === "SELECT" || (e.target && e.target.isContentEditable)) return;
      if (e.key === "[" && prev) location.href = prev[0] + ".html";
      else if (e.key === "]" && next) location.href = next[0] + ".html";
    });

    document.body.appendChild(nav);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", build);
  else build();
})();
