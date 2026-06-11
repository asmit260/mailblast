# MailBlast 🚀

MailBlast is a blazingly fast, beautiful, and secure bulk email tool built with a sleek glassmorphic UI. It runs efficiently using your own SMTP credentials—no third-party subscriptions or monthly fees required!

![MailBlast Preview](https://via.placeholder.com/800x450/09090b/e2e8f0?text=MailBlast+Dashboard) *(You can replace this with a real screenshot later)*

## ✨ Features
- **Bring Your Own SMTP:** Connect instantly to Amazon SES, SendGrid, Gmail, or any custom SMTP provider.
- **Privacy-First:** Your credentials and mailing lists are processed purely in-memory. No databases, no tracking.
- **Premium Design:** A stunning, mobile-responsive dark mode interface featuring bento-grid layouts and micro-animations.
- **Real-Time Progress:** Watch your campaign send in real time with beautiful live-updating progress bars.
- **Anti-Spam Optimizations:** Built-in best-practice headers (`List-Unsubscribe`, `X-Report-Abuse`) to protect your sender reputation and ensure high deliverability.

## 🚀 Quick Start (Local)

1. **Clone the repository**
   ```bash
   git clone https://github.com/asmit260/mailblast.git
   cd "mass mail"
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start the local server**
   You can run the server directly using Node:
   ```bash
   node server.js
   ```
   Or use the dev script if available:
   ```bash
   npm run dev
   ```

4. Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## ☁️ Deploying to Vercel (Serverless Architecture)

MailBlast is pre-configured with a `vercel.json` file and has been specifically architected to run perfectly in a Serverless environment!

### Recent Architectural Changes for Vercel
To make MailBlast compatible with Vercel's strict Serverless execution limits, the following updates were applied:
1. **Stateless Chunking Engine:** Instead of relying on a long-running Node.js background loop with Server-Sent Events (SSE) which Vercel would abruptly kill, the frontend now slices your recipient list into small batches.
2. **Synchronous Execution:** The browser sends each small batch to `/api/send`, waits for the emails to process synchronously, and updates the UI progress bar. This keeps operations well under Vercel's execution timeouts.
3. **Robust Speed/ETA Math:** The real-time ETA algorithms were refactored to calculate total completion time over total elapsed time, ensuring high accuracy even when processing batch responses.
4. **Forgiving Validation:** Strict UI blocks for SMTP validation have been downgraded to warnings. This allows you to proceed with sending even if Gmail flags Vercel's datacenter IPs during the initial connection test.

### How to Deploy
1. Push your code to GitHub.
2. Log into your [Vercel Dashboard](https://vercel.com).
3. Click **Add New Project** and import your repository.
4. Leave all build commands and settings as their defaults. Vercel will automatically recognize the Express API and static assets.
5. Click **Deploy**!

## 🤝 Contributing
Feel free to open issues or submit pull requests.

## 📄 Contact
*Created by [Asmit](mailto:asmitrawat531@gmail.com).*
