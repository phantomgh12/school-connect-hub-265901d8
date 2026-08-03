## Goal

Redesign SchoolConnect / GH School Hub into a premium, mobile-first student social platform with a ranked "For You" algorithm, school communities, and gamification — while keeping every existing feature working.

This is a very large scope (roughly 12 feature systems + a full UI redesign). I'll ship it in 4 batches so nothing breaks along the way. Each batch is complete and testable on its own.

---

### Batch 1 — New design system + new layout shell + feed tabs

- New token set in `src/styles.css`: white background, `#2563EB` primary, `#10B981` success, `#F59E0B` trending, `#EF4444` alert, `#F3F4F6` cards, `#111827` text (converted to OKLCH tokens, light + dark).
- 16px rounded cards, subtle shadows, glass top bar, smooth transitions, skeleton loaders replacing spinners.
- Rebuilt `AppShell`: fixed top bar (logo, search, post, notifications, messages, profile), left sidebar (Home, For You, Following, School Communities, Reels, Messages, Friends, Saved, Events, Leaderboards, Settings), centre column, right sidebar (Trending, Suggested Friends, School Rankings, Events, Referral Progress, Daily Rewards), mobile bottom nav (Home, Search, Reels, Create, Notifications, Profile).
- Home centre order: Stories → What's Happening at Your School → Create Post → Feed Tabs → Posts.
- Feed tabs wired: **For You / Following / Trending / Latest** with infinite scroll and lazy-loaded media.

### Batch 2 — Ranking algorithm + trending hub

- Database: engagement counters, per-post trending score, `post_interactions` (view/watch-time/dwell), `user_interests`, hashtag stats — with scheduled score decay.
- Ranking score combines engagement (likes, comments, shares, saves), watch time, recency decay, interest match, same-school boost, followed-author boost, hashtag affinity, trending score, and past interaction history.
- Server-side ranked feed function with caching + cursor pagination.
- Trending hub page: topics, hashtags, creators, schools, posts.
- Algorithm-generated post prompts for new/low-activity users.

### Batch 3 — School communities, events, rankings

- School community pages keyed off the existing `school_slug`: community feed, member directory, events, polls, announcements, leaderboard.
- School calendar + events (create, RSVP, upcoming list in the right sidebar).
- School rankings by activity, engagement, and referrals.
- Smart onboarding upgrade: recommended schools, friends, interests.
- Algorithm-based friend recommendations (school, mutual friends, interests, class, activity).

### Batch 4 — Gamification, confessions, official account, notifications

- Daily login streaks, XP, levels, achievements, badges, milestones; referral rewards (XP, badges, unlockable themes).
- Leaderboards: students, creators, schools, referrers. Weekly challenges + seasonal events.
- Anonymous School Confessions: profanity filter, spam/rate-limit detection, automated risk scoring, reporting, admin approval queue before publish.
- Verified official admin account for news, study tips, memes, competitions, announcements (posting UI inside the existing admin panel).
- Grouped/smart notifications ("Ama and 4 others liked your post").
- Performance pass: query caching, image compression on upload, lazy routes, virtualized feed.

---

### Technical notes

- All new tables get GRANTs + RLS scoped to `auth.uid()`, plus narrow read policies for public/community data.
- Ranking runs in a server function (not the browser) so scoring weights stay tunable and cheap; results cached per user for a short window.
- Confession moderation is server-side only; client never sees the author identity, and admin approval is required before a confession is visible.
- Existing routes, admin panel, verification/invite system, stories, messaging, and profiles all stay intact — the redesign replaces presentation, not data.

Confirm and I'll start with Batch 1 immediately, then continue straight into Batch 2 unless you redirect.