import type { AdminProfile, InvitationGroup, RsvpHistoryItem } from "@/lib/types";

export const sampleAdmins: AdminProfile[] = [
  {
    id: "admin-edward",
    email: "edward@example.com",
    displayName: "Edward",
    role: "super_admin"
  },
  {
    id: "admin-jessica",
    email: "jessica@example.com",
    displayName: "Jessica",
    role: "super_admin"
  }
];

export const sampleInvitations: InvitationGroup[] = [
  {
    id: "invite-hardwin",
    code: "EJ26-HARDWIN",
    greeting: "Dear Mr. Hardwin & Family",
    groupName: "Hardwin Family",
    phone: "+628123456789",
    email: "hardwin.family@example.com",
    side: "bride",
    privateNotes: {
      en: "Accommodation note: a limited room block can be requested through the family.",
      id: "Catatan akomodasi: kamar terbatas dapat diminta melalui keluarga."
    },
    eligibleEvents: ["holy_matrimony", "tea_lunch", "dinner"],
    openedAt: "2026-06-03T02:10:00.000Z",
    rsvp: {
      id: "rsvp-hardwin",
      invitationGroupId: "invite-hardwin",
      status: "pending",
      eventAttendance: {}
    },
    guests: [
      {
        id: "guest-hardwin-1",
        invitationGroupId: "invite-hardwin",
        name: "Hardwin Salim",
        mealPreference: "unset"
      },
      {
        id: "guest-hardwin-2",
        invitationGroupId: "invite-hardwin",
        name: "Masria Ang",
        mealPreference: "unset"
      }
    ]
  },
  {
    id: "invite-brilian",
    code: "EJ26-BRILIAN",
    greeting: "Dear Mr. Brilian & Family",
    groupName: "Brilian Family",
    phone: "+628987654321",
    side: "groom",
    eligibleEvents: ["holy_matrimony", "tea_lunch", "dinner"],
    openedAt: "2026-06-03T04:25:00.000Z",
    rsvp: {
      id: "rsvp-brilian",
      invitationGroupId: "invite-brilian",
      status: "attending",
      eventAttendance: {
        holy_matrimony: true,
        tea_lunch: true,
        dinner: true
      },
      submittedAt: "2026-06-03T04:28:00.000Z",
      updatedAt: "2026-06-03T04:28:00.000Z",
      updatedBy: "guest"
    },
    guests: [
      {
        id: "guest-brilian-1",
        invitationGroupId: "invite-brilian",
        name: "Brilian Moktar",
        mealPreference: "non_vegetarian"
      },
      {
        id: "guest-brilian-2",
        invitationGroupId: "invite-brilian",
        name: "Janice Jong",
        mealPreference: "vegetarian"
      }
    ]
  },
  {
    id: "invite-friends",
    code: "EJ26-X7K92",
    greeting: "Dear University Friends",
    groupName: "University Friends",
    side: "joint",
    eligibleEvents: ["dinner"],
    rsvp: {
      id: "rsvp-friends",
      invitationGroupId: "invite-friends",
      status: "declined",
      eventAttendance: {
        dinner: false
      },
      submittedAt: "2026-06-03T05:12:00.000Z",
      updatedAt: "2026-06-03T05:12:00.000Z",
      updatedBy: "guest"
    },
    guests: [
      {
        id: "guest-friends-1",
        invitationGroupId: "invite-friends",
        name: "University Friend",
        mealPreference: "unset"
      }
    ]
  }
];

export const sampleHistory: RsvpHistoryItem[] = [
  {
    id: "history-brilian-1",
    invitationGroupId: "invite-brilian",
    status: "attending",
    changedBy: "guest",
    changedAt: "2026-06-03T04:28:00.000Z",
    snapshot: sampleInvitations[1].rsvp
  },
  {
    id: "history-friends-1",
    invitationGroupId: "invite-friends",
    status: "declined",
    changedBy: "guest",
    changedAt: "2026-06-03T05:12:00.000Z",
    snapshot: sampleInvitations[2].rsvp
  }
];
