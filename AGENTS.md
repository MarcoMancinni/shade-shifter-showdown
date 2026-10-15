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

## Game architecture
- Rules engine lives in `src/lib/game/engine.ts` as pure TS; server functions in `src/lib/game.functions.ts` load state, call it, and commit via the `commit_room_state` RPC (version-checked) — keeps the server authoritative and the engine testable.
- Players have no accounts: identity is a random token (only its SHA-256 stored in `player_secrets`), kept in localStorage per room — prevents seat takeover by link.
- Hidden cards live only in `room_secrets` (no client grants); `rooms.public_state` holds only what everyone may see.
- GameTable uses the hydration-safe nullable mobile layout hook, with a neutral initial table state; mobile drawer styling is scoped to its portal class so desktop layout remains unchanged.
