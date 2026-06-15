import {
  LayoutGrid, Component, Database, Image as ImageIcon,
  Palette, PanelTop, Inbox, Activity, type LucideIcon,
} from "lucide-react";

export type NavItem = { href: string; label: string; icon: LucideIcon; external?: boolean };
export type NavGroup = { title: string; items: NavItem[] };

export const NAV_GROUPS: NavGroup[] = [
  { title: "Build", items: [
    { href: "/", label: "Pages", icon: LayoutGrid },
    { href: "/components", label: "Components", icon: Component },
    { href: "/cms", label: "CMS", icon: Database },
    { href: "/assets", label: "Assets", icon: ImageIcon },
  ]},
  { title: "Brand", items: [
    { href: "/design", label: "Design", icon: Palette },
    { href: "/site", label: "Site", icon: PanelTop },
  ]},
  { title: "Grow", items: [
    { href: "/forms", label: "Forms", icon: Inbox },
    { href: "/activity", label: "Activity", icon: Activity },
  ]},
];

/** Flat list of all nav items, for the command palette. */
export const ALL_NAV: NavItem[] = NAV_GROUPS.flatMap((g) => g.items);
