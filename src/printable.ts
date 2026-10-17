// printable.ts — make a server-supplied value safe to write to a terminal.
//
// Everything rugcheck prints from a response (verdict reasons, rating, score, counts, error text) was
// chosen by the server, and `SERVER_URL` can point at any server. Written raw, an ESC sequence can
// recolour or erase earlier output (hide "AVOID", fake "OK"), move the cursor, set the window title,
// or emit OSC 8 hyperlinks and OSC 52 clipboard writes. So every escape sequence and every C0/C1
// control character is removed before printing; newlines and tabs become spaces, so one value cannot
// forge an extra line of output either. Our OWN colour codes are added after this, never passed in.

// CSI (ESC [ … final), OSC (ESC ] … BEL | ESC \), DCS/SOS/PM/APC (ESC P|X|^|_ … ESC \), and any
// other two-byte ESC sequence. The 8-bit C1 introducers (0x9b CSI, 0x9d OSC, …) are covered by the
// control-character pass below, which runs second and catches any ESC the patterns did not.
const ESC_SEQUENCES = /\x1b\[[0-?]*[ -/]*[@-~]|\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)?|\x1b[PX^_][^\x1b]*(?:\x1b\\)?|\x1b[ -~]?/g;
const CONTROL = /[\x00-\x1f\x7f-\x9f]/g;

/** `value` as one line of plain text: no escape sequences, no control characters. */
export function printable(value: unknown): string {
  return String(value)
    .replace(ESC_SEQUENCES, '')
    .replace(/[\t\n\r\v\f]/g, ' ')
    .replace(CONTROL, '');
}
