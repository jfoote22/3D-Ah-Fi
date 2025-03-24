import "./globals.css";
import { AuthProvider } from "@/lib/contexts/AuthContext";

export const metadata = {
  title: '3D-Ah-Fi | AI Image & 3D Generator',
  description: 'Create stunning images and 3D models with AI',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
