import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import {
  GraduationCap, MapPin, Cake, Users, School, Heart, Sparkles,
  LogOut, Pencil, Loader2, ArrowLeft,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({ meta: [{ title: "My profile — SchoolConnect" }] }),
  component: ProfilePage,
});

type Profile = Tables<"profiles">;
type Questionnaire = Tables<"student_questionnaire">;

function ProfilePage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [q, setQ] = useState<Questionnaire | null>(null);
  const [email, setEmail] = useState("");

  useEffect(() => {
    (async () => {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      setEmail(userData.user?.email ?? "");
      if (!uid) return;
      const [{ data: p }, { data: qq }] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", uid).maybeSingle(),
        supabase.from("student_questionnaire").select("*").eq("user_id", uid).maybeSingle(),
      ]);
      setProfile(p);
      setQ(qq);
      setLoading(false);
      if (p && !p.onboarded) navigate({ to: "/onboarding" });
    })();
  }, [navigate]);

  async function signOut() {
    await supabase.auth.signOut();
    toast.success("Signed out");
    navigate({ to: "/", replace: true });
  }

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center hero-surface">
        <Loader2 className="h-6 w-6 animate-spin text-[color:var(--brand)]" />
      </div>
    );
  }

  const initials = (profile?.full_name || email || "S")
    .split(" ").map(s => s[0]).join("").slice(0, 2).toUpperCase();

  return (
    <div className="min-h-screen hero-surface pb-16">
      <div className="mx-auto w-[min(1100px,94%)] py-6">
        <div className="flex items-center justify-between">
          <Link to="/" className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Home
          </Link>
          <div className="flex items-center gap-2">
            <Link to="/onboarding" className="inline-flex items-center gap-2 rounded-full border bg-background/60 px-4 py-2 text-sm font-semibold hover:bg-muted">
              <Pencil className="h-4 w-4" /> Edit
            </Link>
            <button onClick={signOut} className="inline-flex items-center gap-2 rounded-full border bg-background/60 px-4 py-2 text-sm font-semibold hover:bg-muted">
              <LogOut className="h-4 w-4" /> Sign out
            </button>
          </div>
        </div>

        {/* Header card */}
        <div className="glass relative mt-6 overflow-hidden rounded-[2rem] p-1">
          <div className="h-40 rounded-[1.75rem] gradient-brand sm:h-52" />
          <div className="grid gap-6 px-6 pb-8 pt-4 sm:grid-cols-[auto_1fr_auto] sm:items-end sm:px-8">
            <div className="-mt-16 grid h-28 w-28 place-items-center rounded-full border-4 border-background gradient-brand text-3xl font-black text-primary-foreground shadow-brand sm:h-32 sm:w-32">
              {profile?.avatar_url
                ? <img src={profile.avatar_url} alt="" className="h-full w-full rounded-full object-cover" />
                : initials}
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-3xl font-black tracking-tight sm:text-4xl">
                {profile?.full_name || "Your name"}
              </h1>
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                {profile?.username && <span>@{profile.username}</span>}
                {profile?.school_name && (
                  <span className="inline-flex items-center gap-1"><School className="h-4 w-4" />{profile.school_name}</span>
                )}
                {profile?.school_type && (
                  <span className="rounded-full bg-[color:var(--brand)]/10 px-2 py-0.5 text-xs font-semibold uppercase tracking-wider text-[color:var(--brand)]">
                    {profile.school_type}
                  </span>
                )}
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3 text-center">
              {[["0","Friends"],["0","Posts"],["0","Followers"]].map(([n,l]) => (
                <div key={l} className="glass rounded-2xl px-4 py-3">
                  <div className="text-lg font-black">{n}</div>
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{l}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-3">
          <section className="glass rounded-3xl p-6 lg:col-span-1">
            <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Basics</h3>
            <ul className="mt-4 grid gap-3 text-sm">
              <Row icon={GraduationCap} label="School" value={profile?.school_name} />
              <Row icon={Users} label="Class / Grade" value={profile?.grade_class} />
              <Row icon={Cake} label="Birthday" value={profile?.date_of_birth} />
              <Row icon={MapPin} label="Location" value={[profile?.city, profile?.region, profile?.country].filter(Boolean).join(", ")} />
              <Row icon={Users} label="Email" value={email} />
              {profile?.graduation_year && <Row icon={GraduationCap} label="Graduation" value={String(profile.graduation_year)} />}
            </ul>
          </section>

          <section className="glass rounded-3xl p-6 lg:col-span-2">
            <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">About me</h3>
            {q ? (
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <QCard icon={Sparkles} label="Favorite subjects" value={q.favorite_subjects} />
                <QCard icon={Heart} label="Hobbies" value={q.hobbies} />
                <QCard icon={Sparkles} label="Inspiration" value={q.inspiration} />
                <QCard icon={GraduationCap} label="Career goal" value={q.career_goal} />
                <QCard icon={Users} label="Clubs & activities" value={q.clubs_activities} />
                <QCard icon={Heart} label="Reconnect w/ classmates" value={q.reconnect_classmates ? "Yes, please 🙌" : "Not right now"} />
                {q.message_to_students && (
                  <div className="sm:col-span-2 rounded-2xl gradient-brand p-5 text-primary-foreground shadow-brand">
                    <div className="text-xs font-bold uppercase tracking-wider opacity-80">Message to students</div>
                    <p className="mt-2 text-lg font-semibold leading-snug">"{q.message_to_students}"</p>
                  </div>
                )}
              </div>
            ) : (
              <p className="mt-4 text-sm text-muted-foreground">Complete the onboarding to fill this out.</p>
            )}
          </section>
        </div>

        <div className="glass mt-6 flex flex-col items-start justify-between gap-4 rounded-3xl p-6 sm:flex-row sm:items-center">
          <div>
            <div className="text-lg font-bold">More coming soon</div>
            <p className="text-sm text-muted-foreground">Feed, chat, stories, communities and news are on the way.</p>
          </div>
          <Link to="/" className="rounded-full border px-5 py-2 text-sm font-semibold hover:bg-muted">Explore landing</Link>
        </div>
      </div>
    </div>
  );
}

function Row({ icon: Icon, label, value }: { icon: any; label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <li className="flex items-start gap-3">
      <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-muted text-[color:var(--brand)]">
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</div>
        <div className="truncate font-medium">{value}</div>
      </div>
    </li>
  );
}

function QCard({ icon: Icon, label, value }: { icon: any; label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div className="rounded-2xl border bg-background/60 p-4 backdrop-blur">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        <Icon className="h-4 w-4 text-[color:var(--brand)]" /> {label}
      </div>
      <div className="mt-1.5 font-semibold">{value}</div>
    </div>
  );
}
