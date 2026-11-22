# Cadence

Offline-first React + TypeScript + Vite PWA for daily task management (with evening planning cutoff), gamified habit streaks (7/30/100-day milestone rewards, Grace Shields, and Pause mode), multi-user shared team boards, integrated calendar reminders, personal expense tracking in Indian Rupees (`₹ INR`) with CSV export, biometric/PIN privacy vault, and Firebase Cloud Firestore sync.

## Deploying to GitHub Pages (Important!)

Because Cadence is a React + TypeScript + Vite app, opening raw `index.html` from your repository files will **not** run the app. GitHub must build `dist/` using GitHub Actions:

1. Push this repository to GitHub (`main` or `master` branch).
2. In your GitHub repo, open **Settings → Pages → Build and deployment**.
3. Under **Source**, select **GitHub Actions** (do **not** choose "Deploy from a branch").
4. Open the **Actions** tab and wait for **Deploy Cadence to GitHub Pages** to show a green checkmark.
5. Open the published URL shown in the deploy job (for example, `https://<your-username>.github.io/<repo-name>/`).

## Opening & Installing on Your Phone

Once you have your live HTTPS URL (from GitHub Pages or AI Studio Share):

- **Android (Chrome)**:
  1. Open your live URL in Chrome.
  2. Tap **Install PWA** inside Cadence (or tap the Chrome **⋮** menu → **Add to Home screen / Install app**).
  3. Launch **Cadence** directly from your home screen like a native app.
- **iPhone / iPad (Safari)**:
  1. Open your live URL in **Safari** (not an in-app browser).
  2. Tap the **Share** button (square with up arrow).
  3. Tap **Add to Home Screen** → **Add**.
  4. Launch **Cadence** from your home screen.

## Enabling Real-World Google Sign-In & Cloud Sync

Firebase Auth restricts OAuth popups to authorized domains. After publishing:

1. Open the [Firebase Console](https://console.firebase.google.com/) and select your project.
2. Go to **Authentication → Settings → Authorized domains**.
3. Click **Add domain** and add `<your-username>.github.io` (or your custom domain).
4. Ensure **Google** is enabled under **Authentication → Sign-in method**.
5. Review and harden `firestore.rules` before sharing broadly.

## Local Development

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.
