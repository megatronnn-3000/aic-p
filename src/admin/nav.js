import {
  Armchair,
  Briefcase,
  Building2,
  CalendarDays,
  Handshake,
  Landmark,
  LayoutDashboard,
  Sprout,
  Target,
  Wrench,
} from "lucide-react";
import { RECORD_MODULES, recordPath } from "../lib/records";

export const MODULE_ICONS = {
  events: CalendarDays,
  mou: Handshake,
  aim: Target,
  sisfs: Landmark,
  coworking: Armchair,
  facility: Wrench,
};

const moduleGroup = (module, icon = MODULE_ICONS[module]) => ({
  id: module,
  label: RECORD_MODULES[module].label,
  icon,
  base: `/admin/records/${module}`,
  children: Object.entries(RECORD_MODULES[module].categories).map(([category, meta]) => ({
    label: meta.label,
    to: recordPath(module, category),
  })),
});

/** Sidebar structure. `count` names a key in the nav-count summary. */
export const NAV = [
  { type: "link", label: "Dashboard", to: "/admin", icon: LayoutDashboard, end: true },
  { type: "section", label: "Programs" },
  {
    id: "preincubation",
    label: "Pre-Incubation",
    icon: Sprout,
    base: "/admin/pre-incubation",
    children: [
      { label: "Applications", to: "/admin/pre-incubation/applications", count: "preincubation" },
      { label: "Pre-incubated startups", to: "/admin/pre-incubation/startups" },
      { label: "Graduated", to: "/admin/pre-incubation/graduated" },
      { label: "Enquiries", to: "/admin/pre-incubation/enquiries", count: "enquiry_preincubation" },
    ],
  },
  {
    id: "incubation",
    label: "Incubation",
    icon: Building2,
    base: "/admin/incubation",
    children: [
      { label: "Applications", to: "/admin/incubation/applications", count: "incubation" },
      { label: "Leaderboard", to: "/admin/incubation/leaderboard" },
      { label: "Incubated startups", to: "/admin/incubation/startups" },
      { label: "Graduated", to: "/admin/incubation/graduated" },
      { label: "Enquiries", to: "/admin/incubation/enquiries", count: "enquiry_incubation" },
    ],
  },
  {
    id: "internship",
    label: "Internship",
    icon: Briefcase,
    base: "/admin/internship",
    children: [
      { label: "Applications", to: "/admin/internship/applications", count: "internship" },
      { label: "Current interns", to: "/admin/internship/interns" },
      { label: "Past interns", to: "/admin/internship/past" },
      { label: "Enquiries", to: "/admin/internship/enquiries", count: "enquiry_internship" },
    ],
  },
  { type: "section", label: "Programs & schemes" },
  moduleGroup("events", CalendarDays),
  moduleGroup("mou", Handshake),
  moduleGroup("aim", Target),
  moduleGroup("sisfs", Landmark),
  { type: "section", label: "Facilities" },
  moduleGroup("coworking", Armchair),
  moduleGroup("facility", Wrench),
];

/** Pending-work counts shown as badges in the sidebar. */
export function navCounts(summary) {
  if (!summary) return {};
  return {
    preincubation: summary.preincubation.by_status.Pending || 0,
    incubation: summary.incubation.by_status.Pending || 0,
    internship: summary.internship.by_status.Applied || 0,
    enquiry_preincubation: summary.open_enquiries.preincubation || 0,
    enquiry_incubation: summary.open_enquiries.incubation || 0,
    enquiry_internship: summary.open_enquiries.internship || 0,
  };
}
