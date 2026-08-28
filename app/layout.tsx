import './globals.css'
import ClearWarningsOnRefresh from '@/app/components/ClearWarningsOnRefresh'

export const metadata = {
  title: 'MTD Lab',
  description: 'HMRC Making Tax Digital workspace',
  icons: {
    icon: '/mtd-lab-logo-exact.webp',
    shortcut: '/mtd-lab-logo-exact.webp',
    apple: '/mtd-lab-logo-exact.webp',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body><ClearWarningsOnRefresh />{children}</body></html>
}
