/* ============================================================
   Surrey 89ers Performance Hub — shared code for the S&C pages
   (Exercise Library, Sessions).
   ------------------------------------------------------------
   Reads:  the Strength Program sheet (tabs EXERCISES, SESSIONS,
           SESSION EXERCISES) and ROSTER on the Player Portals sheet,
           as live CSV, by tab name and header name.
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
  if (!authed) { location.replace("index.html?next=" + encodeURIComponent(file + location.search)); return; }

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
    prettyDate: prettyDate, logout: logout
  };
})();
