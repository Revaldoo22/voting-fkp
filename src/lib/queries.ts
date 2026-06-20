"use client";

import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  AdminStats,
  DailyVoteSeriesRow,
  ParticipantWithSchool,
  PointHistoryRow,
  Profile,
  Quest,
  School,
  Submission,
  TopSupporter,
  TopVoter,
  VoterGrowthRow,
} from "@/types/database";

// Lazy singleton — avoids constructing a client at module load (build-time
// prerender has no env vars).
let _sb: SupabaseClient | null = null;
function sb(): SupabaseClient {
  if (!_sb) _sb = createClient();
  return _sb;
}

// ----------------------------- Profile ------------------------------
export function useMyProfile() {
  return useQuery({
    queryKey: ["profile", "me"],
    queryFn: async (): Promise<Profile | null> => {
      const {
        data: { user },
      } = await sb().auth.getUser();
      if (!user) return null;
      const { data, error } = await sb()
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();
      if (error) throw error;
      return data as Profile;
    },
  });
}

// ----------------------------- Settings -----------------------------
export function useSettings() {
  return useQuery({
    queryKey: ["settings"],
    queryFn: async (): Promise<import("@/types/database").AppSettings | null> => {
      const { data, error } = await sb()
        .from("app_settings")
        .select("*")
        .maybeSingle();
      if (error) throw error;
      return data as import("@/types/database").AppSettings | null;
    },
  });
}

// ----------------------------- Schools ------------------------------
export function useSchools() {
  return useQuery({
    queryKey: ["schools"],
    queryFn: async (): Promise<School[]> => {
      const { data, error } = await sb()
        .from("schools")
        .select("*")
        .order("name");
      if (error) throw error;
      return data as School[];
    },
  });
}

/**
 * Schools that have at least one participant. Used in the voter login form —
 * a voter can only register for a school that already fields participants.
 */
export function useSchoolsWithParticipants() {
  return useQuery({
    queryKey: ["schools", "with-participants"],
    queryFn: async (): Promise<Pick<School, "id" | "name">[]> => {
      const { data, error } = await sb()
        .from("participants")
        .select("schools(id, name)")
        .eq("status", "active");
      if (error) throw error;
      const map = new Map<string, string>();
      for (const row of (data ?? []) as unknown as {
        schools: { id: string; name: string } | null;
      }[]) {
        if (row.schools) map.set(row.schools.id, row.schools.name);
      }
      return Array.from(map, ([id, name]) => ({ id, name })).sort((a, b) =>
        a.name.localeCompare(b.name)
      );
    },
  });
}

// --------------------------- Participants ----------------------------
/** RLS scopes the result: voters see only their school; anon sees all. */
export function useParticipants(schoolId?: string | null) {
  return useQuery({
    queryKey: ["participants", schoolId ?? "all"],
    queryFn: async (): Promise<ParticipantWithSchool[]> => {
      let q = sb()
        .from("participants")
        .select("*, schools(id, name), profiles(phone_number)")
        .order("total_points", { ascending: false });
      if (schoolId) q = q.eq("school_id", schoolId);
      const { data, error } = await q;
      if (error) throw error;
      return data as unknown as ParticipantWithSchool[];
    },
  });
}

export function useLeaderboard(limit = 50) {
  return useQuery({
    queryKey: ["leaderboard", limit],
    queryFn: async (): Promise<ParticipantWithSchool[]> => {
      const { data, error } = await sb()
        .from("participants")
        .select("*, schools(id, name)")
        .eq("status", "active")
        .order("total_points", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return data as unknown as ParticipantWithSchool[];
    },
  });
}

export function useMyParticipant() {
  return useQuery({
    queryKey: ["participant", "me"],
    queryFn: async (): Promise<ParticipantWithSchool | null> => {
      const {
        data: { user },
      } = await sb().auth.getUser();
      if (!user) return null;
      const { data, error } = await sb()
        .from("participants")
        .select("*, schools(id, name)")
        .eq("profile_id", user.id)
        .maybeSingle();
      if (error) throw error;
      return data as unknown as ParticipantWithSchool | null;
    },
  });
}

// ------------------------- Participant contents ----------------------
export function useParticipantContents(participantId?: string) {
  return useQuery({
    queryKey: ["participant-contents", participantId],
    enabled: !!participantId,
    queryFn: async (): Promise<
      import("@/types/database").ParticipantContent[]
    > => {
      const { data, error } = await sb()
        .from("participant_contents")
        .select("*")
        .eq("participant_id", participantId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as import("@/types/database").ParticipantContent[];
    },
  });
}

/**
 * content_ids already submitted (non-rejected) by this voter (by email) for a
 * given participant + quest — used to grey out done content options.
 */
export function useDoneContentIds(
  participantId: string,
  questId: string,
  email: string
) {
  return useQuery({
    queryKey: ["done-content", participantId, questId, email.toLowerCase()],
    enabled: !!participantId && !!questId && !!email,
    queryFn: async (): Promise<string[]> => {
      const { data, error } = await sb()
        .from("submissions")
        .select("content_id, status")
        .eq("participant_id", participantId)
        .eq("quest_id", questId)
        .eq("voter_email", email.trim().toLowerCase());
      if (error) throw error;
      return ((data ?? []) as { content_id: string | null; status: string }[])
        .filter((s) => s.status !== "rejected" && s.content_id)
        .map((s) => s.content_id as string);
    },
  });
}

/** The logged-in participant's own content links. */
export function useMyContents() {
  return useQuery({
    queryKey: ["my-contents"],
    queryFn: async (): Promise<
      import("@/types/database").ParticipantContent[]
    > => {
      const {
        data: { user },
      } = await sb().auth.getUser();
      if (!user) return [];
      const { data: p } = await sb()
        .from("participants")
        .select("id")
        .eq("profile_id", user.id)
        .maybeSingle();
      if (!p) return [];
      const { data, error } = await sb()
        .from("participant_contents")
        .select("*")
        .eq("participant_id", p.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as import("@/types/database").ParticipantContent[];
    },
  });
}

// ------------------------------ Quests -------------------------------
export function useQuests(activeOnly = false) {
  return useQuery({
    queryKey: ["quests", activeOnly],
    queryFn: async (): Promise<Quest[]> => {
      let q = sb().from("quests").select("*").order("created_at");
      if (activeOnly) q = q.eq("status", "active");
      const { data, error } = await q;
      if (error) throw error;
      return data as Quest[];
    },
  });
}

// --------------------------- Submissions -----------------------------
export function useSubmissions(status?: string) {
  return useQuery({
    queryKey: ["submissions", status ?? "all"],
    queryFn: async (): Promise<
      (Submission & {
        review_note: string | null;
        voter_name: string | null;
        voter_phone: string | null;
        voter_email: string | null;
        voter_status: string | null;
        voter_school: string | null;
        voter_class: string | null;
        participants: {
          name: string;
          school_id: string;
          schools: { name: string } | null;
        } | null;
        quests: { name: string; point: number; proof_type: string } | null;
        participant_contents: { url: string; kind: string } | null;
      })[]
    > => {
      let q = sb()
        .from("submissions")
        .select(
          "*, participants(name, school_id, schools(name)), quests(name, point, proof_type), participant_contents(url, kind)"
        )
        .order("created_at", { ascending: false });
      if (status) q = q.eq("status", status);
      const { data, error } = await q;
      if (error) throw error;
      return data as never;
    },
  });
}

export function useReviewSubmission() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      status,
      note,
    }: {
      id: string;
      status: "approved" | "rejected";
      note?: string;
    }) => {
      const { error } = await sb()
        .from("submissions")
        .update({ status, review_note: note ?? null })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["submissions"] });
      qc.invalidateQueries({ queryKey: ["participants"] });
      qc.invalidateQueries({ queryKey: ["leaderboard"] });
    },
  });
}

// ----------------------------- RPC reads -----------------------------
export function useAdminStats() {
  return useQuery({
    queryKey: ["admin-stats"],
    queryFn: async (): Promise<AdminStats> => {
      const { data, error } = await sb().rpc("admin_stats");
      if (error) throw error;
      return (Array.isArray(data) ? data[0] : data) as AdminStats;
    },
  });
}

export function useDailyVoteSeries(days = 14) {
  return useQuery({
    queryKey: ["daily-vote-series", days],
    queryFn: async (): Promise<DailyVoteSeriesRow[]> => {
      const { data, error } = await sb().rpc("daily_vote_series", {
        p_days: days,
      });
      if (error) throw error;
      return data as DailyVoteSeriesRow[];
    },
  });
}

export function useVoterGrowth(days = 14) {
  return useQuery({
    queryKey: ["voter-growth", days],
    queryFn: async (): Promise<VoterGrowthRow[]> => {
      const { data, error } = await sb().rpc("voter_growth_series", {
        p_days: days,
      });
      if (error) throw error;
      return data as VoterGrowthRow[];
    },
  });
}

export function usePointHistory(participantId?: string) {
  return useQuery({
    queryKey: ["point-history", participantId],
    enabled: !!participantId,
    queryFn: async (): Promise<PointHistoryRow[]> => {
      const { data, error } = await sb().rpc("participant_point_history", {
        p_participant_id: participantId,
      });
      if (error) throw error;
      return data as PointHistoryRow[];
    },
  });
}

export function useMyRank(participantId?: string) {
  return useQuery({
    queryKey: ["my-rank", participantId],
    enabled: !!participantId,
    queryFn: async (): Promise<number | null> => {
      const { data, error } = await sb().rpc("participant_rank", {
        p_participant_id: participantId,
      });
      if (error) throw error;
      return (data as number) ?? null;
    },
  });
}

export function useTopSupporters(participantId?: string) {
  return useQuery({
    queryKey: ["top-supporters", participantId],
    enabled: !!participantId,
    queryFn: async (): Promise<TopSupporter[]> => {
      const { data, error } = await sb().rpc("top_supporters", {
        p_participant_id: participantId,
        p_limit: 5,
      });
      if (error) throw error;
      return data as TopSupporter[];
    },
  });
}

export function useTopVoters(limit = 5) {
  return useQuery({
    queryKey: ["top-voters", limit],
    queryFn: async (): Promise<TopVoter[]> => {
      const { data, error } = await sb().rpc("top_voters", {
        p_limit: limit,
      });
      if (error) throw error;
      return data as TopVoter[];
    },
  });
}

