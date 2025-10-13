// src/components/Composer.tsx
'use client'

import { useState } from 'react'
import type { Visibility } from '@prisma/client'

const VIS_OPTS: Visibility[] = ['PUBLIC', 'FOLLOWERS', 'TRUSTED']

export default function Composer() {
  const [body, setBody] = useState('')
  const [assistive, setAssistive] = useState(false)
  const [visibility, setVisibility] = useState<Visibility>('PUBLIC')
  const [msg, setMsg] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const onPaste: React.ClipboardEventHandler<HTMLTextAreaElement> = (e) => {
    if (!assistive) {
      e.preventDefault()
      setMsg('Paste blocked to encourage typed input. Toggle Assistive Mode if needed.')
    }
  }

  async function submit() {
    const text = body.trim()
    if (!text) { setMsg('Type something first.'); return }
    setBusy(true); setMsg(null)
    const r = await fetch('/api/posts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body: text, visibility }),
    })
    setBusy(false)
    if (r.status === 429) { setMsg('Posting quota reached.'); return }
    const j = await r.json()
    if (j.ok) { setBody(''); setMsg(null); location.reload() }
    else { setMsg(j.error || 'Something went wrong.') }
  }

  return (
    <div className="rounded border p-3">
      <label className="block text-sm font-medium mb-1">Compose (typed only)</label>
      <textarea
        value={body}
        onChange={e => setBody(e.target.value)}
        onPaste={onPaste}
        rows={4}
        maxLength={500}
        className="w-full rounded border p-2 outline-none"
        placeholder="Type your thought… #hashtags work"
      />
      <div className="mt-2 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <label className="text-xs">
            <input type="checkbox" className="mr-1" checked={assistive} onChange={e => setAssistive(e.target.checked)} />
            Assistive Mode (allows paste)
          </label>
          <label className="text-xs">
            <span className="mr-1">Visibility:</span>
            <select
              value={visibility}
              onChange={e => setVisibility(e.target.value as Visibility)}
              className="rounded border px-2 py-1 text-xs"
            >
              {VIS_OPTS.map(v => <option key={v} value={v}>{v}</option>)}
            </select>
          </label>
        </div>
        <button onClick={submit} disabled={busy} className="rounded bg-black text-white px-3 py-1 text-sm disabled:opacity-50">
          {busy ? 'Posting…' : 'Post'}
        </button>
      </div>
      {msg && <p className="mt-2 text-xs text-red-600">{msg}</p>}
    </div>
  )
}
