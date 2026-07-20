import React, { useState } from 'react';
import type { AgentTask, AgentTaskInput } from '../../store/types';
import { COUNTRIES } from '../../data/countries';

const api = (window as any).api;

interface TaskFormProps {
  onCreated: (task: AgentTask) => void;
  onCancel: () => void;
}

const PROXY_PLACEHOLDER = [
  '104.248.63.15:8080',
  '104.248.63.16:8080:myuser:mypass',
  'http://user:pass@1.2.3.4:3128',
  'socks5://user:pass@5.6.7.8:1080',
].join('\n');

export function TaskForm({ onCreated, onCancel }: TaskFormProps) {
  const [form, setForm] = useState({
    name: '',
    keyword: '',
    urls: '',
    countryCode: 'US',
    proxyList: '',          // one per line, rotated per visit
    visitCount: 5,
    deviceType: 'desktop' as 'desktop' | 'mobile' | 'tablet',
    timeOnPageMin: 20,
    timeOnPageMax: 60,
    scrollSpeed: 'medium' as 'slow' | 'medium' | 'fast',
    clickInternalLinks: false,
    maxInternalLinks: 3,
  });

  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedCountry = COUNTRIES.find((c) => c.code === form.countryCode);
  const set = (key: string, val: unknown) => setForm((p) => ({ ...p, [key]: val }));

  const handleSubmit = async () => {
    setError(null);

    const urlList = form.urls.split('\n').map((u) => u.trim()).filter(Boolean);
    if (urlList.length === 0) { setError('Please enter at least one target URL.'); return; }

    const proxyList = form.proxyList.split('\n').map((p) => p.trim()).filter(Boolean);

    setCreating(true);
    try {
      const input: AgentTaskInput = {
        name: form.name.trim() || `Task ${new Date().toLocaleTimeString()}`,
        keyword: form.keyword,
        urls: urlList,
        country: selectedCountry?.name || 'United States',
        countryCode: form.countryCode,
        proxyList,
        visitCount: form.visitCount,
        deviceType: form.deviceType,
        timeOnPageMin: form.timeOnPageMin,
        timeOnPageMax: form.timeOnPageMax,
        scrollSpeed: form.scrollSpeed,
        clickInternalLinks: form.clickInternalLinks,
        maxInternalLinks: form.maxInternalLinks,
      };
      const task: AgentTask = await api.agent.createTask(input);
      if (!task) throw new Error('No response from main process');
      onCreated(task);
    } catch (err: any) {
      setError(`Failed to create task: ${err?.message ?? String(err)}`);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="glass rounded-xl p-4 flex flex-col gap-3">
      <div style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.85)', marginBottom: 4 }}>
        New Agent Task
      </div>

      {error && (
        <div style={{
          background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)',
          borderRadius: 8, padding: '8px 12px', fontSize: 12, color: '#f87171',
        }}>
          {error}
        </div>
      )}

      {/* Task name */}
      <div>
        <label className="form-label">Task Name <span style={{ color: 'rgba(255,255,255,0.3)' }}>(optional)</span></label>
        <input className="input-dark" placeholder="e.g. Boost homepage traffic"
          value={form.name} onChange={(e) => set('name', e.target.value)} />
      </div>

      {/* Keyword */}
      <div>
        <label className="form-label">
          Google Search Keyword{' '}
          <span style={{ color: 'rgba(255,255,255,0.3)' }}>(agent searches this, clicks your URL)</span>
        </label>
        <input className="input-dark" placeholder="e.g. best homes info guide"
          value={form.keyword} onChange={(e) => set('keyword', e.target.value)} />
      </div>

      {/* Target URLs */}
      <div>
        <label className="form-label">
          Target URLs <span style={{ color: '#f87171' }}>*</span>{' '}
          <span style={{ color: 'rgba(255,255,255,0.35)' }}>(one per line)</span>
        </label>
        <textarea className="input-dark" rows={3}
          placeholder={'https://example.com\nhttps://site2.com'}
          value={form.urls} onChange={(e) => set('urls', e.target.value)}
          style={{ resize: 'vertical', lineHeight: 1.5, fontFamily: 'inherit' }} />
      </div>

      {/* Country */}
      <div>
        <label className="form-label">Country / Location</label>
        <select className="input-dark" value={form.countryCode}
          onChange={(e) => set('countryCode', e.target.value)} style={{ appearance: 'auto' }}>
          {COUNTRIES.map((c) => (
            <option key={c.code} value={c.code}>{c.flag} {c.name}</option>
          ))}
        </select>
      </div>

      {/* Proxy list */}
      <div>
        <label className="form-label">
          Proxy List{' '}
          <span style={{ color: 'rgba(255,255,255,0.3)' }}>(one per line — rotated per visit)</span>
        </label>
        <textarea className="input-dark" rows={4}
          placeholder={PROXY_PLACEHOLDER}
          value={form.proxyList} onChange={(e) => set('proxyList', e.target.value)}
          style={{ resize: 'vertical', lineHeight: 1.5, fontFamily: 'monospace', fontSize: 11 }} />
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 4, lineHeight: 1.5 }}>
          Formats: <code style={{ color: 'rgba(255,255,255,0.5)' }}>host:port</code> · <code style={{ color: 'rgba(255,255,255,0.5)' }}>host:port:user:pass</code> · <code style={{ color: 'rgba(255,255,255,0.5)' }}>socks5://user:pass@host:port</code>
          <br />Each visit gets a fresh IP. Leave empty to run without proxy.
        </div>
      </div>

      {/* Visit count */}
      <div>
        <label className="form-label">Visits per URL</label>
        <div className="flex items-center gap-3">
          <input type="range" min={1} max={100} value={form.visitCount}
            onChange={(e) => set('visitCount', parseInt(e.target.value))}
            style={{ flex: 1, accentColor: '#6366f1' }} />
          <span style={{ fontSize: 13, fontWeight: 600, color: '#a5b4fc', minWidth: 28, textAlign: 'right' }}>
            {form.visitCount}
          </span>
        </div>
      </div>

      {/* Device type */}
      <div>
        <label className="form-label">Device Type</label>
        <div className="flex gap-2">
          {(['desktop', 'mobile', 'tablet'] as const).map((d) => (
            <button key={d} onClick={() => set('deviceType', d)} style={{
              flex: 1, padding: '7px 0', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer',
              border: `1px solid ${form.deviceType === d ? '#6366f1' : 'rgba(255,255,255,0.1)'}`,
              background: form.deviceType === d ? 'rgba(99,102,241,0.2)' : 'transparent',
              color: form.deviceType === d ? '#a5b4fc' : 'rgba(255,255,255,0.5)',
              textTransform: 'capitalize',
            }}>
              {d === 'desktop' ? '🖥️' : d === 'mobile' ? '📱' : '📟'} {d}
            </button>
          ))}
        </div>
      </div>

      {/* Time on page */}
      <div>
        <label className="form-label">
          Time on Page:{' '}
          <span style={{ color: '#a5b4fc' }}>{form.timeOnPageMin}–{form.timeOnPageMax}s</span>
        </label>
        <div className="flex gap-3">
          <div className="flex-1">
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 4 }}>Min (s)</div>
            <input type="number" className="input-dark" min={5} max={300} value={form.timeOnPageMin}
              onChange={(e) => set('timeOnPageMin', Math.max(5, parseInt(e.target.value) || 20))} />
          </div>
          <div className="flex-1">
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 4 }}>Max (s)</div>
            <input type="number" className="input-dark" min={5} max={300} value={form.timeOnPageMax}
              onChange={(e) => set('timeOnPageMax', Math.max(form.timeOnPageMin + 5, parseInt(e.target.value) || 60))} />
          </div>
        </div>
      </div>

      {/* Scroll speed */}
      <div>
        <label className="form-label">Scroll Speed</label>
        <div className="flex gap-2">
          {(['slow', 'medium', 'fast'] as const).map((s) => (
            <button key={s} onClick={() => set('scrollSpeed', s)} style={{
              flex: 1, padding: '7px 0', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer',
              border: `1px solid ${form.scrollSpeed === s ? '#6366f1' : 'rgba(255,255,255,0.1)'}`,
              background: form.scrollSpeed === s ? 'rgba(99,102,241,0.2)' : 'transparent',
              color: form.scrollSpeed === s ? '#a5b4fc' : 'rgba(255,255,255,0.5)',
              textTransform: 'capitalize',
            }}>
              {s === 'slow' ? '🐢' : s === 'medium' ? '🚶' : '🐇'} {s}
            </button>
          ))}
        </div>
      </div>

      {/* Internal links */}
      <div className="glass rounded-lg p-3 flex flex-col gap-2">
        <label style={{
          display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer',
          fontSize: 12, color: 'rgba(255,255,255,0.7)', fontWeight: 500,
        }}>
          <input type="checkbox" checked={form.clickInternalLinks}
            onChange={(e) => set('clickInternalLinks', e.target.checked)}
            style={{ accentColor: '#6366f1' }} />
          Browse internal links (extends session time &amp; pages viewed)
        </label>
        {form.clickInternalLinks && (
          <div>
            <label className="form-label">Max internal pages per visit</label>
            <input type="number" className="input-dark" min={1} max={20}
              value={form.maxInternalLinks}
              onChange={(e) => set('maxInternalLinks', Math.max(1, parseInt(e.target.value) || 3))} />
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-2 mt-1">
        <button className="btn-ghost flex-1" onClick={onCancel} disabled={creating}>Cancel</button>
        <button className="btn-primary flex-1" onClick={handleSubmit} disabled={creating}>
          {creating ? 'Creating…' : 'Create Task'}
        </button>
      </div>
    </div>
  );
}
