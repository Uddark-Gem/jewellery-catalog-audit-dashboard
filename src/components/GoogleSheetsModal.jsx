import { useState, useEffect } from 'react';
import { DatabaseIcon, XIcon, CheckCircleIcon, AlertTriangleIcon, RefreshCwIcon, DownloadIcon } from './Icons';

export default function GoogleSheetsModal({ isOpen, onClose, activePanelId, activeRows = [] }) {
  const [status, setStatus] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [actionMessage, setActionMessage] = useState(null);

  const fetchStatus = async () => {
    setIsLoading(true);
    setActionMessage(null);
    try {
      const res = await fetch('/api/sheets/status');
      const data = await res.json();
      setStatus(data);
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

  const handleTestConnection = async () => {
    setIsTesting(true);
    setActionMessage(null);
    try {
      const res = await fetch('/api/sheets/test', { method: 'POST' });
      const data = await res.json();
      setTestResult(data);
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
      <div className="relative w-full max-w-xl rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl p-6 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
              <DatabaseIcon className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Google Sheets Integration
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Service Account status and spreadsheet sync controls
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
        <div className="mt-4 space-y-4 max-h-[70vh] overflow-y-auto pr-1">
          {isLoading ? (
            <div className="flex items-center justify-center py-10 text-slate-500 gap-2">
              <RefreshCwIcon className="w-5 h-5 animate-spin text-blue-500" />
              <span>Checking Google Cloud Service Account...</span>
            </div>
          ) : status?.ready ? (
            <div className="space-y-4">
              {/* Connected Banner */}
              <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 flex items-start gap-3">
                <CheckCircleIcon className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                <div className="text-xs">
                  <p className="font-semibold text-emerald-800 dark:text-emerald-300">
                    Google Sheets API Connected
                  </p>
                  <p className="text-emerald-700/80 dark:text-emerald-400/80 mt-0.5">
                    Spreadsheet: <span className="font-mono font-bold text-emerald-900 dark:text-emerald-200">{status.spreadsheetTitle}</span>
                  </p>
                </div>
              </div>

              {/* Details List */}
              <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-3.5 text-xs space-y-2 font-mono">
                <div>
                  <span className="text-slate-500 dark:text-slate-400">Client Email:</span>{' '}
                  <span className="text-slate-800 dark:text-slate-200 break-all">{status.clientEmail}</span>
                </div>
                <div>
                  <span className="text-slate-500 dark:text-slate-400">Spreadsheet ID:</span>{' '}
                  <span className="text-slate-800 dark:text-slate-200 break-all">{status.spreadsheetId}</span>
                </div>
                {status.sheets?.length > 0 && (
                  <div>
                    <span className="text-slate-500 dark:text-slate-400">Available Worksheets:</span>{' '}
                    <span className="text-blue-600 dark:text-blue-400">{status.sheets.join(', ')}</span>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap gap-2 pt-2">
                <button
                  type="button"
                  onClick={handleTestConnection}
                  disabled={isTesting}
                  className="px-3 py-2 rounded-lg text-xs font-semibold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-750 transition-colors flex items-center gap-1.5"
                >
                  <RefreshCwIcon className={`w-3.5 h-3.5 ${isTesting ? 'animate-spin' : ''}`} />
                  {isTesting ? 'Testing...' : 'Test Read Latency'}
                </button>

                {activeRows.length > 0 && (
                  <button
                    type="button"
                    onClick={handleExportPanelToSheet}
                    disabled={isExporting}
                    className="px-3.5 py-2 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white transition-colors flex items-center gap-1.5 shadow-xs"
                  >
                    <DownloadIcon className="w-3.5 h-3.5" />
                    {isExporting ? 'Exporting...' : `Export ${activeRows.length} rows to Sheet`}
                  </button>
                )}
              </div>

              {/* Test Result Callout */}
              {testResult && (
                <div className={`p-3 rounded-lg text-xs ${testResult.success ? 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300' : 'bg-red-50 text-red-700'}`}>
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
              {/* Standby / Fallback Banner */}
              <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 flex items-start gap-3">
                <AlertTriangleIcon className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <div className="text-xs">
                  <p className="font-semibold text-amber-800 dark:text-amber-300">
                    Google Sheets in Standby (Using Local CSV Fallback)
                  </p>
                  <p className="text-amber-700/90 dark:text-amber-400/90 mt-1">
                    {status?.error || 'Awaiting Google Service Account configuration.'}
                  </p>
                </div>
              </div>

              {/* Instructions */}
              <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4 text-xs space-y-2 text-slate-600 dark:text-slate-300">
                <p className="font-semibold text-slate-800 dark:text-slate-100">
                  Quick Setup Steps:
                </p>
                <ol className="list-decimal list-inside space-y-1 text-slate-500 dark:text-slate-400">
                  <li>Place your Google Service Account JSON file into: <code className="text-blue-600">./secrets/google-service-account.json</code></li>
                  <li>Share your target Google Spreadsheet with the service account&apos;s <code className="text-blue-600">client_email</code> (Editor permission).</li>
                  <li>Add <code className="text-blue-600">GOOGLE_SPREADSHEET_ID=your_id</code> to <code className="text-blue-600">.env.local</code>.</li>
                  <li>Restart the server or click &quot;Check Again&quot; below.</li>
                </ol>
              </div>

              <button
                type="button"
                onClick={fetchStatus}
                className="px-3 py-2 rounded-lg text-xs font-semibold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 transition-colors flex items-center gap-1.5"
              >
                <RefreshCwIcon className="w-3.5 h-3.5" />
                Check Again
              </button>
            </div>
          )}

          {/* Feedback messages */}
          {actionMessage && (
            <div className={`p-3 rounded-lg text-xs font-medium ${actionMessage.kind === 'success' ? 'bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200' : 'bg-red-100 dark:bg-red-900/60 text-red-800 dark:text-red-200'}`}>
              {actionMessage.text}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="mt-5 pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-xs font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
