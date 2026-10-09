# Surrey 89ers Performance Hub

Staff hub for the performance staff (S&C coach, physio). Static HTML/CSS/JS, no build step, deployed from GitHub to Vercel.

## What is in this repo

| File | What it does |
|---|---|
| `index.html` | Password screen and the Performance Dashboard: combined player status, then links to S&C and Therapy |
| `sc-overview.html` | S&C landing page: today, this week's sessions, needs attention, exercise progression, participation |
| `therapy.html` | Placeholder. Clinic notes are being built on the club's SharePoint |
| `hub.js` | The one list of hub sections; relabels mirrored pages and builds their side navigation |
| `vercel.json` | Serves five Coaches Hub pages at this address |
| `manifest.json`, `sw.js` | Home-screen install and offline fallback |
| `sc-library.html` | S&C exercise library: name, type, default prescription, demo video link, cues |
| `sc-sessions.html` | S&C sessions: list, build from the library, assign players, repeat weekly, publish |
| `sc.js`, `sc.css` | Shared code and styles for the hub's own pages (sheet reading, saving, sign-in check) |

## Shared pages are mirrored, not copied

Season Schedule, Practice Plan, Attendance & Injury, Squad Wellness and Training Load are not in this repo. `vercel.json` rewrites those addresses to the Coaches Hub (`surrey-89ers-coaches-zsex.vercel.app`), so each page exists once, in `lloyd-gardner/Surrey-89ers-Coaches`, and reads the same Google Sheets wherever it is opened. Fix a page there and both hubs change.

Each of those pages loads `/hub.js`. On the Coaches Hub that is an empty placeholder. Here it is the real file, which changes "Coaches Hub" to "Performance Hub" and swaps the side navigation.

## Adding a section

1. Add it to `SECTIONS` in `hub.js`. It then appears on the dashboard and in the side navigation.
2. If it is a Coaches Hub page, add a rewrite to `vercel.json` and add `<script src="/hub.js"></script>` before `</body>` in that page in the coaches repo.
3. If it is a new page, add the file here and load `/hub.js` from it.

## Password

`index.html` holds the same password as the Coaches Hub pages and uses the same session key (`89ers_auth`), so one sign-in covers every page at this address. If the Coaches Hub password changes, change it in `index.html` here too. The password is in the page source, so it keeps out casual visitors only.

## Strength & Conditioning pages

Built from the S&C coach's "S&C workflow" design. They read and write three tabs on the Strength Program sheet: `EXERCISES`, `SESSIONS` and `SESSION EXERCISES`. Reads are live CSV by tab and header name. Saves go to the Player Portal Endpoint (Apps Script) as request types starting `sc_`, handled by `Strength.gs` in that script project. Nothing is deleted; removing an exercise or session marks it `archived`.

A session row keeps its own sets, reps, load and rest. Its video and cues are stored only when they differ from the library, so a change in the library reaches every session that uses the exercise.

These pages have no password screen of their own. If nobody is signed in they send the visitor to `index.html?next=<page>`.

Not built yet: the planner calendar, per-player changes, notifications, and the player-side screens. Player portals still read the old `STRENGTH PROGRAM` and `ASSIGNMENT` tabs.

## Dashboard player status

One row per active player on ROSTER, worst first. It reads the same sources and applies the same rules as the Coaches Hub pages: the physio's published three-column feed (injury and game status), today's rows in `WELLNESS LOG` (thresholds 2.5 and 3.5, a full point below a player's own 28-day norm, treatment requests, notes), `LOAD LOG` (the same 7-day and 28-day EWMA for ACWR, sweet spot 0.8 to 1.3), and today's published S&C sessions. Each source loads on its own, so one being unreachable does not blank the others. The code is in `sc.js`; if a threshold changes on a Coaches Hub page, change it there too.
