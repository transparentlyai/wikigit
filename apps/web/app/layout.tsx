import '../styles/globals.css'
import { ToastProvider } from '@/components/providers/toast-provider'
import { ConfigProvider } from '@/components/providers/config-provider'

export const metadata = {
  title: 'WikiGit',
  description: 'Git-based Wiki Application',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        <ConfigProvider>
          {children}
        </ConfigProvider>
        <ToastProvider />
      </body>
    </html>
  )
}
