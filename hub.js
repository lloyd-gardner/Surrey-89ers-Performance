/* ============================================================
   Surrey 89ers Performance Hub — shared hub script
   ------------------------------------------------------------
   The Schedule, Practice Plan, Attendance & Injury, Squad Wellness
   and Training Load pages are NOT copied into this repo. vercel.json
   serves the Coaches Hub's own files at this address, so there is one
   copy of each page and one set of Google Sheets behind them.

   Each of those pages loads /hub.js. On the Coaches Hub that file is
   an empty placeholder. Here it is this file, which:
     1. holds the one list of Performance Hub sections (SECTIONS), used
        by the side navigation on every page;
     2. relabels a mirrored page so it reads "Performance Hub" and its
        back link and side navigation stay inside this hub.

   To add a section: add it to SECTIONS. If it is a Coaches Hub page,
   also add a rewrite for it in vercel.json. An entry with ext: true and
   a full address opens in a new tab instead.

   Clinic Notes (performance.html) and the Treatment Log (treatment.html)
   live in this repo only (moved from the Coaches Hub 24 Oct 2026). They
   use Microsoft sign-in, not the hub password, and do not load this file.
   ============================================================ */
(function () {
  var COACHES_HUB = "https://surrey-89ers-coaches-zsex.vercel.app/";

  var SECTIONS = [
    { group: "Strength & Conditioning", href: "sc-overview.html", icon: "🏋", label: "S&C Overview",     sub: "Today, participation and progression" },
    { group: "Strength & Conditioning", href: "sc-sessions.html", icon: "🗓", label: "Sessions",         sub: "Build, assign and publish sessions" },
    { group: "Strength & Conditioning", href: "sc-library.html",  icon: "🎬", label: "Exercise Library", sub: "Exercises with demo videos and cues" },
    { group: "Therapy",  href: "therapy.html",       icon: "🩺", label: "Therapy",             sub: "The physio's area" },
    { group: "Therapy",  href: "performance.html",   icon: "🗒", label: "Clinic Notes",        sub: "SOAP notes in SharePoint (Microsoft sign-in)" },
    { group: "Therapy",  href: "treatment.html",     icon: "🩹", label: "Treatment Log",       sub: "Treatment list and injury records (Microsoft sign-in)" },
    { group: "Squad",    href: "wellness.html",      icon: "📈", label: "Squad Wellness",      sub: "Daily check-ins and flags" },
    { group: "Squad",    href: "load.html",          icon: "📊", label: "Training Load",       sub: "Session RPE and ACWR" },
    { group: "Squad",    href: "attendance.html",    icon: "📝", label: "Attendance & Injury", sub: "Season attendance grid and physio status" },
    { group: "Schedule", href: "schedule.html",      icon: "📅", label: "Season Schedule",     sub: "Practices, games, S&C, treatment and travel" },
    { group: "Schedule", href: "practice-plan.html", icon: "📋", label: "Practice Plan",       sub: "Practice plans and drills" }
  ];


  var here = location.pathname.split("/").pop() || "index.html";

  function swapText(el) {
    if (el && el.textContent.indexOf("Coaches Hub") !== -1) {
      el.textContent = el.textContent.replace("Coaches Hub", "Performance Hub");
    }
  }

  function navItem(href, icon, label, active, ext) {
    var d = document.createElement("div");
    d.className = "nav-item" + (active ? " active" : "");
    var i = document.createElement("span");
    i.className = "nav-icon";
    i.textContent = icon;
    d.appendChild(i);
    d.appendChild(document.createTextNode(" " + label + (ext ? " ↗" : "")));
    d.addEventListener("click", function () {
      if (ext) window.open(href, "_blank", "noopener"); else location.href = href;
    });
    return d;
  }

  function groupLabel(text) {
    var d = document.createElement("div");
    d.className = "nav-group-label";
    d.textContent = text;
    return d;
  }

  function buildNav(nav) {
    nav.textContent = "";
    nav.appendChild(navItem("index.html", "⌂", "Dashboard", here === "index.html"));
    var group = "";
    SECTIONS.forEach(function (s) {
      if (s.group !== group) { group = s.group; nav.appendChild(groupLabel(group)); }
      nav.appendChild(navItem(s.href, s.icon, s.label, here === s.href, s.ext));
    });
    nav.appendChild(groupLabel("More"));
    nav.appendChild(navItem(COACHES_HUB, "↗", "Coaches Hub", false));
  }

  function apply() {
    // Hub name on the login screen, the top bar and the browser tab.
    Array.prototype.forEach.call(document.querySelectorAll(".login-sub, .topbar-sub"), swapText);
    if (document.title.indexOf("Coaches Hub") !== -1) {
      document.title = document.title.replace("Coaches Hub", "Performance Hub");
    }
    // "← Coaches Hub" back links already point at index.html, which here is
    // the Performance Hub dashboard. Only the wording needs changing.
    Array.prototype.forEach.call(document.querySelectorAll('a[href="index.html"]'), swapText);
    // Pages with the coaches side navigation get the Performance Hub one.
    Array.prototype.forEach.call(document.querySelectorAll(".sidenav"), buildNav);
  }

  window.PERF_HUB = { sections: SECTIONS, coachesHub: COACHES_HUB, buildNav: buildNav };

  /* The dashboard builds its menu itself, after sign-in. */
  if (here !== "index.html") apply();
})();
