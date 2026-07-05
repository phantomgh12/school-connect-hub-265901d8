import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { GraduationCap, Loader2, ArrowRight, ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/_authenticated/onboarding")({
  head: () => ({ meta: [{ title: "Set up your profile — SchoolConnect" }] }),
  component: OnboardingPage,
});

const SCHOOL_TYPES = [
  { v: "primary", l: "Primary" }, { v: "jhs", l: "JHS" },
  { v: "shs", l: "SHS" }, { v: "technical", l: "Technical / Vocational" },
  { v: "university", l: "University" }, { v: "alumni", l: "Alumni" },
] as const;

type Step1 = {
  username: string; phone: string; date_of_birth: string; gender: string;
  country: string; region: string; city: string;
};
type Step2 = {
  school_name: string; school_type: string;
  grade_class: string; graduation_year: string;
};
type Step3 = {
  favorite_subjects: string; hobbies: string; inspiration: string;
  career_goal: string; clubs_activities: string;
  reconnect_classmates: boolean; message_to_students: string;
};

const step1Schema = z.object({
  username: z.string().trim().min(3, "Min 3 characters").max(24, "Max 24").regex(/^[a-zA-Z0-9_.]+$/, "Letters, numbers, _ or . only"),
  date_of_birth: z.string().min(1, "Required"),
  country: z.string().trim().min(1, "Required").max(60),
  region: z.string().trim().max(60).optional(),
  city: z.string().trim().max(60).optional(),
  phone: z.string().trim().max(20).optional(),
  gender: z.string().max(20).optional(),
});
const step2Schema = z.object({
  school_name: z.string().trim().min(2).max(120),
  school_type: z.enum(["primary","jhs","shs","technical","university","alumni"]),
  grade_class: z.string().trim().max(40).optional(),
  graduation_year: z.string().regex(/^\d{0,4}$/).optional(),
});

function OnboardingPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [s1, setS1] = useState<Step1>({
    username: "", phone: "", date_of_birth: "", gender: "",
    country: "", region: "", city: "",
  });
  const [s2, setS2] = useState<Step2>({
    school_name: "", school_type: "", grade_class: "", graduation_year: "",
  });
  const [s3, setS3] = useState<Step3>({
    favorite_subjects: "", hobbies: "", inspiration: "",
    career_goal: "", clubs_activities: "",
    reconnect_classmates: true, message_to_students: "",
  });

  useEffect(() => { window.scrollTo(0, 0); }, [step]);

  function next() {
    setErrors({});
    if (step === 0) {
      const r = step1Schema.safeParse(s1);
      if (!r.success) { setErrors(zerr(r.error)); return; }
    }
    if (step === 1) {
      const r = step2Schema.safeParse(s2);
      if (!r.success) { setErrors(zerr(r.error)); return; }
    }
    setStep(step + 1);
  }

  async function submit() {
    setSaving(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) throw new Error("Not signed in");

      const { error: pErr } = await supabase.from("profiles").upsert({
        id: uid,
        username: s1.username || null,
        phone: s1.phone || null,
        date_of_birth: s1.date_of_birth || null,
        gender: s1.gender || null,
        country: s1.country || null,
        region: s1.region || null,
        city: s1.city || null,
        school_name: s2.school_name || null,
        school_type: (s2.school_type || null) as any,
        grade_class: s2.grade_class || null,
        graduation_year: s2.graduation_year ? Number(s2.graduation_year) : null,
        onboarded: true,
      }, { onConflict: "id" });
      if (pErr) throw pErr;

      const { error: qErr } = await supabase.from("student_questionnaire").upsert({
        user_id: uid,
        school: s2.school_name || null,
        level: s2.school_type || null,
        class_grade: s2.grade_class || null,
        favorite_subjects: s3.favorite_subjects || null,
        hobbies: s3.hobbies || null,
        inspiration: s3.inspiration || null,
        career_goal: s3.career_goal || null,
        clubs_activities: s3.clubs_activities || null,
        reconnect_classmates: s3.reconnect_classmates,
        message_to_students: s3.message_to_students || null,
      }, { onConflict: "user_id" });
      if (qErr) throw qErr;

      toast.success("Profile ready! Welcome to SchoolConnect 🎉");
      navigate({ to: "/profile" });
    } catch (err: any) {
      toast.error(err?.message ?? "Could not save your profile");
    } finally { setSaving(false); }
  }

  return (
    <div className="min-h-screen hero-surface">
      <div className="mx-auto w-[min(760px,94%)] py-8">
        <Link to="/" className="flex items-center gap-2">
          <div className="grid h-9 w-9 place-items-center rounded-xl gradient-brand shadow-brand">
            <GraduationCap className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="text-lg font-extrabold">SchoolConnect</span>
        </Link>

        <div className="mt-8 flex items-center gap-2 text-xs font-semibold text-muted-foreground">
          {["About you", "Your school", "You unfiltered"].map((label, i) => (
            <div key={label} className="flex flex-1 items-center gap-2">
              <div className={`grid h-7 w-7 place-items-center rounded-full text-[11px] ${i <= step ? "gradient-brand text-primary-foreground shadow-brand" : "bg-muted"}`}>{i + 1}</div>
              <span className={i === step ? "text-foreground" : ""}>{label}</span>
              {i < 2 && <div className={`h-0.5 flex-1 rounded-full ${i < step ? "gradient-brand" : "bg-muted"}`} />}
            </div>
          ))}
        </div>

        <div className="glass mt-6 rounded-3xl p-6 sm:p-8">
          {step === 0 && (
            <>
              <h2 className="text-2xl font-black">Tell us about you</h2>
              <p className="mt-1 text-sm text-muted-foreground">This helps friends find you.</p>
              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <F label="Username *" err={errors.username}>
                  <input className="input" value={s1.username} onChange={e => setS1({ ...s1, username: e.target.value })} placeholder="ama_23" />
                </F>
                <F label="Phone (optional)"><input className="input" value={s1.phone} onChange={e => setS1({ ...s1, phone: e.target.value })} /></F>
                <F label="Date of birth *" err={errors.date_of_birth}>
                  <input type="date" className="input" value={s1.date_of_birth} onChange={e => setS1({ ...s1, date_of_birth: e.target.value })} />
                </F>
                <F label="Gender (optional)">
                  <select className="input" value={s1.gender} onChange={e => setS1({ ...s1, gender: e.target.value })}>
                    <option value="">Prefer not to say</option>
                    <option>Female</option><option>Male</option><option>Non-binary</option><option>Other</option>
                  </select>
                </F>
                <F label="Country *" err={errors.country}><input className="input" value={s1.country} onChange={e => setS1({ ...s1, country: e.target.value })} placeholder="Ghana" /></F>
                <F label="Region / State"><input className="input" value={s1.region} onChange={e => setS1({ ...s1, region: e.target.value })} placeholder="Greater Accra" /></F>
                <F label="City"><input className="input" value={s1.city} onChange={e => setS1({ ...s1, city: e.target.value })} placeholder="Accra" /></F>
              </div>
            </>
          )}

          {step === 1 && (
            <>
              <h2 className="text-2xl font-black">Your school</h2>
              <p className="mt-1 text-sm text-muted-foreground">Where you are now (or last attended, for alumni).</p>
              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <F label="School name *" err={errors.school_name}><input className="input" value={s2.school_name} onChange={e => setS2({ ...s2, school_name: e.target.value })} placeholder="Achimota SHS" /></F>
                <F label="School type *" err={errors.school_type}>
                  <select className="input" value={s2.school_type} onChange={e => setS2({ ...s2, school_type: e.target.value })}>
                    <option value="">Choose…</option>
                    {SCHOOL_TYPES.map(x => <option key={x.v} value={x.v}>{x.l}</option>)}
                  </select>
                </F>
                <F label="Class / Grade / Form"><input className="input" value={s2.grade_class} onChange={e => setS2({ ...s2, grade_class: e.target.value })} placeholder="SHS 3, Form 3, JHS 2…" /></F>
                <F label="Graduation year (optional)"><input inputMode="numeric" className="input" value={s2.graduation_year} onChange={e => setS2({ ...s2, graduation_year: e.target.value.replace(/\D/g, "").slice(0,4) })} placeholder="2027" /></F>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <h2 className="text-2xl font-black">You, unfiltered</h2>
              <p className="mt-1 text-sm text-muted-foreground">A little about the real you. All optional.</p>
              <div className="mt-6 grid gap-4">
                <F label="Favorite subjects"><input className="input" value={s3.favorite_subjects} onChange={e => setS3({ ...s3, favorite_subjects: e.target.value })} placeholder="Maths, Literature, Biology" /></F>
                <F label="Hobbies"><input className="input" value={s3.hobbies} onChange={e => setS3({ ...s3, hobbies: e.target.value })} placeholder="Football, drawing, coding" /></F>
                <div className="grid gap-4 sm:grid-cols-2">
                  <F label="Who inspires you most?"><input className="input" value={s3.inspiration} onChange={e => setS3({ ...s3, inspiration: e.target.value })} placeholder="My mom, Serena, …" /></F>
                  <F label="Career you want"><input className="input" value={s3.career_goal} onChange={e => setS3({ ...s3, career_goal: e.target.value })} placeholder="Doctor, Engineer…" /></F>
                </div>
                <F label="Clubs & activities"><input className="input" value={s3.clubs_activities} onChange={e => setS3({ ...s3, clubs_activities: e.target.value })} placeholder="Debate club, Choir…" /></F>
                <F label="Message to other students">
                  <textarea rows={3} className="input" value={s3.message_to_students} onChange={e => setS3({ ...s3, message_to_students: e.target.value })} placeholder="Say hi to the community 👋" />
                </F>
                <label className="glass flex cursor-pointer items-center gap-3 rounded-2xl p-4">
                  <input type="checkbox" checked={s3.reconnect_classmates} onChange={e => setS3({ ...s3, reconnect_classmates: e.target.checked })} className="h-5 w-5 accent-[color:var(--brand)]" />
                  <span className="text-sm">Yes, help me reconnect with former classmates.</span>
                </label>
              </div>
            </>
          )}

          <div className="mt-8 flex items-center justify-between gap-3">
            {step > 0 ? (
              <button onClick={() => setStep(step - 1)} className="inline-flex items-center gap-2 rounded-full border px-5 py-2.5 text-sm font-semibold hover:bg-muted">
                <ArrowLeft className="h-4 w-4" /> Back
              </button>
            ) : <span />}
            {step < 2 ? (
              <button onClick={next} className="inline-flex items-center gap-2 rounded-full gradient-brand px-6 py-2.5 text-sm font-bold text-primary-foreground shadow-brand">
                Continue <ArrowRight className="h-4 w-4" />
              </button>
            ) : (
              <button onClick={submit} disabled={saving} className="inline-flex items-center gap-2 rounded-full gradient-brand px-6 py-2.5 text-sm font-bold text-primary-foreground shadow-brand disabled:opacity-60">
                {saving && <Loader2 className="h-4 w-4 animate-spin" />} Finish & explore
              </button>
            )}
          </div>
        </div>
      </div>

      <style>{`
        .input {
          width: 100%; border-radius: 0.9rem; border: 1px solid var(--color-input);
          background: var(--color-background); padding: 0.65rem 0.85rem;
          font-size: 0.95rem; outline: none; transition: border-color .15s, box-shadow .15s;
        }
        .input:focus { border-color: var(--color-ring); box-shadow: 0 0 0 4px oklch(0.55 0.22 275 / 0.15); }
      `}</style>
    </div>
  );
}

function F({ label, err, children }: { label: string; err?: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-1.5">
      <span className="text-xs font-semibold text-muted-foreground">{label}</span>
      {children}
      {err && <span className="text-xs text-destructive">{err}</span>}
    </label>
  );
}

function zerr(err: z.ZodError) {
  const o: Record<string, string> = {};
  err.issues.forEach(i => { o[i.path[0] as string] = i.message; });
  return o;
}
