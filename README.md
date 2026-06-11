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
   cd mailblast
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start the server**
   ```bash
   npm run dev
   ```

4. Open [http://localhost:3000](http://localhost:3000) in your browser.

## ☁️ Deploying to Vercel

MailBlast is pre-configured with a `vercel.json` file and is **100% ready** to be deployed to Vercel in seconds!

1. Push your code to GitHub.
2. Log into your [Vercel Dashboard](https://vercel.com).
3. Click **Add New Project** and import the `mailblast` repository.
4. Leave all build commands and settings as their defaults. Vercel will automatically recognize the Express API.
5. Click **Deploy**!

## 🤝 Contributing
Feel free to open issues or submit pull requests.

## 📄 Contact
*Created by [Asmit](mailto:asmitrawat531@gmail.com).*
