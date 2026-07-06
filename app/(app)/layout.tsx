import AppShell from '@/app/components/AppShell'
import { MirrorProvider } from '@/app/components/MirrorProvider'

export default function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <MirrorProvider>
      <AppShell>{children}</AppShell>
    </MirrorProvider>
  )
}