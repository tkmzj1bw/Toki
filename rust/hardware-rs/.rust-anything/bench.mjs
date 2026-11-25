
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


import { readFileSync, writeFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

const [modulesPath, nativePath, casesPath, outPath, minMs] = process.argv.slice(2)
const { functions: modules, classes: classModules, asyncFunctions } = JSON.parse(readFileSync(modulesPath, 'utf8'))
const loaded = await import(pathToFileURL(nativePath).href)
const native = { ...(loaded.default && typeof loaded.default === 'object' ? loaded.default : {}), ...loaded }
const cases = readFileSync(casesPath, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l))
const byFn = new Map()
const scenarios = new Map()
for (const c of cases.filter(c => c.class)) {
  if (!scenarios.has(c.class)) scenarios.set(c.class, [])
  scenarios.get(c.class).push(c)
}
for (const c of cases.filter(c => !c.class)) {
  if (!byFn.has(c.fn)) byFn.set(c.fn, [])
  byFn.get(c.fn).push(c.args.map(dec))
}
// Time whole passes over the cases until `minMs` has passed; errors count as calls.
const time = (fn, argsList) => {
  const pass = () => {
    for (const args of argsList) {
      try { fn(...args) } catch {}
    }
  }
  pass()
  let passes = 0
  const start = performance.now()
  do { pass(); passes++ } while (performance.now() - start < Number(minMs))
  return (performance.now() - start) * 1e6 / (passes * argsList.length)
}
const timeAsync = async (fn, argsList) => {
  const pass = async () => {
    for (const args of argsList) {
      try { await fn(...args) } catch {}
    }
  }
  await pass()
  let passes = 0
  const start = performance.now()
  do { await pass(); passes++ } while (performance.now() - start < Number(minMs))
  return (performance.now() - start) * 1e6 / (passes * argsList.length)
}
const rows = []
for (const [name, argsList] of byFn) {
  const original = (await import(pathToFileURL(modules[name]).href))[name]
  const rust = native[name]
  if (typeof original !== 'function' || typeof rust !== 'function') continue
  const timer = asyncFunctions.includes(name) ? timeAsync : time
  const originalNs = await timer(original, argsList)
  const rustNs = await timer(rust, argsList)
  rows.push({ fn: name, cases: argsList.length, original_ns: originalNs, rust_ns: rustNs, speedup: originalNs / rustNs })
}
// Classes: time whole scenarios (construct, then every call).
const play = (Class, list) => () => {
  for (const c of list) {
    try {
      const instance = new Class(...c.ctor.map(dec))
      for (const call of c.calls) {
        try { instance[call.method](...call.args.map(dec)) } catch {}
      }
    } catch {}
  }
}
for (const [name, list] of scenarios) {
  const original = (await import(pathToFileURL(classModules[name]).href))[name]
  const rust = native[name]
  if (typeof original !== 'function' || typeof rust !== 'function') continue
  const timeAll = (fn) => {
    fn()
    let passes = 0
    const start = performance.now()
    do { fn(); passes++ } while (performance.now() - start < Number(minMs))
    return (performance.now() - start) * 1e6 / (passes * list.length)
  }
  const originalNs = timeAll(play(original, list))
  const rustNs = timeAll(play(rust, list))
  rows.push({ fn: `class ${name}`, cases: list.length, original_ns: originalNs, rust_ns: rustNs, speedup: originalNs / rustNs })
}
writeFileSync(outPath, JSON.stringify(rows))
