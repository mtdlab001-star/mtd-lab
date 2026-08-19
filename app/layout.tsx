import './globals.css'
export const metadata = { title: 'MTD Lab', description: 'HMRC Making Tax Digital workspace' }
export default function RootLayout({ children }: { children: React.ReactNode }) { return <html lang="en"><body>{children}</body></html> }
