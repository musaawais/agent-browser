import React, { useState } from 'react';
import type { AgentTask, AgentTaskInput } from '../../store/types';
import { COUNTRIES } from '../../data/countries';

const api = (window as any).api;

interface TaskFormProps {
  onCreated: (task: AgentTask) => void;
  onCancel: () => void;
}

export function TaskForm({ onCreated, onCancel }: TaskFormProps) {
  const [form, setForm] = useState<{
    name: string;
    keyword: string;
    urls: string;
    countryCode: string;
    visitCount: number;
    deviceType: 'desktop' | 'mobile' | 'tablet';
    timeOnPageMin: number;
    timeOnPageMax: number;
    scrollSpeed: 'slow' | 'medium' | 'fast';
    clickInternalLinks: boolean;
    maxInternalLinks: number;
    useProxy: boolean;
    customProxyHost: string;
    customProxyPort: number;
    customProxyProtocol: 'http' | 'socks5';
  }>({
    name: '',
    keyword: '',
    urls: '',
    countryCode: 'US',
    visitCount: 5,
    deviceType: 'desktop',
    timeOnPageMin: 20,
    timeOnPageMax: 60,
    scrollSpeed: 'medium',
    clickInternalLinks: false,
    maxInternalLinks: 3,
    useProxy: false,
    customProxyHost: '',
    customProxyPort: 8080,
    customProxyProtocol: 'http',
  });

  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedCountry = COUNTRIES.find((c) => c.code === form.countryCode);
  const defaultProxy = selectedCountry?.proxies[0];

  const handleSubmit = async () => {
    setError(null);

    const urlList = form.urls
      .split('\n')
      .map((u) => u.trim())
      .filter(Boolean);

    if (urlList.length === 0) {
      setError('Please enter at least one target URL.');
      return;
    }

    setCreating(true);
    try {
      let proxyHost = '';
      let proxyPort = 8080;
      let proxyProtocol: 'http' | 'socks5' = 'http';

      if (form.useProxy && form.customProxyHost) {
        proxyHost = form.customProxyHost;
        proxyPort = form.customProxyPort;
        proxyProtocol = form.customProxyProtocol;
      } else if (defaultProxy) {
        proxyHost = defaultProxy.host;
        proxyPort = defaultProxy.port;
        proxyProtocol = defaultProxy.protocol;
      }

      const input: AgentTaskInput = {
        name: form.name.trim() || `Task ${new Date().toLocaleTimeString()}`,
        keyword: form.keyword,
        urls: urlList,
        country: selectedCountry?.name || 'United States',
        countryCode: form.countryCode,
        proxyHost,
        proxyPort,
        proxyProtocol,
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
      console.error('createTask failed:', err);
      setError(`Failed to create task: ${err?.message ?? String(err)}`);
    } finally {
      setCreating(false);
    }
  };

  const set = (key: string, val: unknown) =>
    setForm((prev) => ({ ...prev, [key]: val }));

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
        <input
          className="input-dark"
          placeholder="e.g. Research competitor pricing"
          value={form.name}
          onChange={(e) => set('name', e.target.value)}
        />
      </div>

      {/* Keyword */}
      <div>
        <label className="form-label">Research Keyword <span style={{ color: 'rgba(255,255,255,0.3)' }}>(optional)</span></label>
        <input
          className="input-dark"
          placeholder="e.g. best SEO tools 2024"
          value={form.keyword}
          onChange={(e) => set('keyword', e.target.value)}
        />
      </div>

      {/* URLs */}
      <div>
        <label className="form-label">
          Target URLs <span style={{ color: '#f87171' }}>*</span>{' '}
          <span style={{ color: 'rgba(255,255,255,0.35)' }}>(one per line)</span>
        </label>
        <textarea
          className="input-dark"
          rows={4}
          placeholder={'https://example.com\nhttps://site2.com'}
          value={form.urls}
          onChange={(e) => set('urls', e.target.value)}
          style={{ resize: 'vertical', lineHeight: 1.5, fontFamily: 'inherit' }}
        />
      </div>

      {/* Country */}
      <div>
        <label className="form-label">Agent Country / Location</label>
        <select
          className="input-dark"
          value={form.countryCode}
          onChange={(e) => set('countryCode', e.target.value)}
          style={{ appearance: 'auto' }}
        >
          {COUNTRIES.map((c) => (
            <option key={c.code} value={c.code}>
              {c.flag} {c.name}
            </option>
          ))}
        </select>
        {defaultProxy && (
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 4 }}>
            Using proxy: {defaultProxy.host}:{defaultProxy.port} ({defaultProxy.protocol.toUpperCase()})
          </div>
        )}
      </div>

      {/* Custom proxy */}
      <div>
        <label style={{
          display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer',
          fontSize: 12, color: 'rgba(255,255,255,0.7)', fontWeight: 500,
        }}>
          <input
            type="checkbox"
            checked={form.useProxy}
            onChange={(e) => set('useProxy', e.target.checked)}
            style={{ accentColor: '#6366f1' }}
          />
          Use custom proxy
        </label>
        {form.useProxy && (
          <div className="flex gap-2 mt-2">
            <input className="input-dark flex-1" placeholder="Host"
              value={form.customProxyHost}
              onChange={(e) => set('customProxyHost', e.target.value)} />
            <input className="input-dark" placeholder="Port" type="number"
              value={form.customProxyPort}
              onChange={(e) => set('customProxyPort', parseInt(e.target.value) || 8080)}
              style={{ width: 70 }} />
            <select className="input-dark" value={form.customProxyProtocol}
              onChange={(e) => set('customProxyProtocol', e.target.value)}
              style={{ width: 90, appearance: 'auto' }}>
              <option value="http">HTTP</option>
              <option value="socks5">SOCKS5</option>
            </select>
          </div>
        )}
      </div>

      {/* Visit count */}
      <div>
        <label className="form-label">Number of Visits per URL</label>
        <div className="flex items-center gap-3">
          <input
            type="range" min={1} max={100} value={form.visitCount}
            onChange={(e) => set('visitCount', parseInt(e.target.value))}
            style={{ flex: 1, accentColor: '#6366f1' }}
          />
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
            <button
              key={d}
              onClick={() => set('deviceType', d)}
              style={{
                flex: 1, padding: '7px 0', borderRadius: 8, fontSize: 12, fontWeight: 600,
                border: `1px solid ${form.deviceType === d ? '#6366f1' : 'rgba(255,255,255,0.1)'}`,
                background: form.deviceType === d ? 'rgba(99,102,241,0.2)' : 'transparent',
                color: form.deviceType === d ? '#a5b4fc' : 'rgba(255,255,255,0.5)',
                cursor: 'pointer', textTransform: 'capitalize',
              }}
            >
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
            <input type="number" className="input-dark" min={5} max={300}
              value={form.timeOnPageMin}
              onChange={(e) => set('timeOnPageMin', Math.max(5, parseInt(e.target.value) || 20))} />
          </div>
          <div className="flex-1">
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 4 }}>Max (s)</div>
            <input type="number" className="input-dark" min={5} max={300}
              value={form.timeOnPageMax}
              onChange={(e) => set('timeOnPageMax', Math.max(form.timeOnPageMin + 5, parseInt(e.target.value) || 60))} />
          </div>
        </div>
      </div>

      {/* Scroll speed */}
      <div>
        <label className="form-label">Scroll Speed</label>
        <div className="flex gap-2">
          {(['slow', 'medium', 'fast'] as const).map((s) => (
            <button
              key={s}
              onClick={() => set('scrollSpeed', s)}
              style={{
                flex: 1, padding: '7px 0', borderRadius: 8, fontSize: 12, fontWeight: 600,
                border: `1px solid ${form.scrollSpeed === s ? '#6366f1' : 'rgba(255,255,255,0.1)'}`,
                background: form.scrollSpeed === s ? 'rgba(99,102,241,0.2)' : 'transparent',
                color: form.scrollSpeed === s ? '#a5b4fc' : 'rgba(255,255,255,0.5)',
                cursor: 'pointer', textTransform: 'capitalize',
              }}
            >
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
          <input
            type="checkbox"
            checked={form.clickInternalLinks}
            onChange={(e) => set('clickInternalLinks', e.target.checked)}
            style={{ accentColor: '#6366f1' }}
          />
          Click &amp; navigate internal links
        </label>
        {form.clickInternalLinks && (
          <div>
            <label className="form-label">Max internal links per page</label>
            <input
              type="number" className="input-dark" min={1} max={20}
              value={form.maxInternalLinks}
              onChange={(e) => set('maxInternalLinks', Math.max(1, parseInt(e.target.value) || 3))}
            />
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-2 mt-1">
        <button className="btn-ghost flex-1" onClick={onCancel} disabled={creating}>
          Cancel
        </button>
        <button
          className="btn-primary flex-1"
          onClick={handleSubmit}
          disabled={creating}
        >
          {creating ? 'Creating…' : 'Create Task'}
        </button>
      </div>
    </div>
  );
}
