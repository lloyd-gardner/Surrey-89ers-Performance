# Surrey 89ers Performance Hub

Staff hub for the performance staff (S&C coach, physio). Static HTML/CSS/JS, no build step, deployed from GitHub to Vercel.

## What is in this repo

| File | What it does |
|---|---|
| `index.html` | Password screen and the Performance Dashboard |
| `hub.js` | The one list of hub sections; relabels mirrored pages and builds their side navigation |
| `vercel.json` | Serves five Coaches Hub pages at this address |
| `manifest.json`, `sw.js` | Home-screen install and offline fallback |

## Shared pages are mirrored, not copied

Season Schedule, Practice Plan, Attendance & Injury, Squad Wellness and Training Load are not in this repo. `vercel.json` rewrites those addresses to the Coaches Hub (`surrey-89ers-coaches-zsex.vercel.app`), so each page exists once, in `lloyd-gardner/Surrey-89ers-Coaches`, and reads the same Google Sheets wherever it is opened. Fix a page there and both hubs change.

Each of those pages loads `/hub.js`. On the Coaches Hub that is an empty placeholder. Here it is the real file, which changes "Coaches Hub" to "Performance Hub" and swaps the side navigation.

## Adding a section

1. Add it to `SECTIONS` in `hub.js`. It then appears on the dashboard and in the side navigation.
2. If it is a Coaches Hub page, add a rewrite to `vercel.json` and add `<script src="/hub.js"></script>` before `</body>` in that page in the coaches repo.
3. If it is a new page, add the file here and load `/hub.js` from it.

## Password

`index.html` holds the same password as the Coaches Hub pages and uses the same session key (`89ers_auth`), so one sign-in covers every page at this address. If the Coaches Hub password changes, change it in `index.html` here too. The password is in the page source, so it keeps out casual visitors only.
