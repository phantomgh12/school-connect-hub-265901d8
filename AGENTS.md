<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Public landing statistics use a narrowly scoped aggregate RPC via a publishable-key server function; unavailable data is never replaced with fabricated totals.
- Active account screens use the host-independent auth-db adapter for existing database RPCs so changing hosts does not require a privileged hosting key.
- Production builds target Nitro's Vercel preset; the managed sandbox preserves its preview runtime.
- Student screens share AppShell navigation and semantic theme tokens; primary destinations stay visible while secondary destinations are grouped to reduce mobile clutter.
- Post attachment details use the optional posts.options JSON field and shared browser-safe helpers; existing posts remain readable without metadata.
