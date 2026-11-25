
import { existsSync, statSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'

const extra = process.env.RUST_ANYTHING_RESOLVE_FROM
// tsconfig `paths`: exact keys first, then wildcard keys by longest prefix.
const aliasPriority = pattern => pattern.includes('*') ? pattern.indexOf('*') : Number.POSITIVE_INFINITY
const aliases = JSON.parse(process.env.RUST_ANYTHING_PATHS || '[]')
  .sort(([a], [b]) => aliasPriority(b) - aliasPriority(a))
// Workspace packages by name: `@x18n/core` and `@x18n/core/sub` resolve to source.
const workspace = JSON.parse(process.env.RUST_ANYTHING_WORKSPACE || '{}')
const workspaceTargets = (specifier) => {
  for (const [name, src] of Object.entries(workspace)) {
    if (specifier === name)
      return [`${src}/index`]
    if (specifier.startsWith(`${name}/`))
      return [`${src}/${specifier.slice(name.length + 1)}`, `${src}/${specifier.slice(name.length + 1)}/index`]
  }
  return []
}
const aliasTargets = (specifier) => {
  for (const [pattern, targets] of aliases) {
    const [prefix, suffix = ''] = pattern.split('*')
    const exact = !pattern.includes('*')
    if (exact ? specifier === pattern : specifier.startsWith(prefix) && specifier.endsWith(suffix) && specifier.length >= prefix.length + suffix.length) {
      const star = exact ? '' : specifier.slice(prefix.length, specifier.length - suffix.length)
      return targets.map(t => t.replace('*', () => star))
    }
  }
  return []
}
const suffixes = ['.ts', '.tsx', '.mts', '.js', '.mjs', '/index.ts', '/index.mts', '/index.js']
const sourceCandidates = path => {
  const exact = path.match(/\.(mjs|cjs|jsx)$/)
  if (exact) {
    const replacement = { mjs: 'mts', cjs: 'cts', jsx: 'tsx' }[exact[1]]
    return [path, path.slice(0, -exact[1].length) + replacement]
  }
  const stem = path.replace(/\.js$/, '')
  return [stem, ...suffixes.map(suffix => stem + suffix)]
}
const isFile = p => existsSync(p) && statSync(p).isFile()

export async function resolve(specifier, context, next) {
  // Aliases first: `@/x` is not even a valid package name for Node.
  for (const target of [...aliasTargets(specifier), ...workspaceTargets(specifier)]) {
    for (const candidate of sourceCandidates(target)) {
      if (isFile(candidate))
        return next(pathToFileURL(candidate).href, context)
    }
  }
  try {
    return await next(specifier, context)
  }
  catch (error) {
    const missing = error?.code === 'ERR_MODULE_NOT_FOUND' || error?.code === 'ERR_UNSUPPORTED_DIR_IMPORT'
    if (!missing || !context.parentURL)
      throw error
    if (specifier.startsWith('.') || specifier.startsWith('/')) {
      const path = fileURLToPath(new URL(specifier, context.parentURL))
      for (const candidate of sourceCandidates(path)) {
        if (isFile(candidate))
          return next(pathToFileURL(candidate).href, context)
      }
    }
    else if (extra) {
      return next(specifier, { ...context, parentURL: pathToFileURL(`${extra}/`).href })
    }
    throw error
  }
}
