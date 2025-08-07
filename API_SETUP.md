# 🔑 API Setup Guide for 3D-Ah-Fi

## Required API Keys

To use all features of 3D-Ah-Fi, you'll need to obtain several API keys. Here's how to get them:

### 1. 🚀 Replicate API Token (REQUIRED for image & 3D generation)

**Steps to get your token:**
1. Go to [https://replicate.com](https://replicate.com)
2. Sign up for an account or log in
3. Go to your [Account Settings](https://replicate.com/account)
4. Copy your API token (starts with `r8_`)
5. Replace `r8_your_replicate_token_here` in `.env.local`

**Cost:** Pay-per-use pricing, typically $0.01-$0.10 per image generation

### 2. ✂️ ClipDrop API Key (for background removal)

**Steps to get your key:**
1. Go to [https://clipdrop.co/apis](https://clipdrop.co/apis)
2. Sign up and verify your email
3. Go to your dashboard
4. Copy your API key
5. Replace `your_clipdrop_api_key_here` in `.env.local`

**Cost:** Free tier available, then pay-per-use

### 3. 🤖 Anthropic API Key (for AI features)

**Steps to get your key:**
1. Go to [https://console.anthropic.com](https://console.anthropic.com)
2. Sign up for an account
3. Go to API Keys section
4. Create a new API key
5. Replace `your_anthropic_api_key_here` in `.env.local`

**Cost:** Pay-per-use, free credits for new accounts

### 4. 🧠 OpenAI API Key (optional features)

**Steps to get your key:**
1. Go to [https://platform.openai.com](https://platform.openai.com)
2. Sign up or log in
3. Go to API Keys section
4. Create a new secret key
5. Replace `your_openai_api_key_here` in `.env.local`

**Cost:** Pay-per-use pricing

### 5. 🎤 Deepgram API Key (for voice features)

**Steps to get your key:**
1. Go to [https://deepgram.com](https://deepgram.com)
2. Sign up for an account
3. Go to your dashboard
4. Copy your API key
5. Replace `your_deepgram_api_key_here` in `.env.local`

**Cost:** Free tier available

## 🛡️ Security Best Practices

1. **Never commit `.env.local` to git** - it's already in `.gitignore`
2. **Keep your API keys private** - don't share them publicly
3. **Monitor usage** - check your API usage regularly to avoid unexpected charges
4. **Use different keys for development/production** if possible

## 🚦 Minimum Setup for Testing

For basic functionality, you only need:
1. **Replicate API Token** - For image and 3D generation
2. **Firebase** - Already configured

The other API keys are optional and enable additional features.

## ✅ Verify Your Setup

After adding your API keys:
1. Restart the development server: `npm run dev`
2. Visit `http://localhost:3002/modern`
3. Try generating an image to test your Replicate token

## 🆘 Troubleshooting

**"API configuration error: REPLICATE_API_TOKEN is not set"**
- Make sure you've added your Replicate token to `.env.local`
- Restart the development server after adding the token

**"Payment required" errors**
- Check your API account billing/credits
- Some APIs require payment setup even for free tier usage

**Token format errors**
- Replicate tokens start with `r8_`
- Make sure there are no extra spaces or characters

## 🎯 Quick Start Command

After setting up your `.env.local` file:
```bash
npm run dev
```

Then visit: `http://localhost:3002/modern`