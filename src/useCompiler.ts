import { useEffect, useRef, useState } from 'react'
import { candidates } from './demo'
export function useCompiler(source: string) {
  const [result, setResult] = useState({ css: '', error: '', pending: true })
  const worker = useRef<Worker | null>(null)
  const sequence = useRef(0)
  useEffect(function startCompiler() {
    const instance = new Worker(new URL('./compiler.worker.ts', import.meta.url), { type: 'module' })
    worker.current = instance
    instance.onmessage = (event: MessageEvent<{ id: number; css?: string; error?: string }>) => {
      if (event.data.id !== sequence.current) return
      setResult(previous => ({ css: event.data.css ?? previous.css, error: event.data.error ?? '', pending: false }))
    }
    instance.onerror = e => setResult(previous => ({ ...previous, error: e.message, pending: false }))
    return () => instance.terminate()
  }, [])
  useEffect(function compilePreview() {
    const id = ++sequence.current
    setResult(previous => ({ ...previous, pending: true }))
    const timer = setTimeout(() => worker.current?.postMessage({ id, source, candidates }), 180)
    return () => clearTimeout(timer)
  }, [source])
  return result
}
