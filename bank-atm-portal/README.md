# SecureBank ATM System

A production-grade ATM simulation built with Node.js, Express, and MongoDB.
Demonstrates five core **Object-Oriented Software Engineering (OOSE)** design patterns.

## What's New (Optimization + Production Readiness)

- Responsive layout modes based on aspect ratio (square ATM, portrait mobile, landscape desktop)
- Startup language picker (English, Tamil, Hindi)
- Theme switching (dark/light) with preference persistence
- PWA support via `manifest.json` + `sw.js`
- Admin enhancements: delete customer, ATM out-of-order/online control, cash refill, transaction log feed
- Maintenance module: diagnostics, status updates, error logs, enable/disable services
- MongoDB Atlas-ready environment template and tuned connection pool settings

---

## Quick Start

### Prerequisites
- Node.js v18+
- MongoDB (local install or free Atlas cluster)

### 1. Install Dependencies

```bash
cd bank-atm-portal
npm install
```

### 2. Configure the Environment

Edit the `.env` file in the project root:

```env
# Required — MongoDB connection string (Atlas or local)
MONGODB_URI=mongodb+srv://<user>:<pass>@<cluster>.mongodb.net/atm_system_db?retryWrites=true&w=majority
MONGODB_DB_NAME=atm_system_db

# Required — replace with a long random secret
JWT_SECRET=your_very_long_random_secret_here

# Admin portal credentials
ADMIN_USERNAME=admin
ADMIN_PASSWORD=SecureAdminPass123!

# Maintenance portal credentials
MAINTENANCE_USERNAME=technician
MAINTENANCE_PASSWORD=SecureTechPass123!
```

To generate a strong JWT secret:
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

### 3. Run the Server

```bash
# Production
npm start

# Development (auto-restart on file changes)
npm run dev
```

### 4. Open the ATM Terminal

Navigate to: **http://localhost:3000**

---

## Using the ATM

### New Customer
1. Click **"New Customer? Register Here"**
2. Fill in your name, email, choose a PIN (4–6 digits), and account type
3. **Copy and save your 16-digit card number** — you cannot recover it without the admin panel

### Existing Customer
1. Enter your 16-digit card number
2. Click **"Insert Card"**
3. Enter your PIN using the keypad
4. Use the menu: Balance, Withdraw, Deposit, Transfer, Mini Statement, Check Deposit, Change PIN

### Security Notes
- **3 wrong PINs** → card is locked. An admin must unlock it.
- **Session timeout**: 2 minutes of inactivity → automatic logout.
- All PINs are hashed with bcryptjs (never stored in plain text).

### Admin Portal
1. Click **"Admin Portal"** on the welcome screen
2. Sign in with credentials from your `.env` file
3. Access: All Cards, Audit Logs, Security Alerts, System Health

---

## API Reference

### Public Endpoints
| Method | Endpoint | Body |
|--------|----------|------|
| POST | `/api/auth/register` | `{ email, pin, holderName?, accountType? }` |
| POST | `/api/auth/login` | `{ cardNumber, pin }` |

### Protected Endpoints (require `Authorization: Bearer <token>`)
| Method | Endpoint | Body |
|--------|----------|------|
| GET | `/api/account/balance` | — |
| GET | `/api/account/statement` | — |
| POST | `/api/account/change-pin` | `{ currentPin, newPin }` |
| POST | `/api/transactions/withdraw` | `{ amount }` |
| POST | `/api/transactions/deposit` | `{ amount }` |
| POST | `/api/transactions/transfer` | `{ amount, targetCardNumber }` |
| POST | `/api/transactions/check-deposit` | `{ amount, description? }` |

### Admin Endpoints (require Admin JWT)
| Method | Endpoint |
|--------|----------|
| POST | `/api/admin/login` |
| GET | `/api/admin/cards` |
| GET | `/api/admin/audit-logs` |
| GET | `/api/admin/security-alerts` |
| GET | `/api/admin/transactions` |
| GET | `/api/admin/health` |
| PUT | `/api/admin/cards/:cardNumber/lock` |
| PUT | `/api/admin/cards/:cardNumber/unlock` |
| DELETE | `/api/admin/cards/:cardNumber` |
| POST | `/api/admin/atm/out-of-order` |
| POST | `/api/admin/atm/online` |
| POST | `/api/admin/atm/refill` |

### Maintenance Endpoints (require Technician JWT)
| Method | Endpoint |
|--------|----------|
| POST | `/api/maintenance/login` |
| GET | `/api/maintenance/diagnostics` |
| GET | `/api/maintenance/error-logs` |
| POST | `/api/maintenance/status` |
| POST | `/api/maintenance/service-toggle` |

---

## Project Structure

```
bank-atm-portal/
├── webapp/
│   ├── main.html           # ATM terminal UI (entry point)
│   ├── terminal.js         # Frontend controller logic
│   └── main-style.css      # Dark banking UI theme
├── backend/
│   ├── index.js            # Express server + route definitions
│   ├── database.js         # Singleton MongoDB connection
│   ├── authentication.js   # JWT middleware + error handler
│   ├── business-logic.js   # Factory, Observer, Controllers
│   └── schemas/
│       ├── Card.js         # Card model + CardDAO
│       ├── Transaction.js  # Transaction model + TransactionDAO
│       └── AuditLog.js     # AuditLog model + AuditLogDAO
├── .env                    # Environment secrets (never commit)
├── package.json
├── README.md
└── DOCUMENTATION.md        # OOSE design pattern analysis
```

---

## Transaction Limits

| Type | Limit |
|------|-------|
| Single Withdrawal | $10,000 |
| Single Deposit | $50,000 |
| Single Transfer | $25,000 |
| Check Deposit | $100,000 |

---

## License

MIT — built for educational purposes.
