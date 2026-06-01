import type { Metadata } from "next"
import { Geist } from "next/font/google"
import "./globals.css"

const geist = Geist({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "Painel LUQZ",
  description: "Painel interno LUQZ",
  icons: {
    icon: "/simbolo-degrade.png",
    apple: "/simbolo-degrade.png",
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className="h-full dark">
      <body className={`${geist.className} h-full`}>
        {children}
      </body>
    </html>
  )
}
