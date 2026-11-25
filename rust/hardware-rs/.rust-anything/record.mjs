
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


import { appendFileSync, readFileSync, writeFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

const [inputsPath, outPath] = process.argv.slice(2)
const inputs = JSON.parse(readFileSync(inputsPath, 'utf8'))
const modules = new Map()
const progress = process.env.RUST_ANYTHING_PROGRESS
writeFileSync(outPath, '')
const lines = { push: line => appendFileSync(outPath, `${line}\n`) }
// A class scenario: construct, then call each method in turn; every step's result is recorded.
const runScenario = async (Class, c) => {
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
for (const [index, c] of inputs.entries()) {
  if (progress) appendFileSync(progress, `${index}\n`)
  let mod = modules.get(c.module)
  if (!mod) {
    mod = await import(pathToFileURL(c.module).href)
    modules.set(c.module, mod)
  }
  if (c.class) {
    const Class = mod[c.class] ?? mod.default?.[c.class]
    if (typeof Class !== 'function') {
      console.error(`${c.class} is not a class exported by ${c.module}`)
      process.exit(2)
    }
    pinCase(index)
    lines.push(JSON.stringify({ class: c.class, ctor: c.ctor, calls: c.calls, results: await runScenario(Class, c) }))
    continue
  }
  const fn = mod[c.fn] ?? mod.default?.[c.fn]
  if (typeof fn !== 'function') {
    console.error(`${c.fn} is not a function exported by ${c.module}`)
    process.exit(2)
  }
  pinCase(index)
  try {
    const value = await fn(...c.args.map(dec))
    lines.push(JSON.stringify({ fn: c.fn, args: c.args, ok: enc(value) }))
  }
  catch (error) {
    lines.push(JSON.stringify({ fn: c.fn, args: c.args, error: String(error?.message ?? error) }))
  }
}
