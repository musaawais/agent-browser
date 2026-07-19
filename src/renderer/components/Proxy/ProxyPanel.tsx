import React, { useState, useEffect } from 'react';
import { COUNTRIES, type Country } from '../../data/countries';

const api = (window as any).api;

interface ProxyState {
  enabled: boolean;
  current: {
    country: string;
    countryCode: string;
    host: string;
    port: number;
    protocol: 'http' | 'socks5';
  } | null;
}

export function ProxyPanel() {
  const [proxyState, setProxyState] = useState<ProxyState>({ enabled: false, current: null });
  const [selectedCountry, setSelectedCountry] = useState<Country | null>(null);
  const [selectedProxyIdx, setSelectedProxyIdx] = useState(0);
  const [customMode, setCustomMode] = useState(false);
  const [customHost, setCustomHost] = useState('');
  const [customPort, setCustomPort] = useState('8080');
  const [customProtocol, setCustomProtocol] = useState<'http' | 'socks5'>('http');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => {
    api.proxy.getState().then(setProxyState);
  }, []);

  const filteredCountries = COUNTRIES.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.code.toLowerCase().includes(search.toLowerCase())
  );

  const handleConnect = async () => {
    setLoading(true);
    try {
      if (customMode) {
        if (!customHost || !customPort) return;
        await api.proxy.set({
          country: 'Custom',
          countryCode: 'XX',
          host: customHost,
          port: parseInt(customPort),
          protocol: customProtocol,
          username: username || undefined,
          password: password || undefined,
        });
        setProxyState({
          enabled: true,
          current: { country: 'Custom', countryCode: 'XX', host: customHost, port: parseInt(customPort), protocol: customProtocol },
        });
      } else if (selectedCountry) {
        const proxy = selectedCountry.proxies[selectedProxyIdx] || selectedCountry.proxies[0];
        await api.proxy.set({
          country: selectedCountry.name,
          countryCode: selectedCountry.code,
          host: proxy.host,
          port: proxy.port,
          protocol: proxy.protocol,
          username: username || undefined,
          password: password || undefined,
        });
        setProxyState({
          enabled: true,
          current: { country: selectedCountry.name, countryCode: selectedCountry.code, host: proxy.host, port: proxy.port, protocol: proxy.protocol },
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = async () => {
    setLoading(true);
    try {
      await api.proxy.clear();
      setProxyState({ enabled: false, current: null });
    } finally {
      setLoading(false);
    }
  };

  const countryForCode = proxyState.current
    ? COUNTRIES.find((c) => c.code === proxyState.current?.countryCode)
    : null;

  return (
    <div className="flex flex-col gap-4 p-4">
      {/* Status card */}
      <div className="glass rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <span style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.5)', letterSpacing: '0.06em' }}>
            STATUS
          </span>
          <span
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6, padding: '3px 10px',
              borderRadius: 99, fontSize: 12, fontWeight: 600,
              background: proxyState.enabled ? 'rgba(34,197,94,0.15)' : 'rgba(156,163,175,0.12)',
              color: proxyState.enabled ? '#4ade80' : '#9ca3af',
            }}
          >
            <span
              style={{
                width: 6, height: 6, borderRadius: '50%',
                background: proxyState.enabled ? '#4ade80' : '#6b7280',
                animation: proxyState.enabled ? 'pulse 1.5s ease-in-out infinite' : 'none',
              }}
            />
            {proxyState.enabled ? 'Connected' : 'Not Connected'}
          </span>
        </div>

        {proxyState.enabled && proxyState.current && (
          <div className="flex flex-col gap-1" style={{ fontSize: 12 }}>
            <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 15, fontWeight: 600 }}>
              {countryForCode?.flag} {proxyState.current.country}
            </div>
            <div style={{ color: 'rgba(255,255,255,0.4)' }}>
              {proxyState.current.protocol.toUpperCase()} · {proxyState.current.host}:{proxyState.current.port}
            </div>
          </div>
        )}

        {proxyState.enabled ? (
          <button className="btn-danger w-full mt-3" onClick={handleDisconnect} disabled={loading}>
            {loading ? 'Disconnecting…' : 'Disconnect'}
          </button>
        ) : null}
      </div>

      {/* Mode toggle */}
      <div className="flex gap-2">
        <button
          onClick={() => setCustomMode(false)}
          style={{
            flex: 1, padding: '7px 0', borderRadius: 8, fontSize: 12, fontWeight: 600,
            border: `1px solid ${!customMode ? '#6366f1' : 'rgba(255,255,255,0.1)'}`,
            background: !customMode ? 'rgba(99,102,241,0.2)' : 'transparent',
            color: !customMode ? '#a5b4fc' : 'rgba(255,255,255,0.5)',
            cursor: 'pointer',
          }}
        >
          🌍 Country List
        </button>
        <button
          onClick={() => setCustomMode(true)}
          style={{
            flex: 1, padding: '7px 0', borderRadius: 8, fontSize: 12, fontWeight: 600,
            border: `1px solid ${customMode ? '#6366f1' : 'rgba(255,255,255,0.1)'}`,
            background: customMode ? 'rgba(99,102,241,0.2)' : 'transparent',
            color: customMode ? '#a5b4fc' : 'rgba(255,255,255,0.5)',
            cursor: 'pointer',
          }}
        >
          ⚙️ Custom
        </button>
      </div>

      {!customMode ? (
        <>
          {/* Country search */}
          <input
            className="input-dark"
            placeholder="Search countries…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          {/* Country list */}
          <div
            className="flex flex-col gap-1"
            style={{ maxHeight: 280, overflowY: 'auto' }}
          >
            {filteredCountries.map((country) => (
              <button
                key={country.code}
                onClick={() => { setSelectedCountry(country); setSelectedProxyIdx(0); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px',
                  borderRadius: 10, border: `1px solid ${selectedCountry?.code === country.code ? '#6366f1' : 'transparent'}`,
                  background: selectedCountry?.code === country.code ? 'rgba(99,102,241,0.15)' : 'rgba(255,255,255,0.03)',
                  color: selectedCountry?.code === country.code ? '#e8e8f0' : 'rgba(255,255,255,0.65)',
                  cursor: 'pointer', textAlign: 'left', width: '100%', fontSize: 13,
                }}
              >
                <span style={{ fontSize: 18 }}>{country.flag}</span>
                <span style={{ flex: 1, fontWeight: 500 }}>{country.name}</span>
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>
                  {country.proxies.length} proxy{country.proxies.length !== 1 ? 's' : ''}
                </span>
              </button>
            ))}
          </div>

          {/* Proxy selection for country */}
          {selectedCountry && selectedCountry.proxies.length > 1 && (
            <div>
              <label className="form-label">Select Server</label>
              <div className="flex flex-col gap-1">
                {selectedCountry.proxies.map((p, i) => (
                  <button
                    key={i}
                    onClick={() => setSelectedProxyIdx(i)}
                    style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: '7px 10px', borderRadius: 8, fontSize: 12,
                      border: `1px solid ${selectedProxyIdx === i ? '#6366f1' : 'rgba(255,255,255,0.08)'}`,
                      background: selectedProxyIdx === i ? 'rgba(99,102,241,0.15)' : 'transparent',
                      color: selectedProxyIdx === i ? '#a5b4fc' : 'rgba(255,255,255,0.5)',
                      cursor: 'pointer',
                    }}
                  >
                    <span>{p.host}:{p.port}</span>
                    <span style={{
                      padding: '2px 6px', borderRadius: 4, fontSize: 10, fontWeight: 600,
                      background: p.speed === 'fast' ? 'rgba(34,197,94,0.15)' : p.speed === 'medium' ? 'rgba(234,179,8,0.15)' : 'rgba(239,68,68,0.15)',
                      color: p.speed === 'fast' ? '#4ade80' : p.speed === 'medium' ? '#facc15' : '#f87171',
                    }}>
                      {p.speed}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </>
      ) : (
        <>
          {/* Custom proxy form */}
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="form-label">Host / IP</label>
              <input className="input-dark" placeholder="proxy.example.com"
                value={customHost} onChange={(e) => setCustomHost(e.target.value)} />
            </div>
            <div style={{ width: 80 }}>
              <label className="form-label">Port</label>
              <input className="input-dark" type="number" placeholder="8080"
                value={customPort} onChange={(e) => setCustomPort(e.target.value)} />
            </div>
          </div>
          <div>
            <label className="form-label">Protocol</label>
            <div className="flex gap-2">
              {(['http', 'socks5'] as const).map((p) => (
                <button key={p} onClick={() => setCustomProtocol(p)}
                  style={{
                    flex: 1, padding: '7px 0', borderRadius: 8, fontSize: 12, fontWeight: 600,
                    border: `1px solid ${customProtocol === p ? '#6366f1' : 'rgba(255,255,255,0.1)'}`,
                    background: customProtocol === p ? 'rgba(99,102,241,0.2)' : 'transparent',
                    color: customProtocol === p ? '#a5b4fc' : 'rgba(255,255,255,0.5)', cursor: 'pointer',
                  }}>
                  {p.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="form-label">Username (optional)</label>
              <input className="input-dark" placeholder="user"
                value={username} onChange={(e) => setUsername(e.target.value)} />
            </div>
            <div className="flex-1">
              <label className="form-label">Password (optional)</label>
              <input className="input-dark" type="password" placeholder="••••••"
                value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
          </div>
        </>
      )}

      {/* Auth fields for country mode */}
      {!customMode && (
        <div className="flex gap-2">
          <div className="flex-1">
            <label className="form-label">Username (optional)</label>
            <input className="input-dark" placeholder="user"
              value={username} onChange={(e) => setUsername(e.target.value)} />
          </div>
          <div className="flex-1">
            <label className="form-label">Password (optional)</label>
            <input className="input-dark" type="password" placeholder="••••••"
              value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
        </div>
      )}

      {/* Connect button */}
      {!proxyState.enabled && (
        <button
          className="btn-primary w-full"
          onClick={handleConnect}
          disabled={loading || (!customMode && !selectedCountry)}
        >
          {loading ? 'Connecting…' : '🔒 Connect'}
        </button>
      )}
    </div>
  );
}
