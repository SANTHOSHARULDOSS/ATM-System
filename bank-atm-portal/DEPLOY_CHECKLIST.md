# 📋 DEPLOYMENT CHECKLIST — Quick Reference

Print this page or bookmark it for your deployment.

---

## ✅ BEFORE YOU START

- [ ] Node.js 18+ installed locally
- [ ] MongoDB Atlas account (or local MongoDB)
- [ ] GitHub account with repo pushed
- [ ] Deployment platform account (Render/Railway/Heroku)

---

## ✅ STEP 1: Prepare Locally (5 min)

```bash
cd bank-atm-portal
npm install
npm start
```

- [ ] Server starts without errors
- [ ] http://localhost:3000 loads in browser
- [ ] ATM interface appears
- [ ] Press Ctrl+C to stop

---

## ✅ STEP 2: Get MongoDB Connection String (5 min)

MongoDB Atlas:
1. [ ] Go to https://mongodb.com/cloud/atlas
2. [ ] Sign up → Create free cluster
3. [ ] Click "Connect" → "Drivers"
4. [ ] Copy connection string
5. [ ] Copy to: `MONGODB_URI=mongodb+srv://...`

**Replace**: `<password>` and `<username>` with your credentials

---

## ✅ STEP 3: Generate JWT Secret (1 min)

Run in terminal:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Copy output to: `JWT_SECRET=<output>`

---

## ✅ STEP 4: Choose Deployment Platform

### Option A: Render (RECOMMENDED) ⭐
- [ ] Go to https://render.com
- [ ] Sign up with GitHub
- [ ] Choose Render path below

### Option B: Railway
- [ ] Go to https://railway.app
- [ ] Sign up with GitHub
- [ ] Follow Railway guide in DEPLOYMENT.md

### Option C: Heroku
- [ ] Go to https://heroku.com
- [ ] Sign up
- [ ] Follow Heroku guide in DEPLOYMENT.md

---

## ✅ STEP 5: Deploy to Render (5 min)

### 5.1 Connect Repository
- [ ] Click "New +" in Render dashboard
- [ ] Select "Web Service"
- [ ] Authorize GitHub
- [ ] Select your `atm-system` repo

### 5.2 Configure Service
- [ ] **Name**: `santhosh-bank-atm`
- [ ] **Environment**: `Node`
- [ ] **Build Command**: `npm install`
- [ ] **Start Command**: `npm start`
- [ ] Click "Advanced" → "Add Environment Variable"

### 5.3 Add Environment Variables

Copy-paste these one by one:

```
NODE_ENV
production

MONGODB_URI
mongodb+srv://your-user:your-pass@cluster.mongodb.net/atm_system_db?retryWrites=true&w=majority

MONGODB_DB_NAME
atm_system_db

JWT_SECRET
<your-32-char-random-secret>

ADMIN_USERNAME
admin

ADMIN_PASSWORD
<choose-secure-password>

MAINTENANCE_USERNAME
technician

MAINTENANCE_PASSWORD
<choose-secure-password>

PORT
3000
```

- [ ] Verify all 8 variables added

### 5.4 Deploy
- [ ] Click "Create Web Service"
- [ ] Wait 2-3 minutes for build
- [ ] Check logs for errors
- [ ] Get public URL from dashboard
- [ ] Open URL in browser

---

## ✅ STEP 6: Verify Deployment

- [ ] Public URL loads (shows ATM interface)
- [ ] Can register new account
- [ ] Can login with card number & PIN
- [ ] Can check balance
- [ ] Can perform withdrawal
- [ ] No errors in browser console

---

## ✅ STEP 7: Configure MongoDB Atlas (Optional but Recommended)

For production use:
1. [ ] Go to MongoDB Atlas dashboard
2. [ ] Go to "Database Access"
3. [ ] Create new database user (not admin)
4. [ ] Go to "Network Access"
5. [ ] Add IP address of deployment platform

---

## ✅ COMMON ISSUES & QUICK FIXES

| Problem | Solution |
|---------|----------|
| Build fails | Check all env variables are set |
| Server won't start | Verify MONGODB_URI is correct |
| Can't login | MongoDB might be initializing, wait 1 min |
| Connection timeout | Check MongoDB Atlas IP whitelist |
| App crashes | Check Render logs for error details |

---

## 📞 If Deployment Fails

1. [ ] Check full logs in platform dashboard
2. [ ] Verify MONGODB_URI is correct
3. [ ] Verify all environment variables are set
4. [ ] Try locally: `npm start`
5. [ ] Read `DEPLOYMENT.md` in `bank-atm-portal/`
6. [ ] Check MongoDB Atlas whitelist

---

## 🎉 You're Done!

When your app is running:

✅ Application is live!
✅ You can share public URL with others
✅ Accounts persist in MongoDB
✅ All features working
✅ Ready for production use

---

## 📚 Documentation Reference

- **`QUICK_START.md`** — Local setup guide
- **`DEPLOYMENT.md`** — Detailed deployment for all platforms
- **`FINAL_SUMMARY.md`** — Complete overview
- **`ERRORS_FIXED.md`** — What was fixed
- **`DOCUMENTATION.md`** — Architecture & OOSE patterns

---

## 🚀 Next Steps After Deployment

1. [ ] Test all features in production
2. [ ] Monitor error logs
3. [ ] Set up regular backups
4. [ ] Configure error monitoring (Sentry)
5. [ ] Share with team/users
6. [ ] Celebrate! 🎉

---

**Deployment Checklist Version 1.0**  
Last Updated: March 2026  
Status: Ready to Deploy ✅
