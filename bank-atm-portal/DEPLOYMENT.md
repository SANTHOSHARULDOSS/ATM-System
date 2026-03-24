# Deployment Guide — ATM System

This guide covers deployment options for the ATM System application.

## ⚠️ IMPORTANT: Platform Compatibility

The ATM System is a **traditional Node.js/Express server application**, not a serverless or static site. This means:

- ✅ **Recommended**: Render, Railway, Heroku, DigitalOcean, AWS EC2, Google Cloud Run, Azure Container Instances
- ⚠️ **Not Recommended**: Vercel, Netlify (these are serverless/static hosting platforms)
- ❌ **Incompatible**: GitHub Pages, GitLab Pages (static hosting only)

---

## Option 1: Deploy to Render (Recommended) ✅

Render is an excellent choice for this app. It's modern, affordable, and supports long-running servers.

### Steps:

1. **Create a Render Account**
   - Go to https://render.com
   - Sign up with GitHub or email

2. **Connect Your Repository**
   - Click "New +"
   - Select "Web Service"
   - Connect your GitHub repository

3. **Configure the Service**
   - **Name**: `santhosh-bank-atm`
   - **Environment**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`

4. **Set Environment Variables**
   - In the Render dashboard, go to **Environment**
   - Add all variables from your `.env` file:
     ```env
     NODE_ENV=production
     MONGODB_URI=mongodb+srv://your-user:your-pass@cluster.mongodb.net/atm_system_db
     JWT_SECRET=<generate-strong-random-secret>
     ADMIN_USERNAME=admin
     ADMIN_PASSWORD=<secure-password>
     MAINTENANCE_USERNAME=technician
     MAINTENANCE_PASSWORD=<secure-password>
     ```

5. **Deploy**
   - Click "Create Web Service"
   - Render will automatically deploy on every GitHub push

### MongoDB Setup (Required)
- Use **MongoDB Atlas** (free tier available)
- Create a free cluster at https://www.mongodb.com/cloud/atlas
- Get connection string: `mongodb+srv://user:password@cluster.mongodb.net/atm_system_db`
- Whitelist Render's IP addresses in MongoDB Atlas (or allow from anywhere for development)

---

## Option 2: Deploy to Railway

Railway is another great alternative with generous free tier.

### Steps:

1. **Create Railway Account**
   - Go to https://railway.app
   - Sign up with GitHub

2. **Create New Project**
   - Click "Create Project"
   - Select "Deploy from GitHub repo"
   - Authorize and select your repository

3. **Configure Environment**
   - In the Railway dashboard, add environment variables matching `.env`

4. **Deploy**
   - Railway auto-deploys on GitHub push
   - Get your public URL from the Railway dashboard

---

## Option 3: Deploy to Heroku (Legacy but Still Works)

### Prerequisites:
- Heroku CLI installed
- Heroku account

### Steps:

1. **Login to Heroku**
   ```bash
   heroku login
   ```

2. **Create Heroku App**
   ```bash
   heroku create santhosh-bank-atm
   ```

3. **Add MongoDB Add-on** (Optional)
   ```bash
   heroku addons:create mongolab
   ```
   Or use MongoDB Atlas and set `MONGODB_URI` via config vars.

4. **Set Environment Variables**
   ```bash
   heroku config:set NODE_ENV=production
   heroku config:set JWT_SECRET=<strong-random-secret>
   heroku config:set MONGODB_URI=<atlas-connection-string>
   heroku config:set ADMIN_PASSWORD=<secure-password>
   heroku config:set MAINTENANCE_PASSWORD=<secure-password>
   ```

5. **Deploy**
   ```bash
   git push heroku main
   ```

---

## Option 4: Deploy to AWS EC2 (Self-Managed)

For more control, deploy to an EC2 instance.

### Prerequisites:
- AWS account
- EC2 instance running Node.js (Ubuntu 20.04+ recommended)
- Domain name with DNS records pointing to your instance

### Steps:

1. **SSH into Your Instance**
   ```bash
   ssh -i your-key.pem ubuntu@your-instance-ip
   ```

2. **Install Node.js**
   ```bash
   curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
   sudo apt-get install -y nodejs
   ```

3. **Install MongoDB** (or use MongoDB Atlas)
   ```bash
   # For production, use MongoDB Atlas instead
   # For local: install MongoDB Community
   ```

4. **Clone Your Repo**
   ```bash
   git clone https://github.com/your-username/atm-system.git
   cd atm-system/bank-atm-portal
   npm install
   ```

5. **Create `.env` File**
   ```bash
   nano .env
   # Add all environment variables
   ```

6. **Setup Process Manager** (PM2)
   ```bash
   sudo npm install -g pm2
   pm2 start npm --name "atm-system" -- start
   pm2 startup
   pm2 save
   ```

7. **Setup Nginx as Reverse Proxy**
   ```bash
   sudo apt-get install nginx
   # Configure /etc/nginx/sites-available/default to proxy to localhost:3000
   ```

8. **Setup SSL** (Free via Let's Encrypt)
   ```bash
   sudo apt-get install certbot python3-certbot-nginx
   sudo certbot --nginx -d yourdomain.com
   ```

---

## Why NOT Vercel/Netlify?

Vercel and Netlify are **serverless platforms** optimized for:
- ✅ Static sites (HTML/CSS/JS)
- ✅ Next.js applications
- ✅ Stateless API functions with short lifespans (<15 minutes)

The ATM System requires:
- ❌ Long-running processes (HTTP server listening constantly)
- ❌ Database connection pooling (needs persistent connections)
- ❌ Session state management

**Result**: Your app would timeout or behave unpredictably on Vercel/Netlify.

### Alternative: Vercel for Frontend Only

If you **must** use Vercel, consider:
1. Separating frontend (React/Next.js) from backend
2. Deploy frontend to Vercel
3. Deploy backend to one of the options above
4. Use CORS to communicate between them

---

## Production Security Checklist

Before deploying to production, ensure:

- [ ] **JWT_SECRET** is a strong, random 32+ character value
  ```bash
  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
  ```

- [ ] **Admin credentials** are changed from defaults
  ```env
  ADMIN_USERNAME=<unique-username>
  ADMIN_PASSWORD=<strong-password>
  MAINTENANCE_USERNAME=<unique-username>
  MAINTENANCE_PASSWORD=<strong-password>
  ```

- [ ] **MongoDB Atlas**:
  - [ ] Use a strong database password
  - [ ] Set up database user account (not admin account)
  - [ ] Whitelist production IP only
  - [ ] Enable encryption at rest
  - [ ] Enable encryption in transit

- [ ] **Environment Variables**:
  - [ ] Never commit `.env` to version control
  - [ ] Use platform secrets/config vars instead
  - [ ] Review all sensitive values before deployment

- [ ] **CORS Configuration**:
  ```env
  # Development: ALLOWED_ORIGIN=*
  # Production: ALLOWED_ORIGIN=https://yourdomain.com
  ```

- [ ] **Node Version**: Ensure host runs Node 18+

- [ ] **Error Monitoring**: Set up error tracking (e.g., Sentry)

- [ ] **Logs**: Configure centralized logging

- [ ] **Backups**: Enable MongoDB Atlas automatic backups

---

## Monitoring & Health Checks

Most platforms support health checks. Add this to your logs:

```javascript
// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date() });
});
```

Configure your platform's health check to:
- **Endpoint**: `GET /health`
- **Interval**: 30 seconds
- **Timeout**: 5 seconds

---

## Troubleshooting

### App Won't Start
1. Check `npm start` works locally
2. Verify `.env` has all required variables
3. Check Node version matches requirement (18+)
4. Review application logs on your platform

### Database Connection Fails
1. Verify `MONGODB_URI` is correct
2. Check MongoDB Atlas whitelist includes your platform's IP
3. Ensure database credentials are correct
4. Test connection string locally

### Port Issues
- Local: Use `PORT=3000` (from `.env`)
- Heroku/Render: Platform assigns `PORT` automatically (code uses `process.env.PORT`)
- Express app correctly listens on `process.env.PORT || 3000`

---

## Getting Help

If deployment fails:

1. Check platform-specific documentation
2. Review application logs in the deployment platform dashboard
3. Test locally: `npm start` should work without issues
4. Verify all environment variables are set
5. Check that MongoDB connection works independently

---

**Last Updated**: March 2026
**Author**: OOSE Lab
