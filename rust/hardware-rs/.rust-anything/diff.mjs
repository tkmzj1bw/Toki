
const enc = (v, stack = []) => {
  if (v === undefined) return { $undefined: true }
  if (typeof v === 'number') {
    if (Number.isNaN(v)) return { $num: 'NaN' }
    if (!Number.isFinite(v)) return { $num: v > 0 ? 'Infinity' : '-Infinity' }
    if (Object.is(v, -0)) return { $num: '-0' }
    return v
  }
  // Strings JS split inside a surrogate pair are not valid Unicode: keep their code units.
  if (typeof v === 'string' && !v.isWellFormed()) return { $utf16: Array.from({ length: v.length }, (_, i) => v.charCodeAt(i)) }
  if (typeof v === 'bigint') return { $bigint: String(v) }
  if (typeof v === 'function') return { $function: v.name }
  if (typeof v === 'symbol') return { $symbol: String(v.description) }
  if (v === null || typeof v !== 'object') return v
  if (stack.includes(v)) return { $cycle: true }
  const next = [...stack, v]
  if (Array.isArray(v)) return v.map(x => enc(x, next))
  if (typeof Buffer !== 'undefined' && Buffer.isBuffer(v)) return { $buffer: [...v] }
  if (v instanceof Uint8Array) return { $bytes: [...v] }
  if (ArrayBuffer.isView(v) && !(v instanceof DataView)) return { $typed: { kind: v.constructor.name, values: [...v].map(x => enc(x, next)) } }
  if (v instanceof Map) return { $map: [...v].map(([k, x]) => [enc(k, next), enc(x, next)]) }
  if (v instanceof Set) return { $set: [...v].map(x => enc(x, next)) }
  if (v instanceof Date) return { $date: Number.isNaN(v.getTime()) ? 'Invalid' : v.toISOString() }
  if (v instanceof RegExp) return { $regexp: String(v) }
  if (v instanceof Error) return { $error: v.message }
  const plain = Object.fromEntries(Object.keys(v).map(k => [k, enc(v[k], next)]))
  return looksLikeMarker(plain) ? { $object: plain } : plain
}
const MARKERS = ['$undefined', '$num', '$bigint', '$utf16', '$map', '$set', '$date', '$bytes', '$buffer', '$typed', '$object']
const looksLikeMarker = (v) => {
  const keys = Object.keys(v)
  return keys.length === 1 && MARKERS.includes(keys[0])
}
const dec = (v) => {
  if (Array.isArray(v)) return v.map(dec)
  if (v === null || typeof v !== 'object') return v
  if (!looksLikeMarker(v)) return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, dec(x)]))
  if ('$object' in v) return Object.fromEntries(Object.entries(v.$object).map(([k, x]) => [k, dec(x)]))
  if ('$undefined' in v) return undefined
  if ('$num' in v) return Number(v.$num)
  if ('$bigint' in v) return BigInt(v.$bigint)
  if ('$utf16' in v) {
    let text = ''
    for (let i = 0; i < v.$utf16.length; i += 8192)
      text += String.fromCharCode(...v.$utf16.slice(i, i + 8192))
    return text
  }
  if ('$map' in v) return new Map(v.$map.map(([k, x]) => [dec(k), dec(x)]))
  if ('$set' in v) return new Set(v.$set.map(dec))
  if ('$date' in v) return new Date(v.$date)
  if ('$bytes' in v) return Uint8Array.from(v.$bytes)
  if ('$typed' in v) return globalThis[v.$typed.kind].from(v.$typed.values.map(dec))
  return Buffer.from(v.$buffer)
}
const canon = (v, sort) => {
  if (Array.isArray(v)) return v.map(x => canon(x, sort))
  if (v === null || typeof v !== 'object') return v
  const keys = Object.keys(v)
  if (sort) keys.sort()
  return Object.fromEntries(keys.map(k => [k, canon(v[k], sort)]))
}
const same = (a, b, sort = false) => JSON.stringify(canon(a, sort)) === JSON.stringify(canon(b, sort))


const pinCase = (() => {
  const now = process.env.RUST_ANYTHING_NOW_MS
  if (now === undefined) return () => {}
  const nowMs = Number(now)
  const seed = Number(process.env.RUST_ANYTHING_SEED ?? 0) >>> 0
  let state = seed
  const RealDate = Date
  class PinnedDate extends RealDate {
    constructor(...args) { super(...(args.length === 0 ? [nowMs] : args)) }
    static now() { return nowMs }
    static [Symbol.hasInstance](v) { return v instanceof RealDate }
  }
  globalThis.Date = new Proxy(PinnedDate, { apply: () => new RealDate(nowMs).toString() })
  Math.random = () => {
    state = (state + 0x6D2B79F5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  return (index) => {
    state = seed
    process.env.RUST_ANYTHING_CASE = String(index)
  }
})()


import { readFileSync, writeFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

const [modulePath, casesPath, outPath, keyOrder] = process.argv.slice(2)
const loaded = await import(pathToFileURL(modulePath).href)
const mod = { ...(loaded.default && typeof loaded.default === 'object' ? loaded.default : {}), ...loaded }
const cases = readFileSync(casesPath, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l))
const summary = { total: cases.length, passed: 0, failed: 0, missing: [], mismatches: [] }
const scenario = async (Class, c) => {
  const results = []
  let instance
  try {
    instance = new Class(...c.ctor.map(dec))
    results.push({ ok: true })
  }
  catch (error) {
    results.push({ error: String(error?.message ?? error) })
    return results
  }
  for (const call of c.calls) {
    try {
      results.push({ ok: enc(await instance[call.method](...call.args.map(dec))) })
    }
    catch (error) {
      results.push({ error: String(error?.message ?? error) })
    }
  }
  return results
}
const stepsMatch = (want, got) => want.length === got.length && want.every((w, i) =>
  ('error' in w && 'error' in got[i] && !got[i].error.startsWith('Rust panic:')) || ('ok' in w && 'ok' in got[i] && same(w.ok, got[i].ok, keyOrder === 'sort')))
for (const [index, c] of cases.entries()) {
  pinCase(index)
  if (c.class) {
    const Class = mod[c.class]
    if (typeof Class !== 'function') {
      if (!summary.missing.includes(c.class)) summary.missing.push(c.class)
      summary.failed++
      continue
    }
    const got = await scenario(Class, c)
    if (stepsMatch(c.results, got)) {
      summary.passed++
    }
    else {
      summary.failed++
      summary.mismatches.push({ fn: c.class, args: [c.ctor, c.calls], expected: c.results, actual: got })
    }
    continue
  }
  const fn = mod[c.fn]
  let actual
  if (typeof fn !== 'function') {
    if (!summary.missing.includes(c.fn)) summary.missing.push(c.fn)
    actual = { missing: true }
  }
  else {
    try {
      actual = { ok: enc(await fn(...c.args.map(dec))) }
    }
    catch (error) {
      actual = { error: String(error?.message ?? error) }
    }
  }
  const expected = 'error' in c ? { error: c.error } : { ok: c.ok }
  // Both sides throwing counts as agreement: error messages are not part of the contract.
  const panicked = 'error' in actual && actual.error.startsWith('Rust panic:')
  const pass = !panicked && ('error' in expected && 'error' in actual) || ('ok' in expected && 'ok' in actual && same(expected.ok, actual.ok, keyOrder === 'sort'))
  if (pass) {
    summary.passed++
  }
  else {
    summary.failed++
    summary.mismatches.push({ fn: c.fn, args: c.args, expected, actual })
  }
}
writeFileSync(outPath, JSON.stringify(summary, null, 2))
