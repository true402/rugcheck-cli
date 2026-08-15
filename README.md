# @true402.dev/rugcheck

[![npm version](https://img.shields.io/npm/v/@true402.dev/rugcheck)](https://www.npmjs.com/package/@true402.dev/rugcheck) &nbsp; **Stable · production-ready** — semver-stable public API (v1.0).

On-chain **rug / honeypot check for any Base token, from your terminal** — one command, no install:

```bash
npx @true402.dev/rugcheck 0x4ed4E862860beD51a9570b96d89aF5E1B0Efefed
```

It tries true402's **free trial** first (a few free checks/day — no wallet needed). For unlimited checks, point it at a payer wallet and it pays [true402](https://true402.dev)'s `token-report` over [x402](https://x402.org) (~$0.01 USDC on Base, **no account, no API key** — the wallet is the identity):

Works on Base (default), Ethereum and BNB Smart Chain — add `--chain ethereum` or `--chain bsc`.

Add `--history` to also show what has **already** happened to the token's liquidity — every removal
true402 has observed, and the other tokens drained in the same transaction. A honeypot simulation
answers "can I sell this right now"; it is blind to a pool that was drained last month and re-seeded.
Base only, since that is the chain the archive covers.

```bash
PAYER_PRIVATE_KEY=0x… npx @true402.dev/rugcheck 0x<token>
```

```
true402 rugcheck · 0x4ed4…Efed
🛑 AVOID  (score 0/100)
  • no tradeable WETH/USDC liquidity — effectively untradeable
checked on-chain: honeypot sim + liquidity + ownership · true402.dev
```

- **Exits non-zero on an AVOID verdict** — gate a script or CI step on it.
- `PAYER_PRIVATE_KEY` is a Base wallet holding a little USDC (gas is sponsored by the facilitator).
- The check **refuses to sign more than $0.10** for a single call, so a rogue endpoint can't drain the payer.

The verdict is a composite of an on-chain buy/sell **honeypot simulation**, **liquidity depth**, and **contract structure** (mint, ownership, kill switches). Powered by [true402](https://true402.dev) — the machine-native x402 marketplace on Base.

**Not in a terminal?** Send any Base token address to [@True402bot](https://t.me/True402bot) on Telegram, or use the browser check at <https://true402.dev/check> — same on-chain simulation, free, no wallet.

## Also available for

MCP (Claude Code / Desktop, Cursor, **Hermes**) · **Hermes Agent** · **OpenClaw** · **ElizaOS** ·
**LangChain** · **CrewAI** · **Vercel AI SDK** · **Coinbase AgentKit** · **Virtuals GAME** · CLI —
same on-chain checks, one install command each:
**[true402.dev/integrations](https://true402.dev/integrations)**

## Paying, exactly

The rules below are the service's, not this package's — they bite whatever client you use, and they
are the ones that surprise people writing their own payer.

- **Pay the EXACT amount quoted in the 402.** Underpaying is rejected. **Overpaying is refused with
  403 and never credited** — settlement submits the signed value and there is no refund path, so a
  surplus would simply be swept. Equality is also what binds an authorization to the resource it was
  quoted for.
- **One authorization buys exactly one response.** A replay is refused, not double-charged.
- **You are charged on success only.** Settlement is submitted only when the endpoint returns 2xx; if
  it errors or times out, your signed authorization is never submitted, so there is nothing to refund.
- Some endpoints serve a few free calls per day per client IP, with no wallet. The per-operation
  description in the [OpenAPI spec](https://true402.dev/api/openapi.json) says which.

Full rules: **[true402.dev/terms](https://true402.dev/terms)** · what is logged and kept:
**[true402.dev/privacy](https://true402.dev/privacy)**
