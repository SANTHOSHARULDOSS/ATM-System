# Quick Start Guide — ATM System

Get the ATM System running in 5 minutes!

## Prerequisites

- **Node.js 18+** ([Download](https://nodejs.org/))
- **MongoDB** (either local or Atlas cloud account)
  - Local: Install from https://www.mongodb.com/try/download/community
  - Cloud (Recommended): Free account at https://www.mongodb.com/cloud/atlas

## Step 1: Install Dependencies

```bash
cd bank-atm-portal
npm install
```

This installs: Express, Mongoose, JWT, bcryptjs, CORS, rate-limiting, and more.

## Step 2: Setup MongoDB

### Option A: MongoDB Atlas (Cloud - Recommended)

1. Go to https://www.mongodb.com/cloud/atlas
2. Sign up for free account
3. Create a new cluster
4. Get connection string: Click "Connect" → Copy URI
   - Format: `mongodb+srv://username:password@cluster.mongodb.net/atm_system_db?retryWrites=true&w=majority`

### Option B: MongoDB Local

1. Install MongoDB Community Edition
2. Start MongoDB service:
   ```bash
   mongod  # Windows/Mac/Linux
   ```

## Step 3: Configure Environment

Create/update `.env` in the `bank-atm-portal` folder:

```env
# Required
NODE_ENV=development
MONGODB_URI=mongodb://127.0.0.1:27017/atm_system_db
JWT_SECRET=your_super_secret_key_at_least_32_chars_long_123456

# Admin & Maintenance (can use defaults for testing)
ADMIN_USERNAME=admin
ADMIN_PASSWORD=SecureAdminPass123!
MAINTENANCE_USERNAME=technician
MAINTENANCE_PASSWORD=SecureTechPass123!

# Optional - defaults are fine for local development
PORT=3000
ATM_MACHINE_NUMBER=ATM-001
BCRYPT_SALT_ROUNDS=10
```

**For MongoDB Atlas**, use your connection string:
```env
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/atm_system_db?retryWrites=true&w=majority
```

## Step 4: Start the Server

```bash
npm start
```

You should see:
```
╔═══════════════════════════════════════════╗
║        ATM SYSTEM — SERVER STARTED        ║
╠═══════════════════════════════════════════╣
║  URL    : http://localhost:3000            ║
║  Mode   : development                    ║
╚═══════════════════════════════════════════╝
```

## Step 5: Open in Browser

Go to: **http://localhost:3000**

## First Time Usage

### Create a New Account (Customer)

1. Click **"New Customer? Register Here"**
2. Fill in:
   - Email: `user@example.com`
   - PIN: `1234` (4-6 digits)
   - Phone: `9876543210` (10-15 digits)
   - Account Type: Select from dropdown
3. Click **Register**
4. Your 16-digit card number is generated automatically

### Login

1. Enter your 16-digit card number
2. Enter your PIN
3. Click **Login**
4. You now have a 2-minute session

### Admin Portal

- Navigate to **Admin Portal** from welcome screen
- Username: `admin`
- Password: `SecureAdminPass123!`

Admin can:
- View all cards and transactions
- Lock/unlock accounts
- Set ATM status
- View audit logs

### Maintenance Portal

- Navigate to **Maintenance** from welcome screen
- Username: `technician`
- Password: `SecureTechPass123!`

Technician can:
- Run diagnostics
- Enable/disable services
- View error logs

## Available Transactions

Once logged in, you can:

- **Check Balance** - View current account balance
- **Withdraw** - Max $10,000 per transaction
- **Deposit** - Max $50,000 per transaction
- **Transfer** - Max $25,000 per transaction to another card
- **Check Deposit** - Pending until admin clears it
- **Mini Statement** - Last 10 transactions
- **Change PIN** - Update your security PIN

## Development Mode

### Run with Nodemon (Auto-Restart)

```bash
npm run dev
```

The server will restart automatically when you change code.

### Test the API

Use **Postman**, **curl**, or VS Code Rest Client:

```http
POST http://localhost:3000/api/auth/register
Content-Type: application/json

{
  "email": "test@example.com",
  "pin": "5678",
  "phoneNumber": "9876543210",
  "accountType": "SAVINGS"
}
```

## Database Collections

After running, MongoDB contains:

- **cards** - Customer accounts (16-digit card number, balance, PIN hash)
- **transactions** - Withdrawal, deposit, transfer history
- **auditlogs** - Security audit trail of all operations

## Troubleshooting

### **Error: MONGODB_URI is not defined**
- Add `MONGODB_URI` to `.env`
- Ensure `.env` is in `bank-atm-portal/` folder
- Restart server after adding `.env`

### **Error: Cannot connect to MongoDB**
- Verify MongoDB service is running
- For Atlas: Check connection string is correct
- For local: Make sure `mongod` is running
- Check IP whitelisting in MongoDB Atlas (if using cloud)

### **Port 3000 Already in Use**
```bash
# Option 1: Use different port
PORT=3001 npm start

# Option 2: Kill process using port 3000
# Windows:
netstat -ano | findstr :3000
taskkill /PID <PID> /F

# Mac/Linux:
lsof -i :3000
kill -9 <PID>
```

### **Card Registration Fails**
- Email must be unique
- PIN must be 4-6 digits
- Phone must be 10-15 digits
- All fields are required

### **Login Not Working**
- Ensure card number is exactly 16 digits
- PIN is case-sensitive and must match registration
- Card might be locked (3 wrong PIN attempts)

## Security Notes

⚠️ **This is a demo application. Before production:**

1. Change all default credentials
2. Use a strong, random `JWT_SECRET`
3. Enable HTTPS/SSL
4. Set up database backups
5. Add rate limiting to prevent abuse
6. Implement monitoring and alerting
7. Review and harden security policies

## Next Steps

- Read [DEPLOYMENT.md](./DEPLOYMENT.md) to deploy online
- Read [DOCUMENTATION.md](./DOCUMENTATION.md) for architecture details
- Explore the code in `backend/` and `webapp/`
- Check out the OOSE design patterns implemented

## Quick Reference

| Command | Purpose |
|---------|---------|
| `npm start` | Start production server |
| `npm run dev` | Start with auto-reload |
| `npm test` | Run tests (if configured) |

## Need Help?

- Check application logs in terminal
- Verify `.env` variables are set
- Ensure MongoDB is running
- Review [DOCUMENTATION.md](./DOCUMENTATION.md)
- Check `backend/` code comments

---

**Enjoy your ATM System!** 🏦

Last Updated: March 2026
