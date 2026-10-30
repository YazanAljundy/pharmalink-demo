# PharmaLink Demo

Local demo setup for the backend, web dashboards, and pharmacy app. The seeded
accounts and catalog are fictional; Firebase and image-upload credentials are
not required.

## Prerequisites

- Node.js 22 LTS (Node 18+ for the backend), npm, and Git
- MongoDB Community with `mongod` available, or a MongoDB Atlas replica-set
  cluster
- Flutter with Dart 3.9 or newer; Android Studio/emulator for Android. Xcode is
  additionally required to build for iOS.

Run the commands below in PowerShell from a fresh clone. On macOS/Linux, use
`npm` instead of `npm.cmd` and the platform's equivalent file-copy command.

## Start the backend

For a local MongoDB Community installation, open a separate terminal at the
repository root and start the included single-node replica set:

```powershell
node backend/scripts/start-dev-replset.js
```

In another terminal:

```powershell
Set-Location backend
Copy-Item .env.example .env
```

Edit `backend/.env`: replace `JWT_SECRET` with a fresh random value of at least
32 characters, and keep the default `MONGODB_URI` for the local replica set.
For example, generate a secret with:

```powershell
node -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))"
```

Alternatively, use a MongoDB Atlas cluster with replica-set support. Set
`MONGODB_URI` to its connection string and use `pharmalink_demo` as the
database name. Keep the URI and secret private; do not commit `.env`.

Then install, seed, and start the API:

```powershell
npm.cmd install
npm.cmd run seed-demo
npm.cmd run dev
```

The API listens on port `5000`. `npm.cmd run seed-demo` can be rerun safely.
To remove and recreate only the demo database, run `npm.cmd run reset-demo`
from `backend`; the script refuses to drop a database whose name is not exactly
`pharmalink_demo`.

## Start the web dashboards

In a new terminal:

```powershell
Set-Location web
Copy-Item .env.example .env.local
npm.cmd install
npm.cmd run dev
```

Open the local URL printed by Vite (normally `http://localhost:5173`). The
dashboard runs fully offline with bundled fake data by default; its demo role
chooser opens either panel without API or Socket.IO calls. In the warehouse
header, **Simulate incoming order** emits a local order-created event for the
live queue and unread-badge presentation. The Demo badge can be hidden with
`VITE_SHOW_DEMO_BADGE=false`.

To connect the dashboard to the real backend, set
`VITE_DEMO_MOCK_API=false` in `web/.env.local` and restart Vite. The API and
Socket.IO URLs then use the local defaults in `.env.example`.

## Start the pharmacy app

The app starts in fully offline mock mode by default; no backend, Firebase
configuration, or internet connection is needed:

```powershell
Set-Location pharmalink_demo
flutter pub get
flutter run
```

To use the real backend instead, disable mock mode and set the API URL. For an
Android emulator, use `http://10.0.2.2:5000/api`; for a physical device,
connect it and the development computer to the same LAN, replace
`192.168.1.10` below with the computer's LAN IPv4 address, and allow port
`5000` through the computer's firewall if prompted:

```powershell
flutter run --dart-define=DEMO_MOCK_API=false --dart-define=API_BASE_URL=http://192.168.1.10:5000/api
```

`DEMO_AUTO_LOGIN` defaults to `true` and signs the app in as the seeded pharmacy.
Disable it with `--dart-define=DEMO_AUTO_LOGIN=false` to restore login/register.
Change the demo account with `--dart-define=DEMO_PHONE=...` and `--dart-define=DEMO_PASSWORD=...`.
The default pharmacy credentials are `0900000004` and `Demo@12345`.

`DEMO_MOCK_API` defaults to `true` and serves bundled fake data. Use
`flutter run --dart-define=DEMO_MOCK_API=false` to connect to the real backend;
set `API_BASE_URL` as shown above for the emulator or physical device.

Login uses phone and password; SMS/OTP delivery is not required. If enabled,
`SMS_PROVIDER=console` writes OTP codes to the backend console. Firebase push
and Cloudinary uploads are optional for this demo.

## Demo credentials

All seeded accounts use the password `Demo@12345`.

| Role | Phone | Account |
|---|---|---|
| Admin | `0900000001` | Demo Administrator |
| Warehouse | `0900000002` | Demo Warehouse One |
| Warehouse | `0900000003` | Demo Warehouse Two |
| Pharmacy | `0900000004` | Demo Pharmacy One |
| Pharmacy | `0900000005` | Demo Pharmacy Two |
| Pharmacy | `0900000006` | Demo Pharmacy Three |

## Six-step presentation flow

1. Sign in as admin; show the dashboard, accounts, bilingual catalog, offers,
   exchange rate, complaints, and ledger.
2. Sign in as a pharmacy; select a warehouse, browse products, add items to
   the cart, and submit an order.
3. Sign in as that warehouse; show the incoming order and change its status.
   Review the seeded returns and handle a return.
4. Return to the pharmacy app; track the order, request a return, and show
   debts, account history, and notifications.
5. In the warehouse panel, record and reverse a demo payment, then show the
   settlement/commission report.
6. Finish in the admin panel with the ledger statement, offers/banners, and
   complaint queue.
