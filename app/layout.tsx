import './globals.css'
export const metadata = {
  title: 'MTD Lab',
  description: 'HMRC Making Tax Digital workspace',
  icons: {
    icon: '/mtd-lab-logo-exact.webp',
    shortcut: '/mtd-lab-logo-exact.webp',
    apple: '/mtd-lab-logo-exact.webp',
  },
}
export default function RootLayout({ children }: { children: React.ReactNode }) { return <html lang="en"><body>{children}</body></html> }
