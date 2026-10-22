/* Husainin Baug: client presentation behaviour.
   No build step, no network fetches: the screen list is embedded below
   (taken from screens.json, in canvas order). */
(function () {
  "use strict";

  // ---------------------------------------------------------------
  // Screen list (canvas order). id = file name without .html.
  // Codes and titles follow the canvas titles, which differ from the
  // file names for A7/A8/A9.
  // ---------------------------------------------------------------
  var SCREENS = [
    { id: "Login", code: "Login", title: "Sign in", group: "login", w: 1280, h: 820,
      desc: "Sign in with mobile number or user ID, or by OTP on WhatsApp. Accounts are created by Admin." },

    { id: "Main", code: "A1", title: "Admin dashboard", group: "admin", w: 1280, h: 1050,
      desc: "Bookings, collections and pending cancellations at a glance, with occupancy per venue and upcoming Miqaat blocks." },
    { id: "A2_Booking", code: "A2", title: "Booking options", group: "admin", w: 1280, h: 1050,
      desc: "Availability calendar across all halls and rooms, filterable by month, venue and Sector / Mohalla." },
    { id: "A3_Venues", code: "A3", title: "Hall / Room configuration", group: "admin", w: 1280, h: 1200,
      desc: "Capacity and slot rates for each hall and room, maintenance blocks and a yearly bulk upload." },
    { id: "A4_Mohalla", code: "A4", title: "Sector / Mohalla setup", group: "admin", w: 1280, h: 1100,
      desc: "The 13 Sectors / Mohallas with their codes, contacts, users and household counts." },
    { id: "A5_Payments", code: "A5", title: "Payment collection", group: "admin", w: 1280, h: 1150,
      desc: "Razorpay receipts, pending payment links and recorded refunds, by date and Mohalla." },
    { id: "A6_Users", code: "A6", title: "User maintenance", group: "admin", w: 1280, h: 1000,
      desc: "Add, edit and deactivate Admin and Sector / Mohalla users." },
    { id: "A8_Cancellations", code: "A7", title: "Cancellation approval", group: "admin", w: 1280, h: 1150,
      desc: "Review cancellation requests, record the refund and approve or reject." },
    { id: "A9_Miqaat", code: "A8", title: "Miqaat details", group: "admin", w: 1280, h: 950,
      desc: "Miqaat calendar that blocks venues on every Mohalla's calendar, with a yearly upload." },
    { id: "A7_Expenses", code: "A9", title: "Expenses (future)", group: "admin", w: 1280, h: 900,
      desc: "Planned for a later phase: venue expenses and income against expenses per hall." },

    { id: "M1_Dashboard", code: "M1", title: "Dashboard", group: "mohalla", w: 1280, h: 950,
      desc: "The Mohalla's upcoming bookings, pending payments, quick actions and the shared weekly calendar." },
    { id: "M2_Booking", code: "M2", title: "Booking: venue and date", group: "mohalla", w: 1280, h: 1050,
      desc: "Choose booking type and dates, then pick halls and rooms by slot on the availability grid." },
    { id: "M3_BookingReview", code: "M3", title: "Booking: household and review", group: "mohalla", w: 1280, h: 1050,
      desc: "Select the household, add event details and review the total before sending the payment link." },
    { id: "M4_Payment", code: "M4", title: "Payment and WhatsApp", group: "mohalla", w: 1280, h: 1100,
      desc: "The 10-minute hold, payment progress, WhatsApp messages and the receipt." },
    { id: "M5_Bookings", code: "M5", title: "List of bookings", group: "mohalla", w: 1280, h: 1000,
      desc: "All bookings for the Mohalla by status, with receipts, resend link and cancellation request." },
    { id: "M6_Households", code: "M6", title: "Households", group: "mohalla", w: 1280, h: 1200,
      desc: "Add a household or upload a spreadsheet, with row-by-row validation before import." },
    { id: "M7_Cancel", code: "M7", title: "Cancellation flow", group: "mohalla", w: 1280, h: 900,
      desc: "Request a cancellation with a reason, and what happens if Admin approves or rejects." },
    { id: "M8_WhatsApp_Mobile", code: "M8", title: "WhatsApp messages on mobile", group: "mohalla", w: 390, h: 844, phone: true,
      desc: "What the household sees on their phone: the hold message, payment button and PDF receipt." }
  ];

  var GROUPS = [
    { id: "login", name: "Login", who: "Shared by both roles" },
    { id: "admin", name: "Admin", who: "Husainin Baug Admin" },
    { id: "mohalla", name: "Sector / Mohalla user", who: "BURHANI MOHALLA (POONA)" }
  ];

  var BASE = "screens/";
  var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function $(sel, root) { return (root || document).querySelector(sel); }
  function $all(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function el(tag, attrs, children) {
    var n = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      if (k === "text") n.textContent = attrs[k];
      else if (k === "class") n.className = attrs[k];
      else n.setAttribute(k, attrs[k]);
    });
    (children || []).forEach(function (c) { if (c) n.appendChild(c); });
    return n;
  }
  function indexOfId(id) {
    for (var i = 0; i < SCREENS.length; i++) if (SCREENS[i].id === id) return i;
    return -1;
  }
  function fullTitle(s) { return s.code === "Login" ? "Login" : s.code + " " + s.title; }
  function groupName(id) { for (var i = 0; i < GROUPS.length; i++) if (GROUPS[i].id === id) return GROUPS[i].name; return ""; }

  // ---------------------------------------------------------------
  // Hero: availability-grid illustration
  // ---------------------------------------------------------------
  function buildHeroGrid() {
    var grid = $("#heroGrid");
    if (!grid) return;
    var days = [["Fri", "01"], ["Sat", "02"], ["Sun", "03"], ["Mon", "04"], ["Tue", "05"], ["Wed", "06"], ["Thu", "07"]];
    // b = booked, h = on hold, x = Miqaat, "" = available. Halls: [morning, evening]; rooms: [day]
    var venues = [
      { name: "Muffadal Hall", s: [["b","b"],["",""],["","b"],["",""],["",""],["",""],["","h"]] },
      { name: "Vajihi Hall",   s: [["",""],["b","b"],["","h"],["",""],["b",""],["",""],["",""]] },
      { name: "Hall 3",        s: [["",""],["","b"],["",""],["",""],["x","x"],["x","x"],["",""]] },
      { name: "Hall 4",        s: [["",""],["",""],["","h"],["b",""],["",""],["","b"],["b",""]] },
      { name: "Room 1", room: true, s: [["b"],["b"],[""],[""],["h"],[""],[""]] },
      { name: "Room 2", room: true, s: [[""],[""],["b"],[""],[""],["b"],[""]] }
    ];
    var map = { b: "c--booked", h: "c--hold", x: "c--miqaat" };
    grid.appendChild(el("span"));
    days.forEach(function (d) {
      var cell = el("span", { class: "avail__day" });
      cell.appendChild(document.createTextNode(d[0]));
      cell.appendChild(el("b", { text: d[1] }));
      grid.appendChild(cell);
    });
    var order = 0;
    venues.forEach(function (v) {
      grid.appendChild(el("span", { class: "avail__venue", text: v.name }));
      v.s.forEach(function (slots) {
        var cell = el("span", { class: "avail__cell" + (v.room ? " avail__cell--room" : "") });
        slots.forEach(function (st) {
          var c = el("i", { class: "c" + (st ? " " + map[st] : "") });
          if (st) { c.setAttribute("data-state", st); c.style.transitionDelay = (120 + order * 70) + "ms"; order++; }
          cell.appendChild(c);
        });
        grid.appendChild(cell);
      });
    });
    if (!reduceMotion) {
      grid.classList.add("is-pending");
      void grid.offsetWidth; // commit the pending state before releasing it
      setTimeout(function () { grid.classList.remove("is-pending"); }, 250);
    }
  }

  // ---------------------------------------------------------------
  // Roles lists
  // ---------------------------------------------------------------
  function buildRoleLists() {
    $all("[data-role-list]").forEach(function (ul) {
      var g = ul.getAttribute("data-role-list");
      SCREENS.forEach(function (s, i) {
        if (s.group !== g && s.group !== "login") return;
        var btn = el("button", { type: "button", class: "role__link", "data-open": String(i) }, [
          el("span", { class: "role__code", text: s.code === "Login" ? "—" : s.code }),
          el("span", { class: "role__name", text: s.title }),
          s.id === "A7_Expenses" ? el("span", { class: "role__note", text: "Future phase" }) : null
        ]);
        ul.appendChild(el("li", null, [btn]));
      });
    });
  }

  // ---------------------------------------------------------------
  // Gallery
  // ---------------------------------------------------------------
  function buildGallery() {
    var root = $("#galleryGroups");
    if (!root) return;
    GROUPS.forEach(function (g) {
      var items = [];
      SCREENS.forEach(function (s, i) { if (s.group === g.id) items.push(i); });
      var headId = "group-" + g.id;
      var section = el("section", { class: "group", "aria-labelledby": headId });
      section.appendChild(el("div", { class: "group__head" }, [
        el("h3", { id: headId, text: g.name }),
        el("span", { class: "group__who", text: g.who }),
        el("span", { class: "group__count", text: items.length + (items.length === 1 ? " screen" : " screens") })
      ]));
      var list = el("ul", { class: "cards" });
      items.forEach(function (i) {
        var s = SCREENS[i];
        var iframe = el("iframe", {
          src: BASE + s.id + ".html", loading: "lazy", tabindex: "-1", "aria-hidden": "true",
          title: "Preview of " + fullTitle(s), scrolling: "no"
        });
        if (s.phone) { iframe.style.width = s.w + "px"; iframe.style.height = s.h + "px"; }
        var thumb = el("span", { class: "thumb" + (s.phone ? " thumb--phone" : "") }, [iframe]);
        var btn = el("button", { type: "button", class: "card", "data-open": String(i), "aria-label": "View " + fullTitle(s) }, [
          thumb,
          el("span", { class: "card__meta" }, [
            el("span", { class: "card__code", text: s.code === "Login" ? "" : s.code }),
            el("span", { class: "card__name", text: s.code === "Login" ? "Login" : s.title })
          ]),
          el("span", { class: "card__desc", text: s.desc })
        ]);
        if (s.code === "Login") btn.querySelector(".card__code").remove();
        list.appendChild(el("li", null, [btn]));
      });
      section.appendChild(list);
      root.appendChild(section);
    });
    sizeThumbs();
    if ("ResizeObserver" in window) {
      var ro = new ResizeObserver(function (entries) { entries.forEach(function (e) { sizeThumb(e.target); }); });
      $all(".thumb").forEach(function (t) { ro.observe(t); });
    } else {
      window.addEventListener("resize", sizeThumbs);
    }
  }
  function sizeThumb(t) {
    var f = t.querySelector("iframe");
    var w = t.clientWidth, h = t.clientHeight;
    if (!w || !h) return;
    if (t.classList.contains("thumb--phone")) {
      var sp = (h - 28) / 844;
      t.style.setProperty("--s", sp.toFixed(4));
    } else {
      var s = w / 1280;
      t.style.setProperty("--s", s.toFixed(4));
      f.style.height = Math.ceil(h / s) + "px";
    }
  }
  function sizeThumbs() { $all(".thumb").forEach(sizeThumb); }

  // ---------------------------------------------------------------
  // Viewer
  // ---------------------------------------------------------------
  var viewer = $("#viewer");
  var stage = $("#viewerStage");
  var frame = $("#viewerFrame");
  var iframe = $("#viewerIframe");
  var titleEl = $("#viewerTitle");
  var countEl = $("#viewerCount");
  var groupEl = $("#viewerGroup");
  var newTab = $("#viewerNewTab");
  var prevBtn = $("#viewerPrev");
  var nextBtn = $("#viewerNext");
  var closeBtn = $("#viewerClose");
  var current = -1;
  var fitMode = "fit";
  var lastFocus = null;
  var outside = $all("body > header, body > nav, body > main, body > footer, .skip");

  function isOpen() { return !viewer.hidden; }

  function setHash(id) {
    var url = id ? "#screen=" + encodeURIComponent(id) : location.pathname + location.search;
    try { history.replaceState(null, "", url); }
    catch (e) { if (id) location.hash = "screen=" + id; }
  }

  function layout() {
    if (current < 0) return;
    var s = SCREENS[current];
    var W = stage.clientWidth, H = stage.clientHeight;
    var scale;
    if (s.phone) {
      frame.classList.add("is-phone");
      stage.classList.remove("is-actual");
      scale = fitMode === "actual" ? 1 : Math.min(1, (H - 56) / s.h, (W - 48) / s.w);
      if (scale <= 0) scale = 0.5;
      frame.style.width = Math.round(s.w * scale) + "px";
      frame.style.height = Math.round(s.h * scale) + "px";
      iframe.style.width = s.w + "px";
      iframe.style.height = s.h + "px";
      if (fitMode === "actual" && (s.h + 56 > H)) stage.classList.add("is-actual");
    } else {
      frame.classList.remove("is-phone");
      scale = fitMode === "actual" ? 1 : Math.min(1, W / s.w);
      stage.classList.toggle("is-actual", fitMode === "actual" && W < s.w);
      frame.style.width = Math.round(s.w * scale) + "px";
      frame.style.height = H + "px";
      iframe.style.width = s.w + "px";
      iframe.style.height = Math.ceil(H / scale) + "px";
    }
    iframe.style.transform = scale === 1 ? "none" : "scale(" + scale + ")";
  }

  function updateChrome() {
    var s = SCREENS[current];
    titleEl.textContent = fullTitle(s);
    countEl.textContent = (current + 1) + " / " + SCREENS.length;
    countEl.setAttribute("aria-label", "Screen " + (current + 1) + " of " + SCREENS.length);
    groupEl.textContent = groupName(s.group);
    newTab.href = BASE + s.id + ".html";
    iframe.title = fullTitle(s) + " (interactive wireframe)";
    prevBtn.disabled = current === 0;
    nextBtn.disabled = current === SCREENS.length - 1;
    setHash(s.id);
  }

  function show(i) {
    if (i < 0 || i >= SCREENS.length) return;
    current = i;
    updateChrome();
    iframe.src = BASE + SCREENS[i].id + ".html";
    layout();
  }

  function open(i, opener) {
    if (!isOpen()) {
      lastFocus = opener || document.activeElement;
      viewer.hidden = false;
      document.body.classList.add("is-locked");
      outside.forEach(function (n) { n.setAttribute("inert", ""); n.setAttribute("aria-hidden", "true"); });
      if (!reduceMotion) {
        viewer.classList.remove("is-opening"); void viewer.offsetWidth; viewer.classList.add("is-opening");
      }
    }
    show(i);
    closeBtn.focus();
  }

  function close() {
    if (!isOpen()) return;
    viewer.hidden = true;
    iframe.src = "about:blank";
    current = -1;
    document.body.classList.remove("is-locked");
    outside.forEach(function (n) { n.removeAttribute("inert"); n.removeAttribute("aria-hidden"); });
    setHash(null);
    if (lastFocus && document.contains(lastFocus)) lastFocus.focus();
  }

  function step(d) { if (isOpen()) show(Math.max(0, Math.min(SCREENS.length - 1, current + d))); }

  // When a link inside a screen navigates the iframe, keep counter/title/hash in sync.
  // Reading the iframe location works on http(s); on file:// some browsers block it,
  // in which case the chrome simply keeps the last selected screen.
  iframe.addEventListener("load", function () {
    if (!isOpen()) return;
    try {
      var doc = iframe.contentDocument;
      var path = iframe.contentWindow.location.pathname || "";
      var file = decodeURIComponent(path.split("/").pop() || "").replace(/\.html?$/i, "");
      var idx = indexOfId(file);
      if (idx > -1 && idx !== current) { current = idx; updateChrome(); layout(); }
      if (doc) {
        doc.addEventListener("keydown", function (e) {
          if (e.key === "Escape") { close(); return; }
          var t = e.target;
          if (t && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return;
          if (t && t.isContentEditable) return;
          if (e.key === "ArrowLeft") { e.preventDefault(); step(-1); }
          if (e.key === "ArrowRight") { e.preventDefault(); step(1); }
        });
      }
    } catch (err) { /* cross-origin (file://): ignore */ }
  });

  function focusables() {
    return $all("button:not([disabled]), a[href], iframe, [tabindex]:not([tabindex='-1'])", viewer)
      .filter(function (n) { return n.offsetParent !== null || n === iframe; });
  }

  document.addEventListener("keydown", function (e) {
    if (!isOpen()) return;
    if (e.key === "Escape") { e.preventDefault(); close(); return; }
    if (e.key === "ArrowLeft" && !e.altKey) { e.preventDefault(); step(-1); return; }
    if (e.key === "ArrowRight" && !e.altKey) { e.preventDefault(); step(1); return; }
    if (e.key === "Tab") {
      var f = focusables();
      if (!f.length) return;
      var first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      else if (!viewer.contains(document.activeElement)) { e.preventDefault(); first.focus(); }
    }
  });

  prevBtn.addEventListener("click", function () { step(-1); });
  nextBtn.addEventListener("click", function () { step(1); });
  closeBtn.addEventListener("click", close);
  $all("[data-fit]", viewer).forEach(function (b) {
    b.addEventListener("click", function () {
      fitMode = b.getAttribute("data-fit");
      $all("[data-fit]", viewer).forEach(function (o) { o.setAttribute("aria-pressed", String(o === b)); });
      stage.scrollTo(0, 0);
      layout();
    });
  });
  window.addEventListener("resize", function () { if (isOpen()) layout(); });

  // Openers anywhere on the page
  document.addEventListener("click", function (e) {
    var t = e.target.closest ? e.target.closest("[data-open], [data-open-id]") : null;
    if (!t || viewer.contains(t)) return;
    var i = t.hasAttribute("data-open-id") ? indexOfId(t.getAttribute("data-open-id")) : parseInt(t.getAttribute("data-open"), 10);
    if (i > -1) { e.preventDefault(); open(i, t); }
  });

  // Deep links: #screen=M2_Booking (also accepts a code such as #screen=M2)
  function fromHash() {
    var m = /(?:^#|&)screen=([^&]+)/.exec(location.hash);
    if (!m) { if (isOpen()) close(); return; }
    var key = decodeURIComponent(m[1]);
    var i = indexOfId(key);
    if (i < 0) for (var k = 0; k < SCREENS.length; k++) if (SCREENS[k].code.toLowerCase() === key.toLowerCase()) { i = k; break; }
    if (i < 0) return;
    if (!isOpen()) open(i); else if (i !== current) show(i);
  }
  window.addEventListener("hashchange", fromHash);

  // ---------------------------------------------------------------
  // Section nav highlighting
  // ---------------------------------------------------------------
  function trackSections() {
    if (!("IntersectionObserver" in window)) return;
    var links = $all(".toc a");
    var map = {};
    links.forEach(function (a) { map[a.getAttribute("href").slice(1)] = a; });
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        links.forEach(function (a) { a.removeAttribute("aria-current"); });
        var a = map[en.target.id];
        if (a) a.setAttribute("aria-current", "true");
      });
    }, { rootMargin: "-45% 0px -50% 0px" });
    Object.keys(map).forEach(function (id) { var s = document.getElementById(id); if (s) io.observe(s); });
  }

  buildHeroGrid();
  buildRoleLists();
  buildGallery();
  trackSections();
  fromHash();
})();
