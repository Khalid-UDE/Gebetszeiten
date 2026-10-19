// Cron (jede Minute): fällige Gebete verschicken – jeder Termin genau einmal.
const MAX_LATE_MS = 10 * 60e3; // ältere verpasste Termine nicht mehr senden

export async function handleCron(env, { planNext, message, logFailure, pushOptions, send, rowToSub }, now = Date.now()) {
  const { results } = await env.DB.prepare("SELECT * FROM subs WHERE next_at IS NOT NULL AND next_at <= ? ORDER BY next_at LIMIT 500").bind(now + 20e3).all();
  await Promise.all(results.map(async r => {
    const sub = rowToSub(r);
    const late = now - r.next_at > MAX_LATE_MS;
    const next = await planNext(env, sub, late ? now : r.next_at + 30e3);
    // Termin zuerst beanspruchen: nur wer next_at noch im alten Zustand vorfindet, darf senden.
    // So verschickt ein zweiter, gleichzeitig laufender Durchlauf nichts doppelt.
    const claim = await env.DB.prepare("UPDATE subs SET next_at = ?, next_key = ?, sent_for = ? WHERE endpoint = ? AND next_at = ?")
      .bind(next ? next.at : null, next ? next.key : null, late ? (r.sent_for ?? null) : r.next_at, sub.endpoint, r.next_at).run();
    if (claim.meta?.changes !== 1 || late) return;
    let fails = r.fails || 0;
    try {
      const { status, reason } = await send({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, message(sub, r.next_key, r.next_at), pushOptions(env));
      if (status >= 300) await logFailure(env, sub.endpoint, status, reason);
      if (status === 404 || status === 410) {
        await env.DB.prepare("DELETE FROM subs WHERE endpoint = ?").bind(sub.endpoint).run();
        return;
      }
      fails = status >= 200 && status < 300 ? 0 : fails + 1;
    } catch (e) {
      console.log("push failed", String(e));
      await logFailure(env, sub.endpoint, 0, String(e.message || e));
      fails++;
    }
    if (fails > 50) await env.DB.prepare("DELETE FROM subs WHERE endpoint = ?").bind(sub.endpoint).run();
    else await env.DB.prepare("UPDATE subs SET fails = ? WHERE endpoint = ?").bind(fails, sub.endpoint).run();
  }));
}
