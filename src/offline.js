import { supabase } from './supabase'

// Writes to expenses and incomes go through here. Without a connection they
// wait in localStorage and are sent in order once the app is online again.
// Rows use ids made on the device, so sending one twice is harmless.

const queueKey = userId => `pending-ops:${userId}`
const cacheKey = (userId, name) => `cache:${userId}:${name}`

function readJSON(key) {
  try { return JSON.parse(localStorage.getItem(key)) } catch { return null }
}

function writeJSON(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)) } catch { /* storage full or blocked */ }
}

export function readQueue(userId) {
  return readJSON(queueKey(userId)) || []
}

export function readCache(userId, name) {
  return readJSON(cacheKey(userId, name))
}

export function writeCache(userId, name, value) {
  writeJSON(cacheKey(userId, name), value)
}

export function isNetworkError(error) {
  return !navigator.onLine || /fetch|network|load failed/i.test(error?.message || '')
}

function execute(op) {
  const table = supabase.from(op.table)
  if (op.type === 'insert') return table.upsert(op.row, { onConflict: 'id', ignoreDuplicates: true })
  if (op.type === 'update') return table.update(op.fields).eq('id', op.id)
  return table.delete().eq('id', op.id)
}

let flushing = null

// Sends queued writes in order and stops at the first network failure.
// A write the server rejects for another reason is dropped.
export function flush(userId) {
  if (!flushing) {
    flushing = (async () => {
      let sent = 0
      for (;;) {
        const [op] = readQueue(userId)
        if (!op) break
        const { error } = await execute(op)
        if (error && isNetworkError(error)) break
        if (error) console.error('dropped queued write:', op, error)
        writeJSON(queueKey(userId), readQueue(userId).filter(o => o.opId !== op.opId))
        sent++
      }
      return { sent, left: readQueue(userId).length }
    })().finally(() => { flushing = null })
  }
  return flushing
}

// Runs a write now, or queues it when offline. Anything already queued goes
// first so the order of changes is kept.
// Returns { ok, queued } or { ok: false, error }.
export async function write(userId, op) {
  op = { ...op, opId: crypto.randomUUID() }
  if (navigator.onLine && readQueue(userId).length === 0) {
    const { error } = await execute(op)
    if (!error) return { ok: true }
    if (!isNetworkError(error)) return { ok: false, error }
  }
  writeJSON(queueKey(userId), [...readQueue(userId), op])
  if (navigator.onLine) await flush(userId)
  return { ok: true, queued: readQueue(userId).some(o => o.opId === op.opId) }
}
