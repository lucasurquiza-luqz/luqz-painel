import type { Metadata } from "next"
import { Roboto_Flex, Sulphur_Point } from "next/font/google"
import "./globals.css"

const bodyFont = Roboto_Flex({
  subsets: ["latin"],
  variable: "--font-luqz-body",
  display: "swap",
})

const displayFont = Sulphur_Point({
  subsets: ["latin"],
  weight: ["300", "400", "700"],
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
