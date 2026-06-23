import type { Metadata } from "next"
import localFont from "next/font/local"
import "./globals.css"

const bodyFont = localFont({
  src: "./fonts/roboto-flex-latin.woff2",
  variable: "--font-luqz-body",
  display: "swap",
  weight: "100 1000",
})

const displayFont = localFont({
  src: [
    { path: "./fonts/sulphur-point-300-latin.woff2", weight: "300", style: "normal" },
    { path: "./fonts/sulphur-point-400-latin.woff2", weight: "400", style: "normal" },
    { path: "./fonts/sulphur-point-700-latin.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-luqz-display",
  display: "swap",
})

export const metadata: Metadata = {
  title: {
    default: "LUQZ Dash",
    template: "%s · LUQZ Dash",
  },
  description: "Inteligência, operação e saúde da carteira LUQZ.",
  icons: {
    icon: "/brand/symbol-gradient.png",
    apple: "/brand/symbol-gradient.png",
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className="h-full dark">
      <body className={`${bodyFont.variable} ${displayFont.variable} h-full`}>
        {children}
      </body>
    </html>
  )
}
