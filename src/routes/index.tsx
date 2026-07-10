import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import heroImg from "@/assets/hero.jpg";
import {
  MessageCircle, Users, Sparkles, GraduationCap, Camera, Bell,
  ShieldCheck, Globe2, Zap, Heart, Star, ArrowRight, Menu,
} from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "SchoolConnect — Meet, chat & grow with students everywhere" },
      { property: "og:title", content: "SchoolConnect" },
      { property: "og:description", content: "The social network built for students from Primary school to university and alumni." },
    ],
  }),
  component: Landing,
});

function Landing() {
  const nav = useNavigate();
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => { if (data.user) nav({ to: "/home" }); });
  }, [nav]);
  return (
    <div className="min-h-screen hero-surface">
      <Nav />
      <Hero />
      <Stats />
      <Features />
      <About />
      <Gallery />
      <Testimonials />
      <Faq />
      <Contact />
      <Footer />
    </div>
  );
}

function Nav() {
  const [open, setOpen] = useState(false);
  return (
    <header className="sticky top-0 z-40 mx-auto mt-4 w-[min(1200px,94%)]">
      <div className="glass flex items-center justify-between rounded-full px-4 py-2.5 sm:px-6">
        <Link to="/" className="flex items-center gap-2">
          <div className="grid h-9 w-9 place-items-center rounded-xl gradient-brand shadow-brand">
            <GraduationCap className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="text-lg font-extrabold tracking-tight">SchoolConnect</span>
        </Link>
        <nav className="hidden items-center gap-8 md:flex">
          <a href="#features" className="text-sm font-medium text-muted-foreground hover:text-foreground">Features</a>
          <a href="#about" className="text-sm font-medium text-muted-foreground hover:text-foreground">About</a>
          <a href="#testimonials" className="text-sm font-medium text-muted-foreground hover:text-foreground">Community</a>
          <a href="#faq" className="text-sm font-medium text-muted-foreground hover:text-foreground">FAQ</a>
        </nav>
        <div className="hidden items-center gap-2 md:flex">
          <Link to="/auth" search={{ mode: "login" }} className="rounded-full px-4 py-2 text-sm font-semibold hover:bg-muted">Log in</Link>
          <Link to="/auth" search={{ mode: "signup" }} className="rounded-full gradient-brand px-5 py-2 text-sm font-semibold text-primary-foreground shadow-brand hover-lift">
            Join now
          </Link>
        </div>
        <button className="md:hidden rounded-full p-2 hover:bg-muted" onClick={() => setOpen(!open)} aria-label="Menu">
          <Menu className="h-5 w-5" />
        </button>
      </div>
      {open && (
        <div className="glass mt-2 grid gap-2 rounded-2xl p-4 md:hidden">
          <a href="#features" onClick={() => setOpen(false)} className="rounded-lg px-3 py-2 hover:bg-muted">Features</a>
          <a href="#about" onClick={() => setOpen(false)} className="rounded-lg px-3 py-2 hover:bg-muted">About</a>
          <a href="#testimonials" onClick={() => setOpen(false)} className="rounded-lg px-3 py-2 hover:bg-muted">Community</a>
          <a href="#faq" onClick={() => setOpen(false)} className="rounded-lg px-3 py-2 hover:bg-muted">FAQ</a>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <Link to="/auth" search={{ mode: "login" }} className="rounded-full border py-2 text-center text-sm font-semibold">Log in</Link>
            <Link to="/auth" search={{ mode: "signup" }} className="rounded-full gradient-brand py-2 text-center text-sm font-semibold text-primary-foreground">Join</Link>
          </div>
        </div>
      )}
    </header>
  );
}

function Hero() {
  return (
    <section className="mx-auto grid w-[min(1200px,94%)] gap-12 py-16 md:grid-cols-[1.05fr_1fr] md:py-24 lg:py-28">
      <div className="animate-fade-up flex flex-col justify-center">
        <span className="glass inline-flex w-fit items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold text-muted-foreground">
          <Sparkles className="h-3.5 w-3.5 text-[color:var(--brand)]" />
          Built for every student, in every school
        </span>
        <h1 className="mt-5 text-5xl font-black leading-[1.05] tracking-tight sm:text-6xl md:text-7xl">
          Your school, <span className="text-gradient">reimagined</span> as a social world.
        </h1>
        <p className="mt-6 max-w-xl text-lg text-muted-foreground">
          Meet classmates & alumni from Primary, JHS, SHS, Technical and University. Chat, share stories, join communities, and stay inspired — all in one beautiful place.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link to="/auth" search={{ mode: "signup" }} className="inline-flex items-center gap-2 rounded-full gradient-brand px-6 py-3 text-sm font-semibold text-primary-foreground shadow-brand hover-lift">
            Create your account <ArrowRight className="h-4 w-4" />
          </Link>
          <Link to="/auth" search={{ mode: "login" }} className="inline-flex items-center gap-2 rounded-full border bg-background/60 px-6 py-3 text-sm font-semibold backdrop-blur hover:bg-muted">
            I already have one
          </Link>
        </div>
        <div className="mt-8 flex items-center gap-6 text-sm text-muted-foreground">
          <div className="flex -space-x-2">
            {[0,1,2,3].map(i => (
              <div key={i} className="h-8 w-8 rounded-full border-2 border-background gradient-brand" style={{filter:`hue-rotate(${i*40}deg)`}} />
            ))}
          </div>
          <span>Loved by thousands of students</span>
        </div>
      </div>
      <div className="relative">
        <div className="absolute -inset-6 -z-10 rounded-[3rem] gradient-brand opacity-20 blur-3xl" />
        <div className="glass overflow-hidden rounded-[2rem] p-2 animate-float">
          <img src={heroImg} alt="Students connecting" width={1600} height={1200}
            className="w-full rounded-[1.6rem] object-cover" />
        </div>
        <div className="glass absolute -left-4 bottom-6 hidden items-center gap-3 rounded-2xl p-3 sm:flex">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-[color:var(--brand-3)]/20 text-[color:var(--brand-3)]"><Heart className="h-5 w-5" /></div>
          <div>
            <div className="text-xs text-muted-foreground">New friend request</div>
            <div className="text-sm font-semibold">Ama from Achimota SHS</div>
          </div>
        </div>
        <div className="glass absolute -right-3 top-8 hidden items-center gap-3 rounded-2xl p-3 md:flex">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-[color:var(--brand-2)]/20 text-[color:var(--brand-2)]"><MessageCircle className="h-5 w-5" /></div>
          <div>
            <div className="text-xs text-muted-foreground">Study group</div>
            <div className="text-sm font-semibold">"WASSCE Prep 2026"</div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Stats() {
  const items = [
    { n: "25K+", l: "Active students" },
    { n: "800+", l: "Schools" },
    { n: "120K+", l: "Friendships made" },
    { n: "4.9★", l: "Student rating" },
  ];
  return (
    <section className="mx-auto w-[min(1200px,94%)] pb-8">
      <div className="glass grid grid-cols-2 gap-4 rounded-3xl p-6 sm:grid-cols-4">
        {items.map(i => (
          <div key={i.l} className="text-center">
            <div className="text-3xl font-black text-gradient sm:text-4xl">{i.n}</div>
            <div className="mt-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">{i.l}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

function Features() {
  const items = [
    { i: Users, t: "Meet your people", d: "Find classmates, alumni and students from schools everywhere." },
    { i: MessageCircle, t: "Chat & group calls", d: "Fast, real-time chat with friends and study groups." },
    { i: Camera, t: "Stories & posts", d: "Share moments that disappear in 24h or last forever." },
    { i: GraduationCap, t: "School communities", d: "Every school gets its own home with clubs, events and alumni." },
    { i: Bell, t: "Stay informed", d: "Curated education news — WAEC, scholarships, admissions." },
    { i: ShieldCheck, t: "Safe by design", d: "Privacy controls, AI moderation and student-first defaults." },
  ];
  return (
    <section id="features" className="mx-auto w-[min(1200px,94%)] py-20">
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="text-4xl font-black tracking-tight sm:text-5xl">Everything a student needs, <span className="text-gradient">nothing they don't</span>.</h2>
        <p className="mt-4 text-muted-foreground">The best parts of Instagram, WhatsApp, Discord and LinkedIn — reimagined for school life.</p>
      </div>
      <div className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {items.map(({ i: Icon, t, d }) => (
          <div key={t} className="glass hover-lift rounded-3xl p-6">
            <div className="grid h-12 w-12 place-items-center rounded-2xl gradient-brand text-primary-foreground shadow-brand">
              <Icon className="h-6 w-6" />
            </div>
            <h3 className="mt-5 text-lg font-bold">{t}</h3>
            <p className="mt-2 text-sm text-muted-foreground">{d}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function About() {
  return (
    <section id="about" className="mx-auto w-[min(1200px,94%)] py-20">
      <div className="glass grid gap-10 rounded-[2rem] p-10 md:grid-cols-2 md:p-14">
        <div>
          <span className="text-xs font-bold uppercase tracking-widest text-[color:var(--brand)]">About</span>
          <h2 className="mt-3 text-4xl font-black tracking-tight sm:text-5xl">Why students <span className="text-gradient">love</span> SchoolConnect</h2>
          <p className="mt-5 text-muted-foreground">
            School is more than lessons — it's the people. SchoolConnect helps you reconnect with old classmates, meet new friends across schools, and build a network for life.
          </p>
          <ul className="mt-6 grid gap-3 text-sm">
            {["Free for every student, forever","Works beautifully on any phone","Real friendships, no ads, no noise","Built with student safety at the core"].map(x => (
              <li key={x} className="flex items-center gap-3">
                <div className="grid h-6 w-6 place-items-center rounded-full gradient-brand text-primary-foreground text-xs">✓</div>
                {x}
              </li>
            ))}
          </ul>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {[
            { i: Zap, t: "Fast", d: "Snappy on 3G" },
            { i: Globe2, t: "Global", d: "Any school, any country" },
            { i: ShieldCheck, t: "Safe", d: "Privacy-first defaults" },
            { i: Heart, t: "Kind", d: "Positive by design" },
          ].map(({ i: I, t, d }) => (
            <div key={t} className="glass rounded-2xl p-5">
              <I className="h-6 w-6 text-[color:var(--brand)]" />
              <div className="mt-3 font-bold">{t}</div>
              <div className="text-sm text-muted-foreground">{d}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Gallery() {
  const cols = [
    ["from-[color:var(--brand)] to-[color:var(--brand-2)]","Freshman week 🎉"],
    ["from-[color:var(--brand-2)] to-[color:var(--brand-3)]","Debate club champs"],
    ["from-[color:var(--brand-3)] to-[color:var(--brand)]","Alumni reunion"],
    ["from-[color:var(--brand)] to-[color:var(--brand-3)]","Science fair"],
    ["from-[color:var(--brand-2)] to-[color:var(--brand)]","Sports day"],
    ["from-[color:var(--brand-3)] to-[color:var(--brand-2)]","Graduation ✨"],
  ];
  return (
    <section className="mx-auto w-[min(1200px,94%)] py-16">
      <h2 className="text-center text-3xl font-black sm:text-4xl">A peek at the <span className="text-gradient">campus life</span></h2>
      <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {cols.map(([g, label], idx) => (
          <div key={idx} className={`aspect-square overflow-hidden rounded-3xl bg-gradient-to-br ${g} p-4 text-primary-foreground shadow-brand hover-lift`}>
            <div className="flex h-full flex-col justify-end text-sm font-semibold">{label}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

function Testimonials() {
  const t = [
    { n: "Ama K.", r: "SHS 3, Achimota", q: "I found my primary school best friend after 8 years. I actually cried." },
    { n: "Kwesi B.", r: "University of Ghana", q: "Study groups here got me through first semester. Best app on my phone." },
    { n: "Nana Y.", r: "JHS 2, Legon Prep", q: "It looks nicer than Instagram and my parents actually let me use it." },
  ];
  return (
    <section id="testimonials" className="mx-auto w-[min(1200px,94%)] py-20">
      <h2 className="text-center text-4xl font-black tracking-tight sm:text-5xl">A community that <span className="text-gradient">feels like home</span></h2>
      <div className="mt-12 grid gap-5 md:grid-cols-3">
        {t.map(x => (
          <div key={x.n} className="glass hover-lift rounded-3xl p-6">
            <div className="flex gap-1 text-[color:var(--brand)]">{[...Array(5)].map((_,i)=><Star key={i} className="h-4 w-4 fill-current" />)}</div>
            <p className="mt-4 text-[15px] leading-relaxed">"{x.q}"</p>
            <div className="mt-6 flex items-center gap-3">
              <div className="h-10 w-10 rounded-full gradient-brand" />
              <div>
                <div className="text-sm font-bold">{x.n}</div>
                <div className="text-xs text-muted-foreground">{x.r}</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function Faq() {
  const faqs = [
    { q: "Is SchoolConnect free?", a: "Yes. It's completely free for students and alumni." },
    { q: "Which schools can join?", a: "Every school — Primary, JHS, SHS, Technical/Vocational, University, and alumni networks." },
    { q: "Is my data safe?", a: "Privacy is default-on. You control who sees your posts, stories and profile." },
    { q: "Do I need to be a student?", a: "You can also join as alumni to reconnect with old classmates." },
    { q: "Does it work on mobile?", a: "Yes, it's designed mobile-first and installs as a web app on any phone." },
  ];
  return (
    <section id="faq" className="mx-auto w-[min(900px,94%)] py-20">
      <h2 className="text-center text-4xl font-black tracking-tight sm:text-5xl">Frequently asked <span className="text-gradient">questions</span></h2>
      <div className="mt-10 grid gap-3">
        {faqs.map((f) => (
          <details key={f.q} className="glass group rounded-2xl p-5 open:shadow-brand">
            <summary className="flex cursor-pointer list-none items-center justify-between font-semibold">
              {f.q}
              <span className="grid h-8 w-8 place-items-center rounded-full bg-muted transition group-open:rotate-45">+</span>
            </summary>
            <p className="mt-3 text-sm text-muted-foreground">{f.a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}

function Contact() {
  return (
    <section className="mx-auto w-[min(1200px,94%)] pb-20">
      <div className="relative overflow-hidden rounded-[2rem] gradient-brand p-10 text-primary-foreground shadow-brand sm:p-16">
        <div className="absolute -right-16 -top-16 h-64 w-64 rounded-full bg-white/10 blur-2xl" />
        <div className="absolute -bottom-20 -left-10 h-72 w-72 rounded-full bg-white/10 blur-3xl" />
        <div className="relative grid gap-6 md:grid-cols-[1.3fr_1fr] md:items-center">
          <div>
            <h2 className="text-4xl font-black tracking-tight sm:text-5xl">Ready to meet your next best friend?</h2>
            <p className="mt-3 max-w-xl text-primary-foreground/85">Create your free SchoolConnect account and start your journey today.</p>
          </div>
          <div className="flex flex-wrap gap-3 md:justify-end">
            <Link to="/auth" search={{ mode: "signup" }} className="rounded-full bg-white px-6 py-3 text-sm font-bold text-[color:var(--brand)] hover-lift">Join now — it's free</Link>
            <a href="mailto:hello@schoolconnect.app" className="rounded-full border border-white/40 px-6 py-3 text-sm font-semibold hover:bg-white/10">Contact us</a>
          </div>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="mx-auto w-[min(1200px,94%)] pb-10 pt-4 text-sm text-muted-foreground">
      <div className="glass flex flex-col items-center justify-between gap-4 rounded-2xl p-5 sm:flex-row">
        <div className="flex items-center gap-2">
          <div className="grid h-7 w-7 place-items-center rounded-lg gradient-brand"><GraduationCap className="h-4 w-4 text-primary-foreground" /></div>
          <span className="font-bold text-foreground">SchoolConnect</span>
          <span>© {new Date().getFullYear()}</span>
        </div>
        <div className="flex gap-6">
          <a href="#features" className="hover:text-foreground">Features</a>
          <a href="#faq" className="hover:text-foreground">FAQ</a>
          <a href="mailto:hello@schoolconnect.app" className="hover:text-foreground">Contact</a>
        </div>
      </div>
    </footer>
  );
}
