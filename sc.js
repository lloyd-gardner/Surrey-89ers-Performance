/* ============================================================
   Surrey 89ers Performance Hub — shared code for the hub's own pages
   (Dashboard, S&C Overview, Sessions, Exercise Library).
   ------------------------------------------------------------
   Reads:  the Strength Program sheet (tabs EXERCISES, SESSIONS,
           SESSION EXERCISES); ROSTER, WELLNESS LOG, LOAD LOG and
           STRENGTH LOG on the Player Portals sheet; and the physio's
           published three-column status feed. All as live CSV, by tab
           name and header name.
   Writes: the Player Portal Endpoint (Apps Script), request types
           starting "sc_" — see Strength.gs in that script project.

   Both sheets are shared "anyone with the link", and this file is
   public, so treat everything read here as readable by anyone who
   has the address.
   ============================================================ */
(function () {
  /* Not signed in: go to the dashboard's password screen, then come back. */
  var file = location.pathname.split("/").pop() || "index.html";
  var authed = false;
  try { authed = sessionStorage.getItem("89ers_auth") === "1"; } catch (e) {}
  if (!authed && file !== "index.html") { location.replace("index.html?next=" + encodeURIComponent(file + location.search)); return; }

  var STRENGTH_SHEET_ID = "1oeX8mJsqdCFB2u-DXjBnpRb7SLiYyml2x133sn3vXqg";
  var ROSTER_SHEET_ID   = "1NqYAMc7L_yzaiTlms6SpjvhhoJqg19n5XYtj7IGcJqg";
  var ENDPOINT = "https://script.google.com/macros/s/AKfycbx-xVqT4EUY_ygD-AvzmfXE4EMcya1qlrsFtnKY7WzMaDTj-w9dwrH2Pbuvjbd6Mu0cKA/exec";

  /* Column order of each tab. Columns are matched by header name; this
     order is only the fallback if Google blanks a header. Keep it in
     step with Strength.gs and add new columns at the end. */
  var COLS = {
    "EXERCISES": ["exercise_id","name","type","tags","measure","sets","amount","each_side",
                  "load_type","load","rest_s","video_url","cues","archived","updated_at"],
    "SESSIONS": ["session_id","name","date","start_time","location","phase","status",
                 "assign_mode","players","est_min","series_id","archived","updated_at"],
    "SESSION EXERCISES": ["session_id","order","block","code","exercise_id","exercise","measure",
                          "sets","amount","each_side","load_type","load","rest_s","video_url","cues"]
  };

  /* A full CSV reader: quoted cells may hold commas, quotes and line breaks. */
  function parseCSV(text) {
    var rows = [], row = [], cur = "", q = false, i = 0, c;
    text = String(text || "").replace(/\r\n?/g, "\n");
    for (; i < text.length; i++) {
      c = text[i];
      if (q) {
        if (c === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; }
        else cur += c;
      } else if (c === '"') q = true;
      else if (c === ",") { row.push(cur); cur = ""; }
      else if (c === "\n") { row.push(cur); rows.push(row); row = []; cur = ""; }
      else cur += c;
    }
    if (cur !== "" || row.length) { row.push(cur); rows.push(row); }
    return rows;
  }

  function tabURL(sheetId, tab) {
    return "https://docs.google.com/spreadsheets/d/" + sheetId +
      "/gviz/tq?tqx=out:csv&headers=0&sheet=" + encodeURIComponent(tab) + "&cachebust=" + Date.now();
  }

  /* Reads one of the S&C tabs. Returns { setUp, rows }.
     Google answers a request for a tab that does not exist with the
     sheet's FIRST tab, so a tab only counts as set up when its own id
     column heads the data. */
  async function readTab(tab) {
    var cols = COLS[tab];
    var res = await fetch(tabURL(STRENGTH_SHEET_ID, tab));
    if (!res.ok) throw new Error("Could not read " + tab + " (" + res.status + ")");
    var raw = parseCSV(await res.text());
    var h = -1;
    for (var i = 0; i < raw.length && i < 5; i++) {
      if (raw[i].some(function (c) { return c.trim().toLowerCase() === cols[0]; })) { h = i; break; }
    }
    if (h < 0) return { setUp: false, rows: [] };
    var head = raw[h].map(function (c) { return c.trim().toLowerCase(); });
    var at = {};
    cols.forEach(function (k, n) { var f = head.indexOf(k); at[k] = f >= 0 ? f : n; });
    var rows = raw.slice(h + 1).map(function (r) {
      var o = {};
      cols.forEach(function (k) { o[k] = (r[at[k]] === undefined ? "" : String(r[at[k]])).trim(); });
      return o;
    }).filter(function (o) { return o[cols[0]]; });
    return { setUp: true, rows: rows };
  }

  async function post(type, payload) {
    var body = Object.assign({ type: type }, payload || {});
    var res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(body)
    });
    var out = await res.json();
    if (!out.ok) throw new Error(out.error || "unknown error");
    return out;
  }

  /* Has the S&C part of the endpoint been deployed yet? Before it is,
     the endpoint does not know "sc_" requests and answers with an error. */
  async function saveIsLive() {
    try { var out = await post("sc_ping"); return out.sc === true; }
    catch (e) { return false; }
  }

  /* Active players from ROSTER, same reading rules as the Coaches Hub pages. */
  async function loadRoster() {
    var res = await fetch(tabURL(ROSTER_SHEET_ID, "ROSTER"));
    if (!res.ok) throw new Error("Could not read ROSTER (" + res.status + ")");
    var rows = parseCSV(await res.text()).map(function (r) { return r.map(function (c) { return c.trim(); }); })
      .filter(function (r) { return r.some(function (c) { return c !== ""; }); });
    if (!rows.length) return [];
    var DEF = ["slug", "name", "number", "position", "tab", "active"];
    var head = rows[0].map(function (h) { return h.toLowerCase().replace(/[^a-z]/g, ""); });
    var hasHeader = head.indexOf("slug") >= 0, col = {};
    DEF.forEach(function (k, i) { var f = hasHeader ? head.indexOf(k) : -1; col[k] = f >= 0 ? f : i; });
    return (hasHeader ? rows.slice(1) : rows).map(function (r) {
      var pos = r[col.position] || "";
      return {
        slug: (r[col.slug] || "").toLowerCase().trim(),
        name: r[col.name] || "",
        num: r[col.number] || "",
        pos: pos,
        group: /guard/i.test(pos) ? "G" : /forward|wing/i.test(pos) ? "F" : /big|cent/i.test(pos) ? "B" : "",
        active: String(r[col.active] || "TRUE").toUpperCase() !== "FALSE"
      };
    }).filter(function (p) { return p.slug && p.slug !== "slug" && p.active; });
  }

  /* ---------- player status data (dashboard) ----------
     The same sources and the same rules as the Coaches Hub pages, so a
     player shows the same status in both hubs. */

  var PHOTO_BASE = "https://surrey-89ers-players.vercel.app/photos/";
  /* The physio's sheet: ONLY the published "Dashboard Feed" tab
     (player, injury_status, game_status) is read, never the working tabs. */
  var PHYSIO_STATUS_CSV = "https://docs.google.com/spreadsheets/d/e/2PACX-1vTgZ2Qfo4z1nhk_7IbG2OMRwtAwWPjqZlTMMsNNvQ6z108QAIlCQVKyHaBE5Z9nVeOf7HKy7W-CT1fm/pub?gid=56246200&single=true&output=csv";
  var PHYSIO_SHEET_EDIT = "https://docs.google.com/spreadsheets/d/1-F38wiGnGwZzVoK9vKDQQiax3yu_UJ-1MTfZvYjGrw0/edit";

  function todayISO() { return isoDate(new Date()); }
  function addDaysISO(iso, n) { var d = parseDate(iso); d.setDate(d.getDate() + n); return isoDate(d); }
  function mean(xs) { return xs.length ? xs.reduce(function (a, b) { return a + b; }, 0) / xs.length : null; }
  function nameKey(s) { return String(s || "").toLowerCase().replace(/[^a-z0-9]/g, ""); }
  function initials(name) { return String(name || "").split(" ").slice(0, 2).map(function (w) { return w[0] || ""; }).join("").toUpperCase(); }

  /* Reads a log tab on the Player Portals sheet into objects keyed by
     column name. Header names first; the known order is the fallback
     for headers Google has blanked. */
  async function readLog(tab, cols) {
    var res = await fetch(tabURL(ROSTER_SHEET_ID, tab));
    if (!res.ok) throw new Error("Could not read " + tab + " (" + res.status + ")");
    var rows = parseCSV(await res.text()).filter(function (r) { return r.some(function (c) { return c.trim() !== ""; }); });
    if (rows.length < 2) return [];
    var head = rows[0].map(function (h) { return h.toLowerCase().replace(/[^a-z_]/g, ""); });
    /* A wrong or missing tab comes back as the sheet's first tab; its
       rows are dropped below because they carry no yyyy-mm-dd date. */
    var at = {};
    cols.forEach(function (k, n) { var f = head.indexOf(k); at[k] = f >= 0 ? f : n; });
    return rows.slice(1).map(function (r) {
      var o = {};
      cols.forEach(function (k) { o[k] = (r[at[k]] === undefined ? "" : String(r[at[k]])).trim(); });
      o.slug = (o.slug || "").toLowerCase();
      return o;
    }).filter(function (o) {
      o.date = o.date.slice(0, 10);
      return o.slug && o.slug !== "slug" && /^\d{4}-\d{2}-\d{2}$/.test(o.date);
    });
  }

  /* --- physio availability: severity 0 fine, 1 watch, 2 doubtful, 3 out, -1 not set --- */
  var INJURY_SEV = { "healthy": 0, "questionable": 1, "day to day": 1, "day-to-day": 1, "doubtful": 2, "out": 3 };
  var GAME_SEV = { "available": 0, "probable": 1, "questionable": 1, "doubtful": 2, "out": 3 };
  function sevOf(map, v) { var k = String(v || "").trim().toLowerCase(); if (!k) return -1; return k in map ? map[k] : 1; }

  /* -> { byName: { namekey: {injury, game, si, sg} }, ok } */
  async function loadPhysio() {
    var res = await fetch(PHYSIO_STATUS_CSV + "&cachebust=" + Date.now());
    if (!res.ok) throw new Error("physio feed " + res.status);
    var rows = parseCSV(await res.text());
    var norm = function (h) { return String(h || "").toLowerCase().replace(/[^a-z]/g, ""); };
    var hi = -1;
    for (var i = 0; i < rows.length; i++) { if (rows[i].some(function (c) { return norm(c) === "player"; })) { hi = i; break; } }
    if (hi < 0) throw new Error("physio feed has no player column");
    var head = rows[hi].map(norm), iP = head.indexOf("player"), iI = head.indexOf("injurystatus"), iG = head.indexOf("gamestatus");
    var byName = {};
    rows.slice(hi + 1).forEach(function (r) {
      var name = (r[iP] || "").trim(); if (!name) return;
      var injury = iI >= 0 ? (r[iI] || "").trim() : "", game = iG >= 0 ? (r[iG] || "").trim() : "";
      byName[nameKey(name)] = { name: name, injury: injury, game: game, si: sevOf(INJURY_SEV, injury), sg: sevOf(GAME_SEV, game) };
    });
    return byName;
  }

  /* --- wellness: same thresholds as the Squad Wellness page --- */
  var WELLNESS_COLS = ["timestamp", "date", "slug", "name", "sleep_quality", "soreness", "mood", "sleep_duration", "stress", "energy", "treatment", "note"];
  var METRICS = [["sleep_quality", "sleep quality"], ["soreness", "soreness"], ["mood", "mood"], ["sleep_duration", "sleep duration"], ["stress", "stress"], ["energy", "energy"]];
  var LOW_HARD = 2.5, LOW_SOFT = 3.5, DROP = 1.0, MIN_HIST = 4, NORM_DAYS = 28;

  /* -> { slug: { checked, avg, flags:[{label, now, norm, level, why}], treatment, note } } for today */
  async function loadWellnessToday() {
    var rows = await readLog("WELLNESS LOG", WELLNESS_COLS);
    var today = todayISO(), from = addDaysISO(today, -NORM_DAYS), by = {};
    rows.forEach(function (r) {
      if (r.date < from || r.date > today) return;
      var e = { date: r.date, treatment: /^(yes|true|y)$/i.test(r.treatment), note: r.note };
      METRICS.forEach(function (m) { var v = parseFloat(r[m[0]]); e[m[0]] = isNaN(v) ? null : v; });
      (by[r.slug] = by[r.slug] || []).push(e);
    });
    var out = {};
    Object.keys(by).forEach(function (slug) {
      var mine = by[slug], todays = mine.filter(function (e) { return e.date === today; });
      if (!todays.length) return;
      var flags = [], nowVals = [];
      METRICS.forEach(function (m) {
        var now = mean(todays.map(function (e) { return e[m[0]]; }).filter(function (v) { return v != null; }));
        if (now == null) return;
        nowVals.push(now);
        var prior = mine.filter(function (e) { return e.date !== today; }).map(function (e) { return e[m[0]]; }).filter(function (v) { return v != null; });
        var norm = mean(prior), level = null, why = "";
        if (now <= LOW_HARD) { level = "bad"; why = "Low score"; }
        else if (norm != null && prior.length >= MIN_HIST && (norm - now) >= DROP) { level = "watch"; why = "Down on their own norm"; }
        else if (now < LOW_SOFT) { level = "watch"; why = "Below par"; }
        if (level) flags.push({ label: m[1], now: now, norm: norm, level: level, why: why });
      });
      flags.sort(function (a, b) { return a.now - b.now; });
      var last = todays[todays.length - 1];
      out[slug] = { checked: true, avg: mean(nowVals), flags: flags,
        treatment: todays.some(function (e) { return e.treatment; }), note: last.note || "" };
    });
    return out;
  }

  /* --- training load: the same EWMA maths as the Training Load page --- */
  var LOAD_COLS = ["timestamp", "date", "time", "session_type", "slug", "name", "duration_min", "rpe", "load_au", "note"];
  var ACUTE_ALPHA = 2 / (7 + 1), CHRONIC_ALPHA = 2 / (28 + 1), BAND_LOW = 0.8, BAND_HIGH = 1.3;

  function acwrStatus(v) {
    if (v == null) return { cls: "gray", label: "No data" };
    if (v > BAND_HIGH) return { cls: v > 1.5 ? "bad" : "watch", label: "High" };
    if (v < BAND_LOW) return { cls: v < 0.5 ? "bad" : "watch", label: "Low" };
    return { cls: "good", label: "Sweet spot" };
  }
  /* -> { slug: { acwr, status, last } } */
  async function loadACWR() {
    var rows = await readLog("LOAD LOG", LOAD_COLS), by = {};
    rows.forEach(function (r) {
      var load = parseFloat(r.load_au);
      if (isNaN(load)) load = (parseFloat(r.duration_min) || 0) * (parseFloat(r.rpe) || 0);
      (by[r.slug] = by[r.slug] || {})[r.date] = ((by[r.slug] || {})[r.date] || 0) + load;
    });
    var out = {}, end = todayISO();
    Object.keys(by).forEach(function (slug) {
      var dates = Object.keys(by[slug]).sort(), acute = null, chronic = null, n = 0;
      for (var d = dates[0]; d <= end && n < 3650; d = addDaysISO(d, 1), n++) {
        var load = by[slug][d] || 0;
        acute = acute === null ? load : load * ACUTE_ALPHA + (1 - ACUTE_ALPHA) * acute;
        chronic = chronic === null ? load : load * CHRONIC_ALPHA + (1 - CHRONIC_ALPHA) * chronic;
      }
      var acwr = chronic > 0 ? acute / chronic : null;
      out[slug] = { acwr: acwr, status: acwrStatus(acwr), last: dates[dates.length - 1] };
    });
    return out;
  }

  /* --- strength log: what players actually lifted ---
     Older rows are one per set, newer rows one per exercise with the
     weights as a comma list. Both are folded into one entry per player,
     date and exercise. */
  var STRENGTH_COLS = ["timestamp", "date", "slug", "name", "mode", "block", "day", "code", "exercise", "sets", "reps", "weights_kg", "rpe", "note"];
  async function loadStrengthLog() {
    var rows = await readLog("STRENGTH LOG", STRENGTH_COLS), by = {};
    rows.forEach(function (r) {
      if (!r.exercise) return;
      var key = r.slug + "|" + r.date + "|" + r.exercise.toLowerCase();
      var e = by[key] = by[key] || { slug: r.slug, date: r.date, exercise: r.exercise, reps: 0, weights: [], rows: 0, setsMax: 0, rpe: null };
      var w = r.weights_kg.split(",").map(function (x) { return parseFloat(x); }).filter(function (x) { return !isNaN(x); });
      if (w.length > 1) e.weights = w; else e.weights = e.weights.concat(w);
      e.reps = parseFloat(r.reps) || e.reps;
      e.rows++; e.setsMax = Math.max(e.setsMax, parseFloat(r.sets) || 0);
      var rpe = parseFloat(r.rpe); if (!isNaN(rpe)) e.rpe = rpe;
    });
    return Object.keys(by).map(function (k) {
      var e = by[k];
      e.sets = Math.max(e.setsMax, e.weights.length);
      e.top = e.weights.length ? Math.max.apply(null, e.weights) : null;
      e.volume = e.weights.reduce(function (a, w) { return a + w * e.reps; }, 0);
      return e;
    });
  }

  function avatar(p, cls) {
    var box = el("div", { class: cls || "av" }, [initials(p.name)]);
    if (p.slug) {
      var img = el("img", { src: PHOTO_BASE + p.slug + ".png", alt: "" });
      img.addEventListener("error", function () { img.remove(); });
      box.appendChild(img);
    }
    return box;
  }

  function isYT(v) { return /^(https?:\/\/)?(www\.|m\.)?(youtube\.com|youtu\.be)\//i.test(v || ""); }
  function ytId(v) {
    var m = String(v || "").match(/(?:youtu\.be\/|[?&]v=|\/shorts\/|\/embed\/|\/live\/)([A-Za-z0-9_-]{6,})/);
    return m ? m[1] : "";
  }
  function ytThumb(v) { var id = ytId(v); return id ? "https://i.ytimg.com/vi/" + id + "/mqdefault.jpg" : ""; }

  /* "3 × 6 each side", "1 × 45 s", from the stored fields */
  function prescription(x) {
    if (!x.sets || !x.amount) return "";
    return x.sets + " × " + x.amount + (x.measure === "time" ? " s" : "") + (isTrue(x.each_side) ? " each side" : "");
  }
  function loadText(x) {
    if (x.load_type === "bw") return "Bodyweight";
    if (!x.load) return "";
    if (x.load_type === "pct") return x.load + "% 1RM";
    if (x.load_type === "kg") return x.load + " kg";
    if (x.load_type === "rpe") return "RPE " + x.load;
    return "";
  }
  function isTrue(v) { return v === true || String(v).toUpperCase() === "TRUE"; }

  /* Same estimate as the S&C coach's design: a rep is about 4 seconds,
     doubled for each-side work, plus rest per set and a minute to set up. */
  function estMinutes(list) {
    var sec = 0;
    list.forEach(function (r) {
      var n = Number(r.sets) || 0, a = Number(r.amount) || 0, rest = Number(r.rest_s) || 0;
      var work = (r.measure === "time" ? a : a * 4) * (isTrue(r.each_side) ? 2 : 1);
      sec += n * (work + rest) + 60;
    });
    return Math.round(sec / 60);
  }

  function el(tag, attrs, kids) {
    var e = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      var v = attrs[k];
      if (v === null || v === undefined || v === false) return;
      if (k === "class") e.className = v;
      else if (k === "text") e.textContent = v;
      else if (k.slice(0, 2) === "on") e.addEventListener(k.slice(2), v);
      else if (k === "value") e.value = v;
      else if (k === "checked" || k === "disabled" || k === "hidden") e[k] = !!v;
      else e.setAttribute(k, v === true ? "" : v);
    });
    [].concat(kids || []).forEach(function (c) {
      if (c === null || c === undefined || c === false) return;
      e.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
    });
    return e;
  }

  function parseDate(s) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || "");
    return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
  }
  function isoDate(d) {
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }
  function prettyDate(s, withYear) {
    var d = parseDate(s);
    if (!d) return "";
    var o = { weekday: "short", day: "numeric", month: "short" };
    if (withYear) o.year = "numeric";
    return d.toLocaleDateString("en-GB", o);
  }

  function logout() {
    try { sessionStorage.removeItem("89ers_auth"); } catch (e) {}
    location.href = "index.html";
  }

  window.SC = {
    TYPES: ["Power", "Strength", "Iso", "Mobility"],
    LOCATIONS: ["Gym · Surrey Sports Park", "Arena C", "Away — hotel / travel"],
    STRENGTH_SHEET_URL: "https://docs.google.com/spreadsheets/d/" + STRENGTH_SHEET_ID + "/edit",
    parseCSV: parseCSV, readTab: readTab, post: post, saveIsLive: saveIsLive, loadRoster: loadRoster,
    isYT: isYT, ytId: ytId, ytThumb: ytThumb, prescription: prescription, loadText: loadText,
    isTrue: isTrue, estMinutes: estMinutes, el: el, parseDate: parseDate, isoDate: isoDate,
    prettyDate: prettyDate, logout: logout,
    todayISO: todayISO, addDaysISO: addDaysISO, mean: mean, nameKey: nameKey, initials: initials,
    loadPhysio: loadPhysio, loadWellnessToday: loadWellnessToday, loadACWR: loadACWR,
    loadStrengthLog: loadStrengthLog, acwrStatus: acwrStatus, avatar: avatar,
    PHYSIO_SHEET_EDIT: PHYSIO_SHEET_EDIT
  };
})();
