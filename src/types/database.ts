// Hand-maintained Supabase types. Regenerate with the Supabase CLI:
//   supabase gen types typescript --project-id <id> > src/types/database.ts

export type Role = "admin" | "participant" | "voter";
export type ParticipantStatus = "active" | "inactive";
export type SubmissionStatus = "pending" | "approved" | "rejected";
export type QuestStatus = "active" | "inactive";

export interface School {
  id: string;
  name: string;
  created_at: string;
}

export interface AppSettings {
  id: boolean;
  event_open: boolean;
  closed_message: string;
  ip_daily_limit: number;
  updated_at: string;
}

export interface Profile {
  id: string;
  name: string;
  phone_number: string;
  school_id: string | null;
  role: Role;
  device_fingerprint: string | null;
  created_at: string;
}

export interface Participant {
  id: string;
  profile_id: string | null;
  name: string;
  school_id: string;
  photo_url: string | null;
  description: string | null;
  total_points: number;
  status: ParticipantStatus;
  created_at: string;
}

export type ProofType = "link" | "file";
export type QuestFrequency = "once" | "daily" | "global";
export type ContentKind = "engage" | "sound";

export interface ParticipantContent {
  id: string;
  participant_id: string;
  kind: ContentKind;
  url: string;
  label: string | null;
  created_at: string;
}

export interface Quest {
  id: string;
  name: string;
  description: string | null;
  point: number;
  status: QuestStatus;
  proof_type: ProofType;
  frequency: QuestFrequency;
  content_kind: ContentKind | null;
  ref_link: string | null;
  ref_image: string | null;
  created_at: string;
}

export interface Submission {
  id: string;
  user_id: string | null;
  participant_id: string;
  quest_id: string;
  content_id: string | null;
  proof_url: string;
  status: SubmissionStatus;
  review_note: string | null;
  voter_name: string | null;
  voter_phone: string | null;
  voter_email: string | null;
  voter_status: string | null;
  voter_school: string | null;
  voter_class: string | null;
  submit_date: string;
  created_at: string;
}

export interface DailyVote {
  id: string;
  user_id: string;
  participant_id: string;
  device_fingerprint: string;
  vote_date: string;
  created_at: string;
}

// RPC return shapes
export interface AdminStats {
  total_schools: number;
  total_participants: number;
  total_voters: number;
  total_votes: number;
  total_points: number;
}

export interface PointHistoryRow {
  day: string;
  points: number;
  cumulative: number;
}

export interface TopSupporter {
  voter_name: string;
  voter_status: string | null;
  votes: number;
  points: number;
}

export interface TopVoter {
  voter_name: string;
  school_name: string | null;
  votes: number;
  quests: number;
  score: number;
}

export interface DailyVoteSeriesRow {
  day: string;
  votes: number;
}

export interface VoterGrowthRow {
  day: string;
  cumulative: number;
}

// Joined view used in UI lists
export type ParticipantWithSchool = Participant & {
  schools: Pick<School, "id" | "name"> | null;
  // Only readable by admin (RLS); the participant's login phone number.
  profiles?: { phone_number: string } | null;
};
