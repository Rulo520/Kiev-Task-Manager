import { Inter } from "next/font/google";
import "./globals.css";

import { APP_NAME } from "@/constants/version";
import { KievConfirmProvider } from "@/components/ui/KievConfirmProvider";

const inter = Inter({ subsets: ["latin"] });

export const metadata = {
  title: `${APP_NAME} Pro`,
  description: "Intelligence Console",
};

export const revalidate = 0;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.className} antialiased bg-slate-50`}>
        <KievConfirmProvider>
          {children}
        </KievConfirmProvider>
      </body>
    </html>
  );
}
