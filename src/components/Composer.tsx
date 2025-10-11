'use client'

import { useState } from 'react'

export default function Composer() {
  const [body, setBody] = useState('')
  const [assistive, setAssistive] = useState(false)
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
    setBusy(true)
    const r = await fetch('/api/posts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body: text }),
    })
    setBusy(false)

    if (r.status === 429) { setMsg('Daily post limit reached. Try again tomorrow.'); return }
    const j = await r.json()
    if (j.ok) { setBody(''); setMsg(null); window.location.reload() }
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
      <div className="mt-2 flex items-center justify-between">
        <label className="text-xs">
          <input type="checkbox" className="mr-1" checked={assistive} onChange={e => setAssistive(e.target.checked)} />
          Assistive Mode (allows paste)
        </label>
        <button
          onClick={submit}
          disabled={busy}
          className="rounded bg-black text-white px-3 py-1 text-sm disabled:opacity-50"
        >
          {busy ? 'Posting…' : 'Post'}
        </button>
      </div>
      {msg && <p className="mt-2 text-xs text-red-600">{msg}</p>}
    </div>
  )
}
