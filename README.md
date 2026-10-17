# Random Draft Order Generator

A static, no-build web page for randomizing a league draft order.

A step-by-step wizard:

1. Enter the league name (blank uses a random suggested name) and pick the number of teams from common sizes
   or enter any count from 2–32 in the custom box.
2. _(in progress)_

Entries are remembered in `localStorage`; nothing is sent to a server.

## Run locally

Open `index.html` directly, or serve the folder:

```sh
python -m http.server 8000
```

## Deploy to GitHub Pages

In the repo on GitHub: **Settings → Pages → Build and deployment → Source: Deploy from a branch**, branch
`main`, folder `/ (root)`. The site will be at `https://jewellsoftware.github.io/draft-order-generator/`.
