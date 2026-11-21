# Cadence

Offline-first React + TypeScript + Vite PWA for daily task management (with evening planning cutoff), gamified habit streaks (7/30/100-day milestone rewards, Grace Shields, and Pause mode), multi-user shared team boards, integrated calendar reminders, personal expense tracking in Indian Rupees (`₹ INR`) with CSV export, biometric/PIN privacy vault, and Firebase Cloud Firestore sync.

## Local Development

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Deploying to GitHub Pages

1. Push this repository to GitHub (branch `main`).
2. In your GitHub repository, go to **Settings → Pages → Build and deployment** and set **Source** to **GitHub Actions**.
3. Pushing to `main` (or running the **Deploy Cadence to GitHub Pages** workflow manually) automatically type-checks, runs unit tests, builds the PWA with the correct repository base path (`VITE_BASE_PATH`), and publishes to `https://<your-username>.github.io/<repo-name>/`.

## Enabling Real-World Google Sign-In & Cloud Sync

Firebase Auth restricts OAuth popups to authorized domains. After deploying to GitHub Pages (or Vercel/Netlify/custom domain):

1. Open the [Firebase Console](https://console.firebase.google.com/) and select your project.
2. Go to **Authentication → Settings → Authorized domains**.
3. Click **Add domain** and add `<your-username>.github.io` (or your custom domain).
4. Ensure **Google** is enabled under **Authentication → Sign-in method**.
5. Review and deploy `firestore.rules` before sharing broadly.

### Optional: Using Your Own Firebase Project

By default, Cadence reads `firebase-applet-config.json`. You can override any field via environment variables (`.env` locally or GitHub Actions repository variables) using the keys listed in `.env.example`.

## Scripts

- `npm run dev` — Start Vite development server on port 3000
- `npm run build` — Build production PWA bundle into `dist/`
- `npm run lint` — Run TypeScript type checking (`tsc --noEmit`)
- `npx tsx --test src/utils/logic.test.ts firestore.rules.test.ts` — Run unit and Firestore rule invariant tests
