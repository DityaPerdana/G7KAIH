"use client"

import { ReactNode, useEffect, useState } from "react"
import { usePathname } from "next/navigation"

import { KepsekSidebar } from "@/components/kepsek/KepsekSidebar"
import { SidebarProvider } from "@/components/ui/sidebar"

export default function KepsekLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname()

  const resolveActiveView = () => {
    if (pathname.startsWith("/kepsek")) return "classes"
    return ""
  }

  const [activeView, setActiveView] = useState(resolveActiveView())

  useEffect(() => {
    setActiveView(resolveActiveView())
  }, [pathname])

  return (
    <SidebarProvider>
      <div className="flex h-screen w-full">
        <KepsekSidebar activeView={activeView} onViewChange={setActiveView} />
        <main className="flex-1 overflow-auto">{children}</main>
      </div>
    </SidebarProvider>
  )
}
