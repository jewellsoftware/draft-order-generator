# Random Draft Order Generator

A static, no-build web page for randomizing a league draft order.

**Live site:** https://jewellsoftware.github.io/draft-order-generator/

A step-by-step wizard, with a progress bar showing where you are:

1. **League:** enter the league name (blank uses a random suggested name) and pick the number of teams from
   common sizes or enter any count from 2–32 in the custom box.
2. **Teams:** name each team (blank uses "Team N"), drag them into order (or use the arrow keys on the drag
   handle), and lock any team to keep it in its spot. Locked teams are left out of the random draw.
3. **Draw:** generate the order. The unlocked teams are shuffled across the unlocked spots using the browser's
   cryptographic random number generator. By default the result is hidden and revealed one pick at a time,
   from the last pick to the first; untick the box to show it all at once. Each result shows when it was
   generated. Once every pick is revealed you can copy it as text or copy a share link.

Entries are remembered in `localStorage`; nothing is sent to a server. A share link carries the whole result
(league name, team names, time) in the part of the URL after `#`, and opening it shows that result read-only.
The link proves nothing about fairness: anyone could edit it to show a different order.

## Run locally

Open `index.html` directly, or serve the folder:

```sh
python -m http.server 8000
```

A share link points at wherever the page is open, so links copied from a local copy only work on your machine.
