#!/usr/bin/env node
// rugcheck — on-chain rug/honeypot check for an EVM token, from your terminal.
//   npx @true402.dev/rugcheck 0x<token> [--chain base|ethereum|bsc]
// Tries the free trial first; if that's exhausted/off, pays over x402 when PAYER_PRIVATE_KEY is set.
import { payStall } from './x402';
import { printable } from './printable';

const C = {
  reset: '\x1b[0m', bold: '\x1b[1m', dim: '\x1b[2m',
  red: '\x1b[31m', yellow: '\x1b[33m', green: '\x1b[32m',
};
const short = (a: string) => `${a.slice(0, 8)}…${a.slice(-6)}`;
const isAddr = (s: string) => /^0x[0-9a-fA-F]{40}$/.test(s);
const BASE_URL = process.env.SERVER_URL || 'https://true402.dev/api';

// Chains the service serves at /v1/{chain}/token-report. Base stays the default so every existing
// invocation — and every published example — keeps meaning exactly what it did before.
const CHAINS = ['base', 'ethereum', 'bsc'] as const;
type Chain = (typeof CHAINS)[number];
const isChain = (s: string): s is Chain => (CHAINS as readonly string[]).includes(s);

interface Report {
  verdict?: { rating?: string; reasons?: string[] };
  safety?: { score?: number };
}

interface History {
  indexed?: boolean;
  removals?: { count?: number; totalQuoteRemoved?: number; distinctPools?: number };
  linkedTokens?: unknown[];
  coverage?: { complete?: boolean; removalsIndexedFromBlock?: number | null; removalsIndexedToBlock?: number | null };
  verdict?: string;
}

/**
 * `--history` — what has ALREADY happened to the token's liquidity.
 *
 * A honeypot simulation answers "can I sell this right now"; it is blind to a pool that was drained
 * last month and re-seeded. This reads true402's archive of observed removals. Base only, because
 * that is the chain the archive covers — asking for it elsewhere says so rather than printing an
 * empty result that reads like a clean record.
 */
async function printHistory(token: string, chain: string, key: string | undefined) {
  if (chain !== 'base') {
    process.stdout.write(`${C.dim}--history covers Base only (that is the chain true402 archives); skipped for ${chain}.${C.reset}\n\n`);
    return;
  }
  try {
    let h: History;
    if (key) {
      h = await payStall<History>('/v1/base/liquidity-history', { token, limit: 5 }, { payerPrivateKey: key, baseUrl: BASE_URL });
    } else {
      const res = await fetch(`${BASE_URL}/v1/base/liquidity-history`, {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ token, limit: 5 }),
      });
      if (res.status !== 200) {
        process.stdout.write(`${C.dim}liquidity history: free trial unavailable — set PAYER_PRIVATE_KEY to read it (~$0.005).${C.reset}\n\n`);
        return;
      }
      h = (await res.json()) as History;
    }
    // Every value below came from the server: printable() strips escape/control sequences.
    const n = Number(h.removals?.count ?? 0) || 0;
    const linked = Array.isArray(h.linkedTokens) ? h.linkedTokens.length : 0;
    process.stdout.write(`${C.bold}liquidity history${C.reset}  ${n > 0 ? `${C.yellow}${n} removal event(s)${C.reset} across ${printable(h.removals?.distinctPools ?? '?')} pool(s)` : `${C.dim}none observed${C.reset}`}\n`);
    if (linked > 0) process.stdout.write(`  ${C.yellow}•${C.reset} ${linked} other token(s) drained in the SAME transaction(s) — one operator, several pools\n`);
    // Never let an absence read as a clean record: say what window it covers.
    if (h.coverage?.complete === false) {
      process.stdout.write(`  ${C.dim}• index is partial — absence here is not proof a removal did not happen${C.reset}\n`);
    }
    process.stdout.write('\n');
  } catch {
    process.stdout.write(`${C.dim}liquidity history unavailable right now.${C.reset}\n\n`);
  }
}

function printVerdict(token: string, r: Report, free: boolean, chain = 'base') {
  // The verdict is the server's text: printable() strips escape/control sequences, so a hostile
  // SERVER_URL cannot repaint an AVOID as OK, rewrite the terminal title, or plant a hyperlink.
  const rating = printable(r.verdict?.rating ?? 'unknown');
  const score = printable(r.safety?.score ?? '?');
  const badge =
    rating === 'avoid' ? `${C.red}${C.bold}🛑 AVOID${C.reset}` :
    rating === 'caution' ? `${C.yellow}${C.bold}⚠️  CAUTION${C.reset}` :
    rating === 'ok' ? `${C.green}${C.bold}✅ OK${C.reset}` : rating;
  process.stdout.write(`\n${C.bold}true402 rugcheck${C.reset} · ${short(token)} ${C.dim}on ${chain}${C.reset}${free ? `  ${C.dim}(free trial)${C.reset}` : ''}\n`);
  process.stdout.write(`${badge}  ${C.dim}(score ${score}/100)${C.reset}\n`);
  const listed: unknown = r.verdict?.reasons;
  const reasons: unknown[] = Array.isArray(listed) ? listed : [];
  for (const reason of reasons) process.stdout.write(`  ${C.dim}•${C.reset} ${printable(reason)}\n`);
  process.stdout.write(`${C.dim}checked on-chain: honeypot sim + liquidity + ownership · true402.dev${C.reset}\n\n`);
}

async function main() {
  const argv = process.argv.slice(2);
  let wantHistory = false;
  // --chain bsc | --chain=bsc, anywhere in the args; everything else is the token.
  let chain: Chain = 'base';
  const rest: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--chain' || a === '-c') {
      const v = (argv[++i] ?? '').toLowerCase();
      if (!isChain(v)) {
        process.stderr.write(`${C.red}Unknown chain:${C.reset} ${v || '(missing)'} — use ${CHAINS.join(' | ')}\n`);
        process.exit(1);
      }
      chain = v;
    } else if (a.startsWith('--chain=')) {
      const v = a.slice('--chain='.length).toLowerCase();
      if (!isChain(v)) {
        process.stderr.write(`${C.red}Unknown chain:${C.reset} ${v} — use ${CHAINS.join(' | ')}\n`);
        process.exit(1);
      }
      chain = v;
    } else if (a === '--history' || a === '-H') {
      wantHistory = true;
    } else {
      rest.push(a);
    }
  }
  const arg = rest[0];
  if (!arg || arg === '-h' || arg === '--help') {
    process.stdout.write(
      `${C.bold}true402 rugcheck${C.reset} — on-chain rug/honeypot check for an EVM token\n\n` +
        `  ${C.bold}npx @true402.dev/rugcheck${C.reset} <0xTOKEN> [--chain ${CHAINS.join('|')}] [--history]\n\n` +
        `  ${C.dim}--history${C.reset}  also show observed liquidity removals from true402's Base archive —\n` +
        `             what already happened to the token, which a live simulation cannot see.\n\n` +
        `Defaults to ${C.bold}base${C.reset}. The check runs against that chain's own DEX pools.\n\n` +
        `Free trial first; for unlimited checks set ${C.bold}PAYER_PRIVATE_KEY${C.reset}=0x… (a Base wallet\n` +
        `with a little USDC) to pay ~$0.01 per call over x402 — no account, no API key.\n` +
        `More: https://true402.dev\n`,
    );
    process.exit(arg ? 0 : 1);
  }
  if (!isAddr(arg)) {
    process.stderr.write(`${C.red}Not a valid token address:${C.reset} ${arg}\n`);
    process.exit(1);
  }

  const key = process.env.PAYER_PRIVATE_KEY;

  // No wallet? Try the free trial — a plain unpaid request. The server serves it (HTTP 200) when the
  // free-trial quota is available; otherwise it answers 402 and we explain how to pay.
  if (!key) {
    try {
      const res = await fetch(`${BASE_URL}/v1/${chain}/token-report`, {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ token: arg }),
      });
      if (res.status === 200) {
        const r = (await res.json()) as Report;
        printVerdict(arg, r, true, chain);
        if (wantHistory) await printHistory(arg, chain, undefined);
        process.exit(r.verdict?.rating === 'avoid' ? 1 : 0); // non-zero on a rug → scriptable
      }
    } catch {
      // network issue → fall through to the pay prompt
    }
    process.stdout.write(
      `\n${C.bold}true402 rugcheck${C.reset} · ${short(arg)}\n\n` +
        `The free trial isn't available right now (off or used up).\n` +
        `Set ${C.bold}PAYER_PRIVATE_KEY${C.reset}=0x… (a Base wallet with a little USDC) to pay ~$0.01/call:\n` +
        `  ${C.dim}PAYER_PRIVATE_KEY=0x… npx @true402.dev/rugcheck ${arg}${C.reset}\n` +
        `${C.dim}Why a wallet, not an API key? → https://true402.dev/buy${C.reset}\n`,
    );
    process.exit(2);
  }

  try {
    const r = await payStall<Report>(`/v1/${chain}/token-report`, { token: arg }, { payerPrivateKey: key, baseUrl: BASE_URL });
    printVerdict(arg, r, false, chain);
    if (wantHistory) await printHistory(arg, chain, key);
    process.exit(r.verdict?.rating === 'avoid' ? 1 : 0); // non-zero on a rug → scriptable/CI-able
  } catch (e) {
    // The message carries the server's own error body (serverReason) — strip it like any server text.
    process.stderr.write(`${C.red}check failed:${C.reset} ${printable(e instanceof Error ? e.message : String(e))}\n`);
    process.exit(1);
  }
}

void main();
