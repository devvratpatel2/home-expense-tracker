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
2. Enter your name, email, and a password
3. You'll be taken to the dashboard with a default project ("My Home Build") already created
4. 17 common construction categories are pre-loaded for you:
   - Foundation & Excavation, Framing, Roofing, Plumbing, Electrical, HVAC, Insulation, Drywall & Painting, Flooring, Windows & Doors, Kitchen & Cabinets, Bathrooms, Exterior & Landscaping, Permits & Fees, Contractor Labor, Materials, Miscellaneous

---

## Features

### 📊 Dashboard

Your at-a-glance overview of the entire project.

- **Summary cards** — total spent, budget, remaining balance, number of transactions
- **Budget progress bar** — turns yellow at 70% and red at 90% so you know when to slow down
- **Pie chart** — see which categories are eating your budget (spoiler: it's usually plumbing and electrical)
- **Bar chart** — monthly spending trends to spot if costs are accelerating
- **Recent expenses** — quick view of your last 5 entries

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
   - **Payment Method** — cash, check, credit card, etc.
   - **Notes** — any extra details
   - **Receipt** — upload a photo or PDF of the receipt/invoice
3. Click **Save Expense**

**Tips:**
- You don't need to fill every field — only description and amount are required
- Take a photo of every receipt with your phone and upload it here. You'll thank yourself at tax time
- The 📎 icon next to an expense means it has a receipt attached
- Hover over an expense and click 🗑️ to delete it

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

**Column mapping:**
The importer is flexible and will try to match your columns automatically:

| Your column name | What it maps to |
|---|---|
| description, Description, item, Item, name, Name | Expense description |
| amount, Amount, cost, Cost, total, Total | Amount |
| date, Date | Date |
| category, Category | Category (matched against existing categories) |
| vendor, Vendor, supplier, Supplier | Vendor name |
| notes, Notes | Notes |

If your spreadsheet uses different column names, just rename the header row in the CSV before importing.

---

## Where Is My Data Stored?

Everything stays on your computer:

| What | Where |
|---|---|
| Database | `data/tracker.db` (SQLite file) |
| Uploaded receipts/photos | `public/uploads/` |

**To back up your data:** just copy the `data/` and `public/uploads/` folders somewhere safe.

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
│   │   │   ├── expenses/page.tsx       # Expense entry & listing
│   │   │   ├── progress/page.tsx       # Progress tracking
│   │   │   └── import/page.tsx         # CSV import
│   │   └── api/
│   │       ├── auth/                   # Login, register, logout, session
│   │       ├── expenses/               # CRUD for expenses
│   │       ├── categories/             # Expense categories
│   │       ├── projects/               # Project management
│   │       ├── progress/               # Progress updates
│   │       ├── dashboard/              # Aggregated stats for charts
│   │       ├── upload/                 # File uploads
│   │       └── import/                 # CSV import
│   ├── lib/
│   │   ├── db.ts                       # SQLite database setup
│   │   ├── session.ts                  # Auth session config
│   │   ├── constants.ts                # Categories, phases, payment methods
│   │   └── project-context.tsx         # React context for active project
│   └── types/
│       └── sql.js.d.ts                 # TypeScript types for sql.js
├── data/                               # SQLite database (auto-created)
└── public/uploads/                     # Uploaded receipts & photos
```

---

## FAQ

**Can I use this on my phone?**
Yes. The app is fully responsive — open it in your phone's browser using your computer's local IP (e.g., `http://192.168.1.x:3000`).

**Can multiple people use this?**
The app supports multiple user accounts. Anyone on your network can register and create their own projects. For internet access, you'd need to deploy it to a hosting service.

**Can I add custom categories?**
Yes — use the Categories API at `/api/categories` with a POST request, or you can extend the UI to add a category management page.

**What if I mess up an expense?**
Hover over it in the expense list and click the 🗑️ icon to delete it, then re-enter it correctly.

**Can I set a budget?**
The budget field is on the project. Currently you can set it via the Projects API. The dashboard will show your budget progress automatically once it's set.

**Is my data secure?**
Passwords are hashed with bcrypt. Sessions use encrypted cookies. Since everything runs locally, your data never leaves your machine.

---

## Tech Stack

- **Next.js 14** — React framework with App Router
- **TypeScript** — type safety
- **Tailwind CSS** — styling
- **sql.js** — SQLite in JavaScript (no native dependencies)
- **Recharts** — charts and visualizations
- **iron-session** — encrypted cookie sessions
- **bcryptjs** — password hashing
- **csv-parse** — CSV import

---

## Deploying for Others

To make this available to friends/family building their own homes:

1. Deploy to [Vercel](https://vercel.com) (free tier works) or any Node.js host
2. Switch from SQLite to a hosted database (PostgreSQL, PlanetScale, etc.) for multi-user production use
3. Set the `SESSION_SECRET` environment variable to a random 32+ character string
4. Set up cloud storage (S3, Cloudflare R2) for receipt uploads instead of local filesystem

---

## License

Personal project. Use it however you like.
