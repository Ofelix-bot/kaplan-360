import type { Metadata } from "next"
import { Archivo } from "next/font/google"
import { cn } from "cn"

import "./globals.css"
import { MotionProvider } from "@/components/app/motion-provider"
import { ThemeProvider } from "@/components/theme-provider"
import { TooltipProvider } from "@/components/ui/tooltip"

const archivo = Archivo({
  subsets: ["latin"],
  axes: ["wdth"],
  variable: "--font-archivo",
  display: "swap",
})

export const metadata: Metadata = {
  title: "Programme workspace · Kaplan 360++",
  description:
    "Find a master’s, see who was admitted, rank a shortlist and track applications.",
  robots: { index: false, follow: false },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn("antialiased", archivo.variable)}
    >
      <body>
        <ThemeProvider>
          <MotionProvider>
            <TooltipProvider>{children}</TooltipProvider>
          </MotionProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
