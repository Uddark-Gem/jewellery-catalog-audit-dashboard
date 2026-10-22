import { useState, useEffect } from 'react';
import { DatabaseIcon, XIcon, CheckCircleIcon, AlertTriangleIcon, RefreshCwIcon, DownloadIcon } from './Icons';

export default function GoogleSheetsModal({ isOpen, onClose, activePanelId, activeRows = [], onSheetsConnected }) {
  const [status, setStatus] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [actionMessage, setActionMessage] = useState(null);

  const [spreadsheetId, setSpreadsheetId] = useState('1wKfFadJlQrMli9GTBljjb3m6HUJmazFG_uXAvFPsQlY');
  const [serviceAccountJson, setServiceAccountJson] = useState('');
  const [connectTab, setConnectTab] = useState('share'); // 'share' | 'service-account'

  const fetchStatus = async () => {
    setIsLoading(true);
    setActionMessage(null);
    try {
      const res = await fetch('/api/sheets/status');
      const data = await res.json();
      setStatus(data);
      if (data.spreadsheetId) {
        setSpreadsheetId(data.spreadsheetId);
      }
    } catch (err) {
      setStatus({ ready: false, error: err.message });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchStatus();
      setTestResult(null);
    }
  }, [isOpen]);

  const handleSaveConfiguration = async (e) => {
    if (e) e.preventDefault();
    setIsSaving(true);
    setActionMessage(null);
    try {
      const payload = {
        spreadsheetId: spreadsheetId.trim(),
      };
      if (serviceAccountJson.trim()) {
        payload.serviceAccountJson = serviceAccountJson.trim();
      }

      const res = await fetch('/api/sheets/configure', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to update configuration');
      }

      setStatus(data.status);
      setActionMessage({
        kind: data.status.ready ? 'success' : 'info',
        text: data.status.ready
          ? `Successfully connected to "${data.status.spreadsheetTitle}"!`
          : 'Spreadsheet ID saved. If using private access, please share with Service Account or set General Access to Anyone with Link.',
      });

      if (onSheetsConnected) onSheetsConnected();
    } catch (err) {
      setActionMessage({ kind: 'error', text: err.message });
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestConnection = async () => {
    setIsTesting(true);
    setActionMessage(null);
    try {
      const res = await fetch('/api/sheets/test', { method: 'POST' });
      const data = await res.json();
      setTestResult(data);
      if (data.success && onSheetsConnected) {
        onSheetsConnected();
      }
    } catch (err) {
      setTestResult({ success: false, error: err.message });
    } finally {
      setIsTesting(false);
    }
  };

  const handleExportPanelToSheet = async () => {
    if (!activePanelId || !activeRows || activeRows.length === 0) {
      setActionMessage({ kind: 'error', text: 'No rows in current panel to export.' });
      return;
    }

    setIsExporting(true);
    setActionMessage(null);
    try {
      const res = await fetch('/api/sheets/export-panel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ panelId: activePanelId, rows: activeRows }),
      });
      const data = await res.json();
      if (res.ok) {
        setActionMessage({
          kind: 'success',
          text: `Successfully exported ${data.rowsExported} rows to worksheet "${data.sheetTitle}" in Google Sheets!`,
        });
      } else {
        throw new Error(data.error || 'Failed to export');
      }
    } catch (err) {
      setActionMessage({ kind: 'error', text: err.message });
    } finally {
      setIsExporting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="relative w-full max-w-2xl rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl p-6 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
              <DatabaseIcon className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Google Sheets Database Integration
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Connect your Catalog DataBase Google Sheet to sync reference tables & audits
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <XIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="mt-4 space-y-4 max-h-[72vh] overflow-y-auto pr-1 text-slate-700 dark:text-slate-300 text-xs">
          {isLoading ? (
            <div className="flex items-center justify-center py-10 text-slate-500 gap-2">
              <RefreshCwIcon className="w-5 h-5 animate-spin text-blue-500" />
              <span>Checking Google Sheets connection...</span>
            </div>
          ) : status?.ready ? (
            <div className="space-y-4">
              {/* Connected Banner */}
              <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 flex items-start gap-3">
                <CheckCircleIcon className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-emerald-800 dark:text-emerald-300">
                    Google Sheets API Connected
                  </p>
                  <p className="text-emerald-700/80 dark:text-emerald-400/80 mt-0.5">
                    Spreadsheet: <span className="font-mono font-bold text-emerald-900 dark:text-emerald-200">{status.spreadsheetTitle}</span>
                  </p>
                </div>
              </div>

              {/* Details List */}
              <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-3.5 space-y-2 font-mono">
                {status.clientEmail && (
                  <div>
                    <span className="text-slate-500 dark:text-slate-400">Service Account:</span>{' '}
                    <span className="text-slate-800 dark:text-slate-200 break-all">{status.clientEmail}</span>
                  </div>
                )}
                <div>
                  <span className="text-slate-500 dark:text-slate-400">Spreadsheet ID:</span>{' '}
                  <span className="text-slate-800 dark:text-slate-200 break-all">{status.spreadsheetId}</span>
                </div>
                {status.sheets?.length > 0 && (
                  <div>
                    <span className="text-slate-500 dark:text-slate-400">Available Worksheets ({status.sheets.length}):</span>{' '}
                    <div className="flex flex-wrap gap-1 mt-1">
                      {status.sheets.map((s) => (
                        <span key={s} className="px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 font-sans text-[11px]">
                          {s}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap gap-2 pt-2">
                <button
                  type="button"
                  onClick={handleTestConnection}
                  disabled={isTesting}
                  className="px-3.5 py-2 rounded-lg font-semibold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 transition-colors flex items-center gap-1.5"
                >
                  <RefreshCwIcon className={`w-3.5 h-3.5 ${isTesting ? 'animate-spin' : ''}`} />
                  {isTesting ? 'Testing Read...' : 'Test Read Latency'}
                </button>

                {activeRows.length > 0 && (
                  <button
                    type="button"
                    onClick={handleExportPanelToSheet}
                    disabled={isExporting}
                    className="px-3.5 py-2 rounded-lg font-semibold bg-blue-600 hover:bg-blue-700 text-white transition-colors flex items-center gap-1.5 shadow-xs"
                  >
                    <DownloadIcon className="w-3.5 h-3.5" />
                    {isExporting ? 'Exporting...' : `Export ${activeRows.length} rows to Sheet`}
                  </button>
                )}
              </div>

              {/* Test Result Callout */}
              {testResult && (
                <div className={`p-3 rounded-lg ${testResult.success ? 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300' : 'bg-red-50 text-red-700'}`}>
                  {testResult.success ? (
                    <div>
                      ⚡ Latency: <strong>{testResult.latencyMs}ms</strong> | Range: <code>{testResult.sampleRange}</code>
                    </div>
                  ) : (
                    <div>❌ Test failed: {testResult.error}</div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {/* Standby / Status Banner */}
              <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 flex items-start gap-3">
                <AlertTriangleIcon className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-amber-800 dark:text-amber-300">
                    Google Sheets in Standby (Using Reference Fallback)
                  </p>
                  <p className="text-amber-700/90 dark:text-amber-400/90 mt-1">
                    {status?.error || 'Configure your Spreadsheet ID and access method below to activate live sync.'}
                  </p>
                </div>
              </div>

              {/* Configuration Form */}
              <form onSubmit={handleSaveConfiguration} className="space-y-4">
                <div>
                  <label className="block font-semibold text-slate-800 dark:text-slate-200 mb-1">
                    Google Spreadsheet ID
                  </label>
                  <input
                    type="text"
                    value={spreadsheetId}
                    onChange={(e) => setSpreadsheetId(e.target.value)}
                    placeholder="1wKfFadJIQrMIi9GTBljjb3m6HUJmazFG_uXAvFPsQIY"
                    className="w-full px-3 py-2 font-mono text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                  <span className="text-[11px] text-slate-400 mt-1 block">
                    From your URL: docs.google.com/spreadsheets/d/<strong>{spreadsheetId || 'SPREADSHEET_ID'}</strong>/edit
                  </span>
                </div>

                {/* Connection Method Tabs */}
                <div>
                  <div className="flex border-b border-slate-200 dark:border-slate-700 gap-4 mb-3">
                    <button
                      type="button"
                      onClick={() => setConnectTab('share')}
                      className={`pb-2 font-medium border-b-2 transition-colors ${connectTab === 'share' ? 'border-blue-600 text-blue-600 dark:text-blue-400' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                    >
                      Method 1: Anyone with link (Instant)
                    </button>
                    <button
                      type="button"
                      onClick={() => setConnectTab('service-account')}
                      className={`pb-2 font-medium border-b-2 transition-colors ${connectTab === 'service-account' ? 'border-blue-600 text-blue-600 dark:text-blue-400' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                    >
                      Method 2: Service Account JSON (Private)
                    </button>
                  </div>

                  {connectTab === 'share' ? (
                    <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 space-y-2">
                      <p className="font-semibold text-slate-800 dark:text-slate-200">
                        ⚡ Quickest 10-Second Setup:
                      </p>
                      <ol className="list-decimal list-inside space-y-1 text-slate-600 dark:text-slate-400 text-[11.5px]">
                        <li>Open your Google Sheet (<a href={`https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`} target="_blank" rel="noreferrer" className="text-blue-600 underline">open sheet</a>).</li>
                        <li>Click the blue <strong>Share</strong> button at the top-right.</li>
                        <li>Under <em>General access</em>, change &quot;Restricted&quot; to <strong>&quot;Anyone with the link&quot;</strong> (Role: Viewer).</li>
                        <li>Click <strong>Done</strong>, then click <strong>&quot;Save & Connect&quot;</strong> below!</li>
                      </ol>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <label className="block font-semibold text-slate-800 dark:text-slate-200">
                        Paste Service Account JSON Key:
                      </label>
                      <textarea
                        rows={4}
                        value={serviceAccountJson}
                        onChange={(e) => setServiceAccountJson(e.target.value)}
                        placeholder='{"type": "service_account", "project_id": "...", "private_key": "...", "client_email": "..."}'
                        className="w-full p-2.5 font-mono text-[11px] rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <span className="text-[11px] text-slate-400 block">
                        Or place into <code className="text-blue-600 font-mono">./secrets/google-service-account.json</code>
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="px-4 py-2 rounded-lg font-semibold bg-blue-600 hover:bg-blue-700 text-white transition-colors flex items-center gap-1.5 shadow-xs"
                  >
                    <RefreshCwIcon className={`w-3.5 h-3.5 ${isSaving ? 'animate-spin' : ''}`} />
                    {isSaving ? 'Connecting...' : 'Save & Connect'}
                  </button>

                  <button
                    type="button"
                    onClick={fetchStatus}
                    className="px-3.5 py-2 rounded-lg font-semibold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 transition-colors"
                  >
                    Check Status
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Feedback messages */}
          {actionMessage && (
            <div className={`p-3 rounded-lg font-medium ${actionMessage.kind === 'success' ? 'bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200' : actionMessage.kind === 'error' ? 'bg-red-100 dark:bg-red-900/60 text-red-800 dark:text-red-200' : 'bg-blue-100 dark:bg-blue-900/60 text-blue-800 dark:text-blue-200'}`}>
              {actionMessage.text}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="mt-5 pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
