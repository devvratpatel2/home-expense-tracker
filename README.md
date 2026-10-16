# 🏠 Home Build Tracker

Track every dollar, receipt, and milestone of your home construction — all in one place.

Built for first-time home builders who want a simple, visual way to manage construction expenses without wrestling with spreadsheets.

---

## Quick Start

```bash
# Install dependencies
npm install

# Start the app
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

That's it. No database server to install, no cloud accounts to set up. Everything runs locally on your machine.

---

## First Time Setup

1. Open the app and click **Register**
2. Enter your name, email, a password (8+ characters), and the invite code (`REGISTRATION_CODE`; not needed when running locally without one)
3. You'll be taken to the dashboard with a default project ("My Home Build") already created
4. 17 common construction categories are pre-loaded for you:
   - Foundation & Excavation, Framing, Roofing, Plumbing, Electrical, HVAC, Insulation, Drywall & Painting, Flooring, Windows & Doors, Kitchen & Cabinets, Bathrooms, Exterior & Landscaping, Permits & Fees, Contractor Labor, Materials, Miscellaneous

---

## Features

### 📊 Dashboard

Your at-a-glance overview of the entire project.

- **Summary cards** — total spent, budget (click to edit), remaining, and how much the owner vs builder paid
- **Budget bar** — turns amber at 90% and red once you're over
- **Cumulative spend vs budget** — running total by month with the budget line, so you can see when you'll cross it
- **Monthly spend by who paid** — stacked Owner / Builder bars
- **Spend by category** — every category sorted by spend, with budget bars once you set category budgets
- **Top vendors** — who you've paid the most, including how much has no vendor recorded
- **Recent expenses** — your last 5 entries

### 💰 Expenses

Where you log every payment, invoice, and receipt.

**Adding an expense:**
1. Click **+ Add Expense**
2. Fill in the details:
   - **Description** — what you paid for (e.g., "2x4 lumber delivery")
   - **Amount** — how much it cost
   - **Date** — when you paid
   - **Category** — pick from the pre-loaded list
   - **Vendor** — who you paid (e.g., "Home Depot", your contractor's name)
   - **Paid by** — Owner or Builder
   - **Payment Method** — cash, check, Zelle, etc.
   - **Notes** — any extra details
   - **Receipt** — upload a photo or PDF of the receipt/invoice
3. Click **Save Expense**

**Tips:**
- You don't need to fill every field — only description and amount are required
- The form remembers the last category, vendor and payer you used
- On a phone the receipt button opens the camera
- Click any row in the table to edit it in place; 🗑️ deletes it, 📎 opens the receipt
- Sort by any column, search, filter by category / payer / date range, and export what you see to CSV

### 🎯 Budget

Set the total project budget and a budget per category, rename or delete categories, and add new ones. Each category shows spent vs budget.

### 🏗️ Progress Tracking

Document your build journey with photos and milestones.

**Construction phases tracked:**
1. Planning & Permits
2. Site Preparation
3. Foundation
4. Framing
5. Roofing
6. Rough Plumbing & Electrical
7. Insulation & Drywall
8. Interior Finishes
9. Exterior Finishes
10. Final Inspections
11. Move-in Ready

**Adding a progress update:**
1. Click **+ Add Update**
2. Enter a title (e.g., "Foundation pour complete")
3. Select the construction phase
4. Set the status: Not Started, In Progress, Completed, or Delayed
5. Add a description and/or upload a photo
6. Click **Save Update**

The phase tracker at the top shows your overall progress — completed phases get a green checkmark, active phases are highlighted in blue.

### 📥 Import from Google Sheets

Already tracking expenses in a spreadsheet? Import them in seconds.

**Step by step:**
1. Open your Google Sheet
2. Go to **File → Download → Comma Separated Values (.csv)**
3. In the app, go to **Import Data**
4. Upload the CSV file
5. Done — your expenses are imported

Categories that don't exist yet are created. Rows already in the app (same date, amount and description) are skipped, so you can re-import the same sheet after adding rows to it.

**Column mapping:**
The importer is flexible and will try to match your columns automatically:

| Your column name | What it maps to |
|---|---|
| description, Description, item, Item, name, Name | Expense description |
| amount, Amount, cost, Cost, total, Total | Amount |
| date, Date | Date |
| category, Category | Category (exact name match, created if missing) |
| vendor, Vendor, supplier, Supplier | Vendor name |
| source, Paid By | Owner / Builder |
| payment method | Payment method |
| notes, Notes | Notes |

If your spreadsheet uses different column names, just rename the header row in the CSV before importing.

---

## Where Is My Data Stored?

Running locally, everything stays on your computer:

| What | Where |
|---|---|
| Database | `data/tracker.db` (SQLite file) |
| Uploaded receipts/photos | `data/uploads/` |

**To back up your data:** just copy the `data/` folder somewhere safe.

On Vercel the database is Turso (`TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`) and receipts go to a private Vercel Blob store (`BLOB_READ_WRITE_TOKEN`). Receipts are only served through `/api/files/...` to the user who uploaded them.

**To start fresh:** delete the `data/tracker.db` file and restart the app.

---

## Project Structure

```
home-expense-tracker/
├── src/
│   ├── app/
│   │   ├── page.tsx                    # Login / Register
│   │   ├── dashboard/
│   │   │   ├── layout.tsx              # Sidebar navigation
│   │   │   ├── page.tsx                # Dashboard with charts
│   │   │   ├── expenses/page.tsx       # Expense table: add, edit, filter, export
│   │   │   ├── budget/page.tsx         # Project and category budgets
│   │   │   ├── progress/page.tsx       # Progress tracking
│   │   │   └── import/page.tsx         # CSV import
│   │   └── api/
│   │       ├── auth/                   # Login, register, logout, session
│   │       ├── expenses/               # CRUD for expenses
│   │       ├── categories/             # Expense categories
│   │       ├── projects/               # Project management
│   │       ├── progress/               # Progress updates
│   │       ├── dashboard/              # Aggregated stats for charts
│   │       ├── upload/                 # Receipt uploads
│   │       ├── files/                  # Serves receipts to their owner
│   │       └── import/                 # CSV import
│   ├── lib/
│   │   ├── db.ts                       # Database setup and migrations
│   │   ├── auth.ts                     # Session user and project ownership checks
│   │   ├── session.ts                  # Auth session config
│   │   ├── constants.ts                # Categories, phases, payment methods
│   │   └── project-context.tsx         # React context for active project
│   └── types/
│       └── sql.js.d.ts                 # TypeScript types for sql.js
├── data/                               # SQLite database (auto-created)
    └── uploads/                        # Receipts when running locally
```

---

## FAQ

**Can I use this on my phone?**
Yes. The app is fully responsive — open it in your phone's browser using your computer's local IP (e.g., `http://192.168.1.x:3000`).

**Can multiple people use this?**
Yes. Each user only sees their own projects. Registration needs the invite code set in `REGISTRATION_CODE`; on a deployed app with no code set, registration is closed.

**Can I add custom categories?**
Yes, on the Budget page. Importing a sheet also creates any categories it uses.

**What if I mess up an expense?**
Click the row in the expense table and edit it.

**Can I set a budget?**
Yes. Click the Budget card on the dashboard, or use the Budget page for the project total and per-category budgets.

**Is my data secure?**
Passwords are hashed with bcrypt and sessions use encrypted cookies. Every API call checks that the project or expense belongs to the logged-in user, and receipts are private.

---

## Tech Stack

- **Next.js 14** — React framework with App Router
- **TypeScript** — type safety
- **Tailwind CSS** — styling
- **libSQL / Turso** — SQLite locally, Turso when deployed
- **Vercel Blob** — private receipt storage when deployed
- **Recharts** — charts and visualizations
- **iron-session** — encrypted cookie sessions
- **bcryptjs** — password hashing
- **csv-parse** — CSV import

---

## Deploying for Others

To make this available to friends/family building their own homes:

1. Deploy to [Vercel](https://vercel.com) (free tier works)
2. Set these environment variables:
   - `SESSION_SECRET` — random 32+ character string
   - `REGISTRATION_CODE` — invite code people need to register
   - `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` — hosted database
   - `BLOB_READ_WRITE_TOKEN` — added automatically when you connect a Blob store under Storage in the Vercel project

---

## License

Personal project. Use it however you like.
