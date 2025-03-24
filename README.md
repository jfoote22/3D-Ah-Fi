# 3D-Ah-Fi

A modern web application for generating images and 3D models using AI technology.

## Features

- Image generation with Stable Diffusion XL 3.5
- 3D model generation with Hunyuan3D-2
- User authentication with Firebase
- Save and manage generated images
- Dark-themed modern UI with responsive design

## Tech Stack

- Next.js 14 (App Router)
- React
- TypeScript
- Firebase (Authentication, Firestore, Storage)
- Tailwind CSS
- Vercel AI SDK
- Replicate API

## Getting Started

### Prerequisites

- Node.js 18.17 or later
- Firebase account
- Replicate API key

### Environment Variables

Create a `.env.local` file in the root directory with the following variables:

```
# Firebase Configuration
NEXT_PUBLIC_FIREBASE_API_KEY=your_firebase_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_firebase_auth_domain
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_firebase_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_firebase_storage_bucket
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_firebase_messaging_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_firebase_app_id

# Replicate Configuration
REPLICATE_API_TOKEN=your_replicate_api_token
```

### Installation

1. Clone this repository
   ```bash
   git clone https://github.com/jfoote22/3D-Ah-Fi.git
   cd 3D-Ah-Fi
   ```

2. Install dependencies
   ```bash
   npm install
   ```

3. Run the development server
   ```bash
   npm run dev
   ```

4. Open [http://localhost:3000](http://localhost:3000) in your browser

## Deployment

This project is configured for deployment on Vercel. Simply connect your GitHub repository to Vercel and add the required environment variables.

## License

This project is licensed under the MIT License - see the LICENSE file for details.