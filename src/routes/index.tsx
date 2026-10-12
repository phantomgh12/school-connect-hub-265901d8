import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { ArrowRight, ArrowUpRight, GraduationCap, Users, MessageCircle, Trophy, ShieldCheck, BookOpen, Activity, RefreshCw, Check, Menu, X } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { getCommunityStats } from "@/lib/community-stats.functions";

const statsOptions = queryOptions({ queryKey: ["public-community-stats"], queryFn: () => getCommunityStats(), staleTime: 60_000, retry: false });

export const Route = createFileRoute("/")({
  head: () => ({ meta: [
    { title: "SchoolConnect — Your school. Your people." },
    { name: "description", content: "Meet classmates and alumni, join your school community, share moments and grow together on SchoolConnect. Explore honest, live community totals." },
    { property: "og:title", content: "SchoolConnect — Your school. Your people." },
    { property: "og:description", content: "A place for students and alumni to connect, share and belong. Join your school community on SchoolConnect." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  loader: ({ context }) => context.queryClient.ensureQueryData(statsOptions),
  component: Landing,
});

function JoinButton({ children = "Find your people", className = "" }: { children?: React.ReactNode; className?: string }) {
  return <Button asChild size="lg" className={`h-12 gap-3 ${className}`}><Link to="/auth" search={{ mode: "signup" }}>{children}<ArrowRight /></Link></Button>;
}

function Landing() {
  const [menuOpen, setMenuOpen] = useState(false);
  const navigate = useNavigate();
  useEffect(() => {
    // Auto sign-in: returning members with a saved session skip the landing page.
    supabase.auth.getSession().then(async ({ data }) => {
      const uid = data.session?.user.id;
      if (!uid) return;
      const { data: p } = await supabase.from("profiles").select("onboarded").eq("id", uid).maybeSingle();
      navigate({ to: p?.onboarded ? "/home" : "/onboarding", replace: true });
    });
  }, [navigate]);
  const { data: stats, refetch, isFetching } = useSuspenseQuery(statsOptions);
  const metricItems = [
    { key: "members", label: "Community members", icon: Users },
    { key: "schools", label: "Schools represented", icon: GraduationCap },
    { key: "posts", label: "Public posts shared", icon: MessageCircle },
    { key: "friendships", label: "Friendships connected", icon: BookOpen },
  ] as const;
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto grid h-20 max-w-6xl grid-cols-[minmax(0,1fr)_auto] items-center gap-4 lg:flex lg:justify-between px-5 sm:px-8">
          <Link to="/" className="flex min-w-0 items-center gap-2.5 whitespace-nowrap font-display text-base font-bold"><GraduationCap className="h-7 w-7 text-primary" />SchoolConnect<span className="hidden border-l border-border pl-3 text-xs font-normal text-muted-foreground lg:inline">GH SCHOOL HUB</span></Link>
          <nav aria-label="Main navigation" className="hidden items-center gap-6 lg:flex">
            <a href="#community" className="text-sm text-muted-foreground hover:text-foreground">Our community</a>
            <a href="#school-life" className="text-sm text-muted-foreground hover:text-foreground">School life</a>
            <a href="#questions" className="text-sm text-muted-foreground hover:text-foreground">Questions</a>
          </nav>
          <div className="hidden shrink-0 items-center gap-2 lg:flex"><Button asChild variant="ghost"><Link to="/auth" search={{ mode: "login" }}>Sign in</Link></Button><Button asChild><Link to="/auth" search={{ mode: "signup" }}>Join the community<ArrowUpRight /></Link></Button></div>
          <Button variant="ghost" size="icon" className="lg:hidden" aria-label={menuOpen ? "Close menu" : "Open menu"} aria-expanded={menuOpen} onClick={() => setMenuOpen(!menuOpen)}>{menuOpen ? <X /> : <Menu />}</Button>
        </div>
        {menuOpen && <nav aria-label="Mobile navigation" className="grid gap-4 border-t px-5 py-5 lg:hidden"><a href="#community" onClick={() => setMenuOpen(false)}>Our community</a><a href="#school-life" onClick={() => setMenuOpen(false)}>School life</a><a href="#questions" onClick={() => setMenuOpen(false)}>Questions</a><Button asChild variant="outline"><Link to="/auth" search={{ mode: "login" }}>Sign in</Link></Button><JoinButton /></nav>}
      </header>

      <main>
        <section className="mx-auto max-w-6xl px-5 pb-12 pt-14 text-center sm:px-8 sm:pt-16">
          <p className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-primary"><span className="h-2 w-2 rounded-full bg-success" />YOUR PEOPLE. YOUR NEXT CHAPTER.</p>
          <h1 className="mt-7 font-display text-4xl font-bold leading-tight sm:text-6xl">SchoolConnect<span className="mt-4 block text-2xl font-medium sm:text-4xl">Your school. <span className="text-primary">Your people.</span></span></h1>
          <p className="mx-auto mt-6 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">The friends you haven’t met. The classmates you’ve missed.<br className="hidden sm:block" /> The community that grows with you — from school to what’s next.</p>
          <div className="mx-auto mt-8 grid max-w-md gap-3 sm:flex sm:max-w-none sm:justify-center"><JoinButton /><Button asChild size="lg" variant="outline" className="h-12"><a href="#community">Meet the community<ArrowDownIcon /></a></Button></div>
          <p className="mx-auto mt-5 flex max-w-sm items-start justify-center gap-2 text-xs text-muted-foreground"><ShieldCheck className="h-4 w-4 text-primary" />Your username is your way in. No email or phone required.</p>
          <div className="mt-12 flex flex-wrap justify-center gap-x-6 gap-y-3 border-t border-border pt-6 text-xs font-semibold text-muted-foreground sm:gap-x-9">{["PRIMARY", "JHS", "SHS", "TECHNICAL & VOCATIONAL", "UNIVERSITY", "ALUMNI"].map(label => <span key={label}>{label}</span>)}</div>
        </section>

        <section id="community" className="scroll-mt-6 border-y border-border bg-surface">
          <div className="mx-auto max-w-6xl px-5 py-10 sm:px-8">
            <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"><div><p className="text-xs font-bold uppercase tracking-widest text-primary">Real people. Real connections.</p><h2 className="mt-2 text-xl font-semibold">Our community, by the numbers.</h2></div><div className="flex items-center gap-2 text-xs text-muted-foreground"><Activity className="h-4 w-4" />{stats ? "Live community totals" : "Community totals unavailable"}<Button size="icon" variant="ghost" aria-label="Refresh community totals" title="Refresh community totals" disabled={isFetching} onClick={() => void refetch()}><RefreshCw className={isFetching ? "animate-spin" : ""} /></Button></div></div>
            <div className="mt-8 grid grid-cols-2 gap-y-8 md:grid-cols-4">{metricItems.map(({key, label, icon: Icon}, i) => <div key={key} className={`px-3 sm:px-6 ${i % 2 ? "border-l border-border" : ""} ${i === 2 ? "md:border-l" : ""}`}><Icon className="mb-3 h-5 w-5 text-primary" /><p className="font-display text-4xl font-semibold">{stats ? stats[key].toLocaleString("en-GB") : "—"}</p><p className="mt-2 text-xs text-muted-foreground sm:text-sm">{label}</p></div>)}</div>
            <p className="mt-7 text-xs text-muted-foreground">{stats ? `Counts include completed member profiles, represented schools, published public posts and accepted friendships. Updated ${new Date(stats.updatedAt).toISOString().slice(0, 16).replace("T", " ")} UTC.` : "We couldn’t reach the community database. No estimated numbers — check back for verified totals."}</p>
          </div>
        </section>

        <section id="school-life" className="mx-auto max-w-6xl scroll-mt-8 px-5 py-16 sm:px-8 sm:py-20">
          <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end"><div><p className="text-xs font-bold uppercase tracking-widest text-primary">Beyond the classroom</p><h2 className="mt-3 text-3xl font-semibold sm:text-4xl">Life beyond the classroom.</h2></div><p className="max-w-sm text-sm leading-relaxed text-muted-foreground">Catch up with your classmates. Find your next study partner. Make memories worth keeping.</p></div>
          <div className="mt-10 grid gap-5 md:grid-cols-3">{[
            { icon: Users, title: "A place to belong", text: "Your school community, classmates and alumni. Familiar faces and fresh perspectives, all in one place.", badge: "YOUR COMMUNITY", color: "text-primary bg-accent" },
            { icon: MessageCircle, title: "Stay in the loop", text: "Share a post, add a story or message a friend. From a quick hello to a study session that makes the difference.", badge: "YOUR CONNECTIONS", color: "text-verified bg-muted" },
            { icon: Trophy, title: "Grow together", text: "Take on missions, earn badges and cheer on your school. Turn everyday participation into shared achievements.", badge: "YOUR NEXT CHAPTER", color: "text-trending-foreground bg-trending/15" },
          ].map(({icon: Icon, title, text, badge, color}) => <article key={title} className="flex flex-col rounded-lg border border-border bg-surface p-6"><div className={`grid h-11 w-11 place-items-center rounded-md ${color}`}><Icon className="h-5 w-5" /></div><p className="mt-7 text-[10px] font-semibold tracking-widest text-muted-foreground">{badge}</p><h3 className="mt-2 text-lg font-semibold">{title}</h3><p className="mt-3 flex-1 text-sm leading-relaxed text-muted-foreground">{text}</p><Link to="/auth" search={{ mode: "signup" }} className="mt-6 inline-flex items-center gap-2 text-sm font-semibold">Join in<ArrowUpRight className="h-4 w-4" /></Link></article>)}</div>
        </section>

        <section className="border-y border-border bg-accent">
          <div className="mx-auto grid max-w-6xl gap-8 px-5 py-12 sm:px-8 md:grid-cols-2 md:items-center"><div><ShieldCheck className="h-8 w-8 text-primary" /><h2 className="mt-4 text-2xl font-semibold sm:text-3xl">Connections with boundaries.</h2><p className="mt-4 max-w-md text-sm leading-relaxed text-muted-foreground">Choose who sees your posts. Keep your recovery answers private. Stay in control of who you connect with.</p></div><ul className="grid gap-5 text-sm">{["Username and password sign-in", "Private security questions for account recovery", "Post audiences: everyone, friends or your school", "Block and report controls"].map(item => <li key={item} className="flex items-center gap-3"><Check className="h-4 w-4 shrink-0 text-primary" />{item}</li>)}</ul></div>
        </section>

        <section id="questions" className="mx-auto max-w-3xl scroll-mt-8 px-5 py-16 sm:px-8"><p className="text-xs font-semibold uppercase tracking-widest text-primary">Before you join</p><h2 className="mt-3 text-3xl font-semibold">A few good questions.</h2><div className="mt-8 divide-y divide-border">{[
          ["Who is SchoolConnect for?", "Students from Primary, JHS, SHS, Technical and Vocational schools, universities, and alumni. The minimum account age is shown during registration."],
          ["Do I need an email address?", "No. Choose a username and password, enter your name and date of birth, and answer seven private security questions. Keep those answers safe: they’re used for account recovery."],
          ["Where do the community numbers come from?", "Directly from our database. We count completed, non-banned member profiles, schools they represent, published public posts and accepted friendships. If the connection is unavailable, we show a dash instead of an invented number."],
          ["Can I use it on my phone?", "Yes. SchoolConnect works in your browser on phones, tablets and computers. On supported browsers, you can also install it to your home screen."],
        ].map(([question, answer]) => <details key={question} className="group py-5"><summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-sm font-semibold">{question}<span className="shrink-0 text-xl font-normal text-muted-foreground group-open:rotate-45">+</span></summary><p className="mt-3 text-sm leading-relaxed text-muted-foreground">{answer}</p></details>)}</div></section>
        <section className="border-t border-border bg-surface px-5 py-14 text-center"><GraduationCap className="mx-auto h-8 w-8 text-primary" /><h2 className="mt-5 text-3xl font-semibold sm:text-4xl">Your people are worth finding.</h2><p className="mt-4 text-sm text-muted-foreground">Start with your school. See where the connections take you.</p><JoinButton className="mt-7">Join SchoolConnect</JoinButton></section>
      </main>
      <footer className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-5 px-5 py-7 text-xs text-muted-foreground sm:px-8"><span className="font-semibold">SchoolConnect · GH School Hub</span><div className="flex gap-5"><a href="#questions">Questions</a><Link to="/auth" search={{ mode: "login" }}>Sign in</Link><Link to="/auth" search={{ mode: "signup" }}>Join the community</Link></div></footer>
    </div>
  );
}

function ArrowDownIcon() { return <ArrowRight className="rotate-90" />; }
