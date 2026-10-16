/** Labels for each record module (one generic table on the API side). */
export const RECORD_MODULES = {
  enquiry: {
    label: "Enquiries",
    titleLabel: "Enquirer name",
    descriptionLabel: "Message",
    itemName: "enquiry",
    itemPlural: "enquiries",
    categories: {
      preincubation: { label: "Pre-Incubation enquiries", path: "/admin/pre-incubation/enquiries" },
      incubation: { label: "Incubation enquiries", path: "/admin/incubation/enquiries" },
      internship: { label: "Internship enquiries", path: "/admin/internship/enquiries" },
    },
    description: "Questions from prospective applicants — from the public website or logged by staff.",
  },
  events: {
    label: "Events",
    titleLabel: "Event name",
    descriptionLabel: "Details",
    itemName: "event",
    itemPlural: "events",
    categories: {
      upcoming: { label: "Upcoming events" },
      past: { label: "Past events" },
      registrations: { label: "Event registrations" },
    },
    description: "Bootcamps, talks and workshops.",
  },
  mou: {
    label: "MoU",
    titleLabel: "Partner organisation",
    descriptionLabel: "Scope of the MoU",
    itemName: "MoU",
    itemPlural: "MoUs",
    categories: {
      active: { label: "Active MoUs" },
      pending: { label: "Pending / draft MoUs" },
      expired: { label: "Expired MoUs" },
    },
    description: "Partnerships and agreements.",
  },
  aim: {
    label: "AIM",
    titleLabel: "Title",
    descriptionLabel: "Details",
    itemName: "AIM record",
    itemPlural: "AIM records",
    categories: {
      grants: { label: "Grants & funding" },
      compliance: { label: "Compliance & reporting" },
      milestones: { label: "Milestones" },
    },
    description: "Atal Innovation Mission grants, compliance and milestones.",
  },
  sisfs: {
    label: "SISFS Scheme",
    titleLabel: "Startup / title",
    descriptionLabel: "Details",
    itemName: "SISFS record",
    itemPlural: "SISFS records",
    categories: {
      applications: { label: "Applications" },
      disbursements: { label: "Disbursements" },
      utilization: { label: "Utilization reports" },
    },
    description: "Startup India Seed Fund Scheme.",
  },
  coworking: {
    label: "Coworking area",
    titleLabel: "Occupant / startup",
    descriptionLabel: "Details",
    itemName: "coworking record",
    itemPlural: "coworking records",
    categories: {
      allotments: { label: "Seat allotments" },
      requests: { label: "Requests / waitlist" },
      usage: { label: "Usage log" },
    },
    description: "Seats and cabins.",
  },
  facility: {
    label: "Device / facility use",
    titleLabel: "Equipment / booking",
    descriptionLabel: "Details",
    itemName: "facility record",
    itemPlural: "facility records",
    categories: {
      inventory: { label: "Equipment inventory" },
      bookings: { label: "Booking requests" },
      usage: { label: "Usage log" },
    },
    description: "Shared equipment and its use.",
  },
};

export function recordPath(module, category) {
  return RECORD_MODULES[module]?.categories[category]?.path || `/admin/records/${module}/${category}`;
}
