# My Vocabulary 📚

A simple, beginner-friendly web application for learning and quizzing English vocabulary, powered by Groq AI and offline IndexedDB local storage. Designed and structured for seamless conversion into an Android APK using Capacitor and Android Studio.

---

## 🌟 Features

- **Beginner-Friendly Study**: Enter any English word to get an easy-to-understand definition, a natural example sentence, and a 4-option multiple-choice quiz.
- **Official Groq AI Integration**: Uses Groq's high-speed Chat Completions API (`llama-3.3-70b-versatile`) through a secure, local backend proxy that safeguards your API key.
- **Offline IndexedDB Storage (Source of Truth)**: Saves words, definitions, examples, and multiple-choice quizzes directly on your computer inside browser IndexedDB. Data persists across page refreshes, browser restarts, and computer reboots.
- **Visible Save Status**: Prominent status indicator showing `Saving...`, `Saved locally`, or `Save failed` with timestamp and persistent storage verification.
- **Edit & Delete Words**: Easily edit word spelling, definitions, and examples or delete words with instant IndexedDB sync.
- **Backup & Restore (JSON)**: Export your entire vocabulary into a portable `.json` backup file or import existing backups with duplicate prevention and validation.
- **Legacy Migration**: Automatically detects and migrates words from localStorage into IndexedDB without deleting original data.
- **Duplicate Prevention**: Automatically detects and prevents accidental duplicate entries (case-insensitive).
- **Interactive Quiz View**: Practice any saved word with instant feedback:
  - Clear **A, B, C, D** selectable options.
  - "Correct! 🎉" or "Not quite! 💡" feedback.
  - Complete definition and example sentence revealed upon answering.
  - **Try Again** button to re-attempt questions.
  - Speech pronunciation support using Web Speech API.
- **5-Minute Study Reminders**:
  - Background practice prompts every 5 minutes: `What does HARSH mean?`
  - Rotates through saved words, avoiding repetitive selections.
  - Never spoils the answer in the notification.
  - Clicking a notification immediately opens the quiz for that exact word.
  - Includes a **Test Now** button for instant verification.
- **PWA & Offline App Shell**: Pre-caches assets via Service Worker and Web App Manifest.
- **Capacitor-Ready**: Clean decoupled architecture ready to be wrapped into an Android APK.

---

## 📁 Project Structure

```text
my-vocabulary-web/
├── server/
│   ├── index.js             # Express backend proxy for Groq API
│   └── validator.js         # Strict schema validator for AI responses
├── src/
│   ├── components/
│   │   ├── AddWordForm.tsx            # Word input, loading spinner, and retry banner
│   │   ├── BackupControls.tsx         # JSON Export/Import controls and storage guide
│   │   ├── EditWordModal.tsx          # Modal for editing words and saving to IndexedDB
│   │   ├── Header.tsx                 # Title, online/offline status, key badge
│   │   ├── QuizScreen.tsx             # Prominent quiz view, option cards, feedback
│   │   ├── ReminderControls.tsx       # Start/Stop reminders & "Test Now" button
│   │   ├── StorageStatusIndicator.tsx # Visible Save Status (Saving / Saved locally / Save failed)
│   │   └── WordList.tsx               # Saved words list with practice, edit & delete actions
│   ├── db/
│   │   └── indexedDb.ts           # IndexedDB engine (save, update, delete, backup, migration)
│   ├── services/
│   │   ├── api.ts                 # Frontend service calling the backend proxy
│   │   └── notifications.ts       # Browser & Capacitor reminder manager
│   ├── types.ts                   # TypeScript interfaces for words, quizzes & storage status
│   ├── App.tsx                    # Main application coordinator
│   ├── main.tsx                   # React DOM root entry
│   └── index.css                  # Tailwind CSS styling
├── public/
│   ├── icon.svg                   # App vector icon
│   ├── manifest.webmanifest       # PWA Web App Manifest
│   └── sw.js                      # Service Worker for offline caching & notification clicks
├── tests/
│   ├── backend.test.ts            # Backend error handling tests
│   ├── quiz.test.ts               # Quiz scoring & option integrity tests
│   ├── reminders.test.ts          # Interval & notification formatting tests
│   ├── storage.test.ts            # IndexedDB persistence, backup, update & migration tests
│   └── validator.test.ts          # Strict 4-option schema validation tests
├── .env.example             # Template for environment variables
├── .env                     # Local server environment (git-ignored)
├── package.json
├── vite.config.ts           # Vite config with API proxy
└── README.md
```

---

## 🚀 Getting Started

### 1. Prerequisites
- **Node.js** (v18 or higher recommended; tested on Node v24)
- **npm** (v9 or higher)

### 2. Installation
Open your terminal in `my-vocabulary-web`:
```bash
# On Windows PowerShell:
npm.cmd install

# On macOS / Linux:
npm install
```

### 3. Configure Your Groq API Key
1. Create a free account and generate an API key at [Groq Console](https://console.groq.com/keys).
2. Open the file `.env` in the `my-vocabulary-web` directory.
3. Replace `your_groq_api_key_here` with your real Groq API key:
   ```env
   GROQ_API_KEY=gsk_your_actual_key_here
   GROQ_MODEL=llama-3.3-70b-versatile
   PORT=3001
   ```
> 🔒 **Security Notice**: Your API key is stored only on your local machine in `.env`. It is ignored by Git (`.gitignore`) and is never sent to the browser. The browser only talks to the local proxy at `/api/vocabulary/generate`.

---

## 💻 Running the Application

### Option A: Run Both Frontend and Backend Together (Recommended)
```bash
npm.cmd run dev
```
This runs:
- **Backend API Proxy** on `http://localhost:3001`
- **Vite React Frontend** on `http://localhost:5173` (with automatic `/api` proxying)

Open your browser at: **`http://localhost:5173`**

### Option B: Run Services Separately
In terminal 1 (Backend proxy):
```bash
npm.cmd run server
```

In terminal 2 (Vite dev server):
```bash
npm.cmd run client
```

---

## 🧪 Running Automated Tests

A comprehensive test suite is included using Vitest:
```bash
npm.cmd run test
```
The test suite validates:
- AI response schema validation (exactly 4 distinct options, valid correct index).
- Rejection of duplicate options, malformed arrays, or empty definitions.
- 5-minute reminder calculation (`300,000 ms`).
- Word selection logic (ensuring words aren't repeated back-to-back).
- Notification title & body formatting (ensuring answers are never leaked).
- Quiz scoring logic and offline data availability.

---

## 🏗️ Production Build

To build the static web assets:
```bash
npm.cmd run build
```
This runs `tsc` for TypeScript type-checking and outputs production-optimized files into `dist/`.

To test the production build served directly through the backend Express server:
```bash
npm.cmd run server
```
Then visit `http://localhost:3001`.

---

## 🔔 Testing Browser Notifications & Understanding Limitations

### How to Test Reminders:
1. Click **Start Reminders**. When prompted by your browser, click **Allow**.
2. Click **Test Now** to verify notification delivery immediately without waiting 5 minutes.
3. You will receive a notification:
   - **Title**: `My Vocabulary — Practice Time!`
   - **Body**: `What does HARSH mean?`
4. Click the notification: the app window will focus and immediately open the quiz for that word!

### Browser Limitations vs. Android Native:
- **Desktop & Mobile Browsers**: When browser tabs are closed or backgrounded, browsers throttle or suspend JavaScript timers (`setInterval`) to conserve battery and memory. Therefore, browser timers cannot guarantee exact 5-minute delivery when the tab is closed.
- **Android Native via Capacitor**: Once converted to an Android APK (see below), the app uses Android's native `AlarmManager` and `NotificationManager` via the Capacitor Local Notifications plugin. This allows scheduled notifications to fire on time even when the app is completely closed.

---

## ☁️ Deploying Backend to Render (Free Cloud Hosting)

You can host your secure Groq AI backend proxy on [Render](https://render.com) for free:

### Method 1: Using the Included Blueprint (`render.yaml`)
1. Push your latest code to GitHub (`git push origin main`).
2. Log in to [Render](https://dashboard.render.com).
3. Click **New +** > **Blueprint**.
4. Connect your **`Bothub-Harsh/voco`** repository.
5. Render will automatically detect [`render.yaml`](file:///d:/DEPLOYMENT%20APPLICATION/abc/my-vocabulary-web/render.yaml) and configure:
   - **Service Type**: Web Service
   - **Runtime**: Node
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
   - **Health Check Path**: `/api/health`
6. Under **Environment Variables**, set:
   - `GROQ_API_KEY`: *(paste your real Groq key: `gsk_...`)*
   - `GROQ_MODEL`: `openai/gpt-oss-120b`
7. Click **Apply**. Render will deploy your service and give you a free URL (e.g. `https://my-vocabulary-backend.onrender.com`).

---

### Method 2: Manual Setup on Render Dashboard
If you prefer setting it up manually:
1. In Render dashboard, click **New +** > **Web Service**.
2. Connect your GitHub repository: `Bothub-Harsh/voco`.
3. Set the following fields:
   - **Name**: `my-vocabulary-backend`
   - **Language / Runtime**: `Node`
   - **Branch**: `main`
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
   - **Instance Type**: `Free`
4. Expand **Advanced** > **Health Check Path**: enter `/api/health`.
5. Under **Environment Variables**, add:
   - `GROQ_API_KEY` = `your_groq_api_key_here`
   - `GROQ_MODEL` = `openai/gpt-oss-120b`
   - `NODE_ENV` = `production`
6. Click **Create Web Service**.

---

### Connecting Frontend or Android APK to Render
- **Monolithic Deployment (Built into Render)**: If you visit your Render URL directly in a browser (e.g. `https://my-vocabulary-backend.onrender.com`), both the frontend UI and the backend API work together automatically!
- **Separate Frontend / Android APK**: When building a separate frontend or Android APK, point it to your live Render backend by adding to `.env`:
  ```env
  VITE_API_URL=https://my-vocabulary-backend.onrender.com
  ```

---

## 📱 Converting the Web App to an Android APK (Capacitor & Android Studio)

Follow these steps when you are ready to create the Android APK:

### Step 1: Build the Web App
Make sure your production build is fresh:
```bash
npm.cmd run build
```
Verify that the `dist/` directory contains `index.html` and bundled assets.

### Step 2: Install Capacitor CLI and Core Packages
Inside `my-vocabulary-web`, run:
```bash
npm.cmd install @capacitor/core @capacitor/android
npm.cmd install -D @capacitor/cli
npm.cmd install @capacitor/local-notifications
```

### Step 3: Initialize Capacitor
```bash
npx.cmd cap init "My Vocabulary" com.myvocabulary.app --web-dir dist
```
This generates `capacitor.config.ts` (or `capacitor.config.json`).

### Step 4: Add the Android Platform
```bash
npx.cmd cap add android
```
This creates the native `android/` directory containing the Android Studio Gradle project.

### Step 5: Sync Web Build into Android
Whenever you update your web code, rebuild and sync:
```bash
npm.cmd run build
npx.cmd cap sync
```

### Step 6: Configure Android Permissions for Notifications
Open `android/app/src/main/AndroidManifest.xml` and ensure the following permissions are present inside `<manifest>`:
```xml
<!-- Required for Android 13+ (API level 33+) notifications -->
<uses-permission android:name="android.permission.POST_NOTIFICATIONS"/>

<!-- Required for exact 5-minute reminder scheduling -->
<uses-permission android:name="android.permission.SCHEDULE_EXACT_ALARM"/>
<uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/>
```

### Step 7: Open in Android Studio & Build APK
1. Open the project in Android Studio:
   ```bash
   npx.cmd cap open android
   ```
2. Wait for Gradle sync to complete in Android Studio.
3. Go to **Build** > **Build Bundle(s) / APK(s)** > **Build APK(s)**.
4. Android Studio will generate the debug APK at:
   `android/app/build/outputs/apk/debug/app-debug.apk`
5. Transfer this `.apk` to your phone or run directly on an Android Emulator by clicking the **Run** (Green Play) button in Android Studio.

> 💡 **Groq API on Mobile**: When running on a standalone Android APK, the app connects to your hosted backend proxy (e.g., hosted on Render, Railway, or a home server) by setting the proxy URL in `src/services/api.ts`. All vocabulary quizzes and previously added words continue to work offline with IndexedDB.

---

## 🛡️ License
MIT License — Free to use, adapt, and build upon.

