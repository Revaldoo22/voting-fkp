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
        profiles: { name: string } | null;
        participants: {
          name: string;
          school_id: string;
          schools: { name: string } | null;
        } | null;
        quests: { name: string; point: number; proof_type: string } | null;
      })[]
    > => {
      let q = sb()
        .from("submissions")
        .select(
          "*, profiles(name), participants(name, school_id, schools(name)), quests(name, point, proof_type)"
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

export type ActivityItem = {
  kind: "vote" | "quest";
  participant_name: string;
  label: string;
  points: number;
  status: string;
  note?: string | null;
  date: string;
};

/** Full activity history of the current voter (votes + quest submissions). */
export function useMyActivity() {
  return useQuery({
    queryKey: ["my-activity"],
    queryFn: async (): Promise<ActivityItem[]> => {
      const {
        data: { user },
      } = await sb().auth.getUser();
      if (!user) return [];

      const [votes, subs] = await Promise.all([
        sb()
          .from("daily_votes")
          .select("vote_date, created_at, participants(name)")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false }),
        sb()
          .from("submissions")
          .select(
            "status, review_note, created_at, participants(name), quests(name, point)"
          )
          .eq("user_id", user.id)
          .order("created_at", { ascending: false }),
      ]);
      if (votes.error) throw votes.error;
      if (subs.error) throw subs.error;

      const items: ActivityItem[] = [];
      for (const v of (votes.data ?? []) as never[]) {
        const r = v as { created_at: string; participants: { name: string } | null };
        items.push({
          kind: "vote",
          participant_name: r.participants?.name ?? "—",
          label: "Vote harian",
          points: 5,
          status: "approved",
          date: r.created_at,
        });
      }
      for (const s of (subs.data ?? []) as never[]) {
        const r = s as {
          status: string;
          review_note: string | null;
          created_at: string;
          participants: { name: string } | null;
          quests: { name: string; point: number } | null;
        };
        items.push({
          kind: "quest",
          participant_name: r.participants?.name ?? "—",
          label: r.quests?.name ?? "Quest",
          points: r.quests?.point ?? 0,
          status: r.status,
          note: r.review_note,
          date: r.created_at,
        });
      }
      items.sort((a, b) => (a.date < b.date ? 1 : -1));
      return items;
    },
  });
}

/** Total points the voter has contributed, overall and per participant. */
export function useMyContributions() {
  return useQuery({
    queryKey: ["my-contributions"],
    queryFn: async (): Promise<{
      total: number;
      perParticipant: { name: string; points: number }[];
    }> => {
      const {
        data: { user },
      } = await sb().auth.getUser();
      if (!user) return { total: 0, perParticipant: [] };

      const [votes, subs] = await Promise.all([
        sb()
          .from("daily_votes")
          .select("participants(name)")
          .eq("user_id", user.id),
        sb()
          .from("submissions")
          .select("participants(name), quests(point)")
          .eq("user_id", user.id)
          .eq("status", "approved"),
      ]);
      if (votes.error) throw votes.error;
      if (subs.error) throw subs.error;

      const map = new Map<string, number>();
      const add = (name: string, pts: number) =>
        map.set(name, (map.get(name) ?? 0) + pts);

      for (const v of (votes.data ?? []) as never[]) {
        const r = v as { participants: { name: string } | null };
        add(r.participants?.name ?? "—", 5);
      }
      for (const s of (subs.data ?? []) as never[]) {
        const r = s as {
          participants: { name: string } | null;
          quests: { point: number } | null;
        };
        add(r.participants?.name ?? "—", r.quests?.point ?? 0);
      }

      const perParticipant = Array.from(map, ([name, points]) => ({
        name,
        points,
      })).sort((a, b) => b.points - a.points);
      const total = perParticipant.reduce((s, p) => s + p.points, 0);
      return { total, perParticipant };
    },
  });
}

/** Whether the current user already voted today. */
export function useMyVoteToday() {
  return useQuery({
    queryKey: ["my-vote-today"],
    queryFn: async (): Promise<{ voted: boolean; participant_id?: string }> => {
      const {
        data: { user },
      } = await sb().auth.getUser();
      if (!user) return { voted: false };
      const today = new Date().toISOString().slice(0, 10);
      const { data, error } = await sb()
        .from("daily_votes")
        .select("participant_id")
        .eq("user_id", user.id)
        .eq("vote_date", today)
        .maybeSingle();
      if (error) throw error;
      return data
        ? { voted: true, participant_id: data.participant_id }
        : { voted: false };
    },
  });
}
