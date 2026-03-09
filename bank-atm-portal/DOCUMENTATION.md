# DOCUMENTATION.md — OOSE Design Pattern Analysis

## SecureBank ATM System: Object-Oriented Software Engineering Analysis

---

## 1. System Architecture Overview

This ATM system follows the **MVC (Model-View-Controller)** architectural pattern across both tiers:

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENT (Browser)                         │
│  View: main.html + main-style.css (HTML/CSS screens)           │
│  Controller: terminal.js (ATMTerminal, ViewManager, APIClient) │
└─────────────────────────────┬───────────────────────────────────┘
                              │ HTTP/JSON (REST API)
┌─────────────────────────────▼───────────────────────────────────┐
│                       SERVER (Node.js)                          │
│  Controller: business-logic.js (exported controller functions) │
│  Model: schemas/Card.js, Transaction.js, AuditLog.js (DAO)     │
│  View: JSON responses (consumed by client controller)          │
└─────────────────────────────┬───────────────────────────────────┘
                              │ Mongoose ODM
┌─────────────────────────────▼───────────────────────────────────┐
│                       MongoDB Database                          │
│  Collections: cards, transactions, auditlogs                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. OOSE Design Patterns

### 2.1 Singleton Pattern

**Files:** `backend/database.js`, `backend/business-logic.js` (ATMMachine class)

**Intent:** Ensure a class has only one instance and provide a global point of access to it.

**Implementation:**

```
Database Singleton:
  - Private static _instance property stores the single connection.
  - Constructor checks for existing instance and returns it.
  - connect() is idempotent — repeated calls return the cached connection.
  - Object.freeze() prevents accidental property reassignment.

ATMMachine Singleton:
  - Tracks physical ATM state: cashAvailable, sessionTransactionCount.
  - One instance reflects the reality of a single physical terminal.
  - Initialised once at module load time; frozen after construction.
```

**OOSE Justification:**
- A database connection pool is a shared, expensive resource. Multiple instances would exhaust connection limits.
- The ATMMachine state (cash reserves) must be consistent across all requests. Multiple instances would cause race conditions.

**UML:**
```
+------------------+
|    Database      |
+------------------+
| -_instance: self |
| -_connection     |
+------------------+
| +getInstance()   |
| +connect()       |
| +getConnection() |
+------------------+
      ▲
      | (returns same instance every call)
```

---

### 2.2 Factory Pattern

**File:** `backend/business-logic.js` (TransactionFactory, AccountFactory)

**Intent:** Define an interface for creating an object, but let subclasses (or a factory method) decide which class to instantiate.

**Implementation:**

```
TransactionFactory.create(type, params):
  'WITHDRAWAL'    → new WithdrawalTransaction(params)
  'DEPOSIT'       → new DepositTransaction(params)
  'TRANSFER'      → new TransferTransaction(params)
  'CHECK_DEPOSIT' → new CheckDepositTransaction(params)

AccountFactory.create(cardData):
  'SAVINGS'  → new SavingsAccount(cardData)
  'CHECKING' → new CheckingAccount(cardData)
  'PREMIUM'  → new PremiumAccount(cardData)
```

Each transaction class **encapsulates its own validation rules** via a `validate()` method. Controllers never call `new WithdrawalTransaction()` directly — they use the factory.

**OOSE Justification:**
- **Open/Closed Principle:** Adding `BILL_PAYMENT` requires only a new class + one switch-case entry. No existing controller code changes.
- **Single Responsibility:** Each transaction type owns its business rules, not the controller.
- **Polymorphism:** All transaction types share the `validate()` interface, enabling uniform treatment.

**UML:**
```
TransactionFactory
+create(type, params): Transaction
        |
        ├── WithdrawalTransaction.validate(balance)
        ├── DepositTransaction.validate()
        ├── TransferTransaction.validate(balance)
        └── CheckDepositTransaction.validate()
```

---

### 2.3 Observer Pattern

**File:** `backend/business-logic.js` (TransactionSubject, AuditLogObserver, NotificationObserver)

**Intent:** Define a one-to-many dependency between objects so that when one object changes state, all dependents are notified and updated automatically.

**Implementation:**

```
Subject: TransactionSubject
  - Maintains a list of IObserver subscribers.
  - subscribe(observer): adds an observer.
  - notify(event, data): calls observer.update() on all subscribers.

Concrete Observers:
  AuditLogObserver.update(event, data)
    → Calls AuditLogDAO.create() to persist the event to MongoDB.

  NotificationObserver.update(event, data)
    → Logs a formatted console notification (simulates SMS/email).
```

**Event flow:**
```
Controller calls subject.notify('WITHDRAWAL', { cardNumber, amount })
      │
      ├──► AuditLogObserver.update() → MongoDB (audit trail)
      └──► NotificationObserver.update() → console.log (SMS simulation)
```

**OOSE Justification:**
- **Loose Coupling:** Controllers fire events without knowing how they are handled. Adding a new observer (e.g., EmailObserver) requires zero changes to controllers.
- **Open/Closed:** New event handlers can be subscribed without modifying the subject.
- The pattern also satisfies the **Dependency Inversion Principle** — high-level controllers depend on the IObserver abstraction, not on concrete logging implementations.

**UML:**
```
IObserver (interface)
+update(event, data)
     ▲                  ▲
     |                  |
AuditLogObserver   NotificationObserver
+update()          +update()

TransactionSubject
-_observers: IObserver[]
+subscribe(observer)
+notify(event, data)
```

---

### 2.4 DAO (Data Access Object) Pattern

**Files:** `backend/schemas/Card.js`, `Transaction.js`, `AuditLog.js`

**Intent:** Provide an abstract interface to the database, separating persistence logic from business logic.

**Implementation:**

Each schema file exports both:
1. A Mongoose **Model** (the schema definition).
2. A **DAO class** with static methods that wrap all database operations.

```
CardDAO.create(data)
CardDAO.findByCardNumber(cardNumber)
CardDAO.findByEmail(email)
CardDAO.update(cardNumber, updates)
CardDAO.findAll()
CardDAO.exists(cardNumber)

TransactionDAO.create(data)
TransactionDAO.getMiniStatement(cardNumber, limit)
TransactionDAO.getPendingTransactions(cardNumber)
TransactionDAO.getSystemStats()

AuditLogDAO.create(data)    ← append-only (no update/delete)
AuditLogDAO.getAll(limit, skip)
AuditLogDAO.getByCard(cardNumber)
AuditLogDAO.getSecurityAlerts()
```

**OOSE Justification:**
- **Separation of Concerns:** `business-logic.js` contains zero Mongoose queries. If the database changes to PostgreSQL, only the DAO files change.
- **Encapsulation:** The internal query structure is hidden from controllers.
- **AuditLogDAO is append-only** — this enforces immutability as a design constraint, not just a convention.

---

### 2.5 Middleware Pattern

**File:** `backend/authentication.js`, `backend/index.js`

**Intent:** Chain processing steps so each component in the chain handles part of a request/response cycle.

**Implementation:**

```
Request Pipeline for protected routes:

[HTTP Request]
   │
   ▼
globalLimiter (rate limit: 100 req/15min)
   │
   ▼
authLimiter (rate limit: 10 auth req/15min) — on auth routes only
   │
   ▼
verifyToken (JWT validation + card lock check)
   │
   ▼
validateInput (schema-based body validation)
   │
   ▼
[Controller Function]
   │
   ▼ (on error)
errorHandler (centralised error formatting)
```

**OOSE Justification:**
- **Single Responsibility:** Each middleware does exactly one thing.
- **DRY Principle:** Error formatting, token validation, and input validation are written once and reused across all routes.
- **Composability:** Middleware functions are pure functions that can be combined in any order.

---

## 3. Security Architecture

| Threat | Mitigation |
|--------|-----------|
| Brute-force PIN attacks | express-rate-limit (10 auth requests/15min per IP) + 3-strike lockout |
| PIN exposure | bcryptjs hash (salt rounds: 12) — PIN never stored in plain text |
| Session hijacking | JWT with 2-minute expiry; token invalidated on card lock |
| SQL/NoSQL injection | Mongoose ODM parameterises all queries; no raw query strings |
| Unauthorised access | JWT Bearer tokens required on all `/api/account` and `/api/transactions` routes |
| Admin impersonation | Separate admin JWT with `role: 'ADMIN'` claim; `verifyAdmin` middleware |
| XSS | No server-side rendering; JSON API only; no `innerHTML` with user data |

---

## 4. The Luhn Algorithm

Card numbers are generated using the **ISO/IEC 7812 Luhn algorithm**, which is the same standard used by all major card networks (Visa, Mastercard, Amex).

**Generation process:**
1. Start with prefix `'4'` (Visa-style)
2. Append 14 random digits → 15-digit partial number
3. Apply Luhn checksum: process digits right-to-left, doubling every even-positioned digit
4. Check digit = `(10 - (sum % 10)) % 10`
5. Append check digit → 16-digit valid card number
6. Check database for collision (virtually impossible, but guaranteed unique)

---

## 5. Data Flow: Withdrawal Transaction

```
Frontend (terminal.js)
  │  btnWithdraw clicked → _openAmountView('WITHDRAWAL')
  │  User enters $200 → _processTransaction()
  │  POST /api/transactions/withdraw { amount: 200 }
  ▼
Express Middleware Chain (index.js)
  │  globalLimiter → verifyToken → validateInput({ amount })
  ▼
Controller: processWithdrawal (business-logic.js)
  │  CardDAO.findByCardNumber(cardNumber)   ← DAO Pattern
  │  TransactionFactory.create('WITHDRAWAL', { amount, cardNumber })  ← Factory
  │  txn.validate(card.balance)             ← Strategy/Encapsulation
  │  CardDAO.update(cardNumber, { balance: newBalance })
  │  atmMachineInstance.dispenseCash(200)   ← Singleton
  │  TransactionDAO.create({ ... })
  │  transactionSubject.notify('WITHDRAWAL', data)  ← Observer
  │      ├── AuditLogObserver → AuditLogDAO.create()
  │      └── NotificationObserver → console.log()
  │  res.json({ success: true, data: { amount, newBalance } })
  ▼
Frontend (terminal.js)
  │  _showResult('✓', 'Withdrawal Successful', ...)
  ▼
User sees: confirmation screen with new balance
```

---

## 6. Class Diagram Summary

```
ATMMachine (Singleton)
  └── getHealth(), dispenseCash(), acceptCash()

TransactionFactory
  ├── WithdrawalTransaction.validate(balance)
  ├── DepositTransaction.validate()
  ├── TransferTransaction.validate(balance)
  └── CheckDepositTransaction.validate()

AccountFactory
  ├── SavingsAccount.getInfo()   [2.5% p.a., $5K limit]
  ├── CheckingAccount.getInfo()  [$500 overdraft, $10K limit]
  └── PremiumAccount.getInfo()   [4.5% p.a., $50K limit]

TransactionSubject
  ├── AuditLogObserver → AuditLogDAO → MongoDB
  └── NotificationObserver → console.log

CardDAO        → Card (MongoDB collection)
TransactionDAO → Transaction (MongoDB collection)
AuditLogDAO    → AuditLog (MongoDB collection)

Middleware: verifyToken, verifyAdmin, validateInput, errorHandler
```
