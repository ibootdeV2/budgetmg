import { LayoutDashboard, ArrowRightLeft, CalendarRange, Target } from "lucide-react";

export const navItems = [
  { to: "/", label: "Tableau de bord", shortLabel: "Accueil", icon: LayoutDashboard, end: true },
  { to: "/transactions", label: "Transactions", shortLabel: "Transactions", icon: ArrowRightLeft },
  { to: "/budget", label: "Budget annuel", shortLabel: "Budget", icon: CalendarRange },
  { to: "/objectifs", label: "Objectifs", shortLabel: "Objectifs", icon: Target },
];
