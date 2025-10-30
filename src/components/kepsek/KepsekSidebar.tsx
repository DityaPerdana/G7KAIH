"use client"

import { GraduationCap, Layers } from "lucide-react"
import { usePathname, useRouter } from "next/navigation"
import { useEffect, useMemo, useState } from "react"

import LogoutButton from "@/components/ui/logoutButton"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from "@/components/ui/sidebar"
import { createClient } from "@/utils/supabase/client"

const ROLE_LABELS: Record<number, string> = {
  1: "Unknown",
  2: "Teacher",
  3: "Parent",
  4: "Admin",
  5: "Student",
  6: "Guru Wali",
  7: "Kepsek",
}

export function KepsekSidebar({
  activeView,
  onViewChange,
}: {
  activeView: string
  onViewChange: (value: string) => void
}) {
  const router = useRouter()
  const pathname = usePathname()
  const [userProfile, setUserProfile] = useState<{
    username: string | null
    email: string | null
    roleid: number | null
  } | null>(null)

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const supabase = createClient()
        const {
          data: { user },
        } = await supabase.auth.getUser()

        if (!user) return

        const { data: profile } = await supabase
          .from("user_profiles")
          .select("username, roleid")
          .eq("userid", user.id)
          .single()

        setUserProfile({
          username: profile?.username || null,
          email: user.email || null,
          roleid: profile?.roleid || null,
        })
      } catch (error) {
        console.error("Failed to load kepsek profile", error)
      }
    }

    fetchProfile()
  }, [])

  const navigationItems = useMemo(
    () => [
      {
        key: "classes",
        title: "Kelas",
        description: "Kelola dan pantau seluruh kelas",
        url: "/kepsek",
        icon: Layers,
        color: "bg-blue-500",
        disabled: false,
      },
    ],
    []
  )

  const handleItemClick = (item: (typeof navigationItems)[number]) => {
    if (item.disabled) return
    onViewChange(item.key)
    router.push(item.url)
  }

  const roleName = ROLE_LABELS[userProfile?.roleid ?? 0] ?? "Unknown"

  const resolvedActiveView = activeView || (pathname.startsWith("/kepsek") ? "classes" : "")

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="flex items-center gap-3 px-4 py-6">
          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center group-data-[collapsible=icon]:mx-auto">
            <GraduationCap className="h-6 w-6 text-white" />
          </div>
          <div className="flex flex-col group-data-[collapsible=icon]:hidden">
            <h2 className="text-xl font-bold text-gray-900">Kepsek Panel</h2>
            <p className="text-sm text-gray-500">Manajemen kelas dan siswa</p>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent className="bg-gray-50/30">
        <div className="px-4 space-y-2 group-data-[collapsible=icon]:px-2">
          {navigationItems.map((item) => {
            const Icon = item.icon
            const isActive = resolvedActiveView === item.key

            return (
              <button
                key={item.key}
                onClick={() => handleItemClick(item)}
                className={`w-full group flex items-start gap-4 rounded-xl p-4 transition-all duration-200 hover:shadow-md group-data-[collapsible=icon]:p-3 group-data-[collapsible=icon]:justify-center relative ${
                  item.disabled
                    ? "opacity-60 cursor-not-allowed"
                    : isActive
                    ? "bg-white shadow-lg ring-1 ring-gray-100 scale-[1.02]"
                    : "hover:bg-white/80"
                }`}
                title={item.title}
                disabled={item.disabled}
              >
                <div
                  className={`w-10 h-10 ${item.color} rounded-lg flex items-center justify-center shadow-sm group-hover:shadow-md transition-shadow group-data-[collapsible=icon]:w-8 group-data-[collapsible=icon]:h-8`}
                >
                  <Icon className="h-5 w-5 text-white group-data-[collapsible=icon]:h-4 group-data-[collapsible=icon]:w-4" />
                </div>
                <div className="flex-1 min-w-0 text-left group-data-[collapsible=icon]:hidden">
                  <h3
                    className={`text-sm font-semibold truncate ${
                      isActive ? "text-gray-900" : "text-gray-700 group-hover:text-gray-900"
                    }`}
                  >
                    {item.title}
                  </h3>
                  <p className={`text-xs truncate mt-0.5 ${isActive ? "text-gray-600" : "text-gray-500"}`}>
                    {item.description}
                  </p>
                </div>
                {isActive && !item.disabled && (
                  <div className="w-1 h-8 bg-gradient-to-b from-blue-500 to-indigo-600 rounded-full group-data-[collapsible=icon]:hidden" />
                )}
              </button>
            )
          })}
        </div>

        <div className="px-4 mt-8 group-data-[collapsible=icon]:hidden">
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-100 overflow-hidden">
            <div className="w-full p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-full flex items-center justify-center">
                  <GraduationCap className="h-5 w-5 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-semibold text-gray-900 truncate">
                    {userProfile?.username || "Memuat..."}
                  </h4>
                  <p className="text-xs text-gray-600 truncate">{roleName}</p>
                  {userProfile?.email && (
                    <p className="text-xs text-gray-500 truncate">{userProfile.email}</p>
                  )}
                </div>
              </div>
              <div className="border-t border-gray-200 mt-4 pt-3">
                <LogoutButton />
              </div>
            </div>
          </div>
        </div>
      </SidebarContent>

      <SidebarFooter>
        <div className="px-4 py-4 group-data-[collapsible=icon]:px-2">
          <div className="bg-white rounded-xl p-3 shadow-sm border border-gray-100 group-data-[collapsible=icon]:p-2 group-data-[collapsible=icon]:flex group-data-[collapsible=icon]:justify-center">
            <div className="hidden group-data-[collapsible=icon]:block">
              <LogoutButton />
            </div>
            <div className="text-xs text-gray-500 text-center group-data-[collapsible=icon]:hidden">
              © 2025 G7KAIH
            </div>
          </div>
        </div>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
