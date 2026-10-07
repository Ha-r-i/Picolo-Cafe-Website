# Archived implementation

These files preserve the actual pre-upgrade application, including the user's uncommitted Home.js, Home.css and Menu.css changes. They are **migration reference material**, excluded from linting, type checking and the active application entry point. The nested `Picolo-Cafe-Website` checkout was left untouched.

Original Firebase deployment selection and rules live under `firebase/`. They must not be deployed for the Supabase application. Retain them for review and rollback preparation. Prior to changing files, an exact source/config/package snapshot and binary Git diff were also saved to the ignored `.local-backup/` directory.

The active application is `src/app/main.tsx`. Assets stay under `src/Assets` and optimized derivatives under `public/images`. No archived Firebase, Cloudinary or EmailJS code is included in the Vite module graph.
