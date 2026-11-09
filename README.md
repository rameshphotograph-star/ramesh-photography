# Ramesh Photography — Cloudflare Pages starter

This is the first static website UI package for the QR Photo Delivery Website.

## Files
- `index.html` — guest landing page and event-code entry screen
- `admin.html` — outline of the photographer admin workspace
- `style.css` — responsive styling
- `app.js` — small front-end interaction

## Deploy to Cloudflare Pages using GitHub
1. Extract this ZIP on your computer.
2. Open your GitHub repository: `ramesh-photography`.
3. Choose **Add file → Upload files**.
4. Upload the extracted files (the files themselves, not the ZIP).
5. Commit the changes to the `main` branch.
6. In Cloudflare, open **Workers & Pages → your Pages project** and connect/select this GitHub repository. If the project is already connected, it should deploy after the commit.
7. For a plain HTML site, use no build command and set the output directory to `/` (or leave the build command blank and use the repository root as the output directory).

## Important — not ready for real event delivery yet
This starter is only the website UI. It does **not** yet include secure admin authentication, shared photo uploads/storage, event database, live QR generation, download controls, or selfie/face matching for “My Photos”. Do not use it to promise private or working photo delivery until those features are implemented and tested. The next development step is to connect Cloudflare storage/database and implement the admin and guest gallery flows.
