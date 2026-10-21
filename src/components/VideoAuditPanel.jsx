import React, { useState, useMemo } from 'react';
import UpdatePanel from './UpdatePanel';
import { exportRowsAsCsv } from '../lib/csv';

export default function VideoAuditPanel({ reportRows = [] }) {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [attributeSetId, setAttributeSetId] = useState('');
  
  const [isChecking, setIsChecking] = useState(false);
  const [checkProgress, setCheckProgress] = useState(0);
  const [brokenVideos, setBrokenVideos] = useState([]);
  
  // We no longer need dateOptions since we'll use a date picker


  const attributeSetOptions = useMemo(() => {
    const sets = new Set();
    reportRows.forEach(r => {
      const s = String(r.attribute_set_id || '').trim();
      if (s) sets.add(s);
    });
    return Array.from(sets).sort();
  }, [reportRows]);

  const handleCheckUrls = async () => {
    if (!startDate && !endDate && !attributeSetId) {
      alert('Please select a Date range or Attribute Set ID first.');
      return;
    }
    
    setIsChecking(true);
    setCheckProgress(0);
    setBrokenVideos([]);
    
    try {
      // 1. Filter report rows
      const targetSkus = reportRows
        .filter(r => {
          const rDate = String(r.news_from_date || '').trim();
          const rAttr = String(r.attribute_set_id || '').trim();
          
          let dateMatch = true;
          const rDateOnly = rDate.split(' ')[0]; // Extract YYYY-MM-DD
          
          if (startDate && rDateOnly < startDate) {
            dateMatch = false;
          }
          if (endDate && rDateOnly > endDate) {
            dateMatch = false;
          }
          
          let attrMatch = true;
          if (attributeSetId) {
            attrMatch = rAttr === attributeSetId;
          }
          
          return dateMatch && attrMatch;
        })
        .map(r => String(r.sku || '').trim())
        .filter(Boolean);

      if (targetSkus.length === 0) {
        alert('No SKUs found matching the selected filters.');
        setIsChecking(false);
        return;
      }

      // 2. Fetch videodata_new to get URLs
      let res = await fetch('/api/report/local-videodata_new.json');
      if (!res.ok) {
        // Fallback to export if not locally cached
        res = await fetch('/api/export/videodata_new.json');
      }
      if (!res.ok) throw new Error('Could not fetch videodata_new database.');
      const videoData = await res.json();
      
      const skuToUrl = new Map();
      if (videoData.rows) {
        videoData.rows.forEach(r => {
          const s = String(r.sku || '').trim();
          const u = String(r.media_src || '').trim();
          if (s && u) skuToUrl.set(s, u);
        });
      }

      // 3. Batch check URLs
      const broken = [];
      const batchSize = 10;
      
      for (let i = 0; i < targetSkus.length; i += batchSize) {
        const batch = targetSkus.slice(i, i + batchSize);
        const promises = batch.map(async (sku) => {
          const url = skuToUrl.get(sku);
          if (!url) {
            return { id: sku, sku, url: 'No Video URL found', status: 'N/A', details: 'Missing from videodata_new' };
          }
          
          try {
            const checkRes = await fetch('/api/audit/check-url', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ url })
            });
            const checkData = await checkRes.json();
            
            return { 
              id: sku, 
              sku, 
              url, 
              status: checkData.status || 0, 
              details: checkData.status === 200 ? 'Working' : (checkData.error || `HTTP ${checkData.status}`)
            };
          } catch (e) {
            return { id: sku, sku, url, status: 'Error', details: e.message };
          }
        });

        const results = await Promise.all(promises);
        results.forEach(r => broken.push(r));
        
        setCheckProgress(Math.round(((i + batch.length) / targetSkus.length) * 100));
      }

      setBrokenVideos(broken);

    } catch (err) {
      alert('Error checking URLs: ' + err.message);
    } finally {
      setIsChecking(false);
    }
  };

  const columns = [
    { key: 'sku', label: 'SKU', width: 120 },
    { key: 'url', label: 'Video URL', width: 350 },
    { key: 'status', label: 'Status', width: 80 },
    { key: 'details', label: 'Details', width: 250 },
  ];

  return (
    <div className="flex flex-col h-full table-shell bg-white dark:bg-slate-900 rounded-xl shadow-xs border border-slate-200/90 dark:border-slate-800">
      <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-end gap-4 flex-wrap bg-white dark:bg-slate-900">
        <div className="toolbar-field">
          <span className="toolbar-field-label">News From (Start)</span>
          <input 
            type="date"
            className="border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 text-xs bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
            value={startDate}
            onChange={e => setStartDate(e.target.value)}
          />
        </div>
        
        <div className="toolbar-field">
          <span className="toolbar-field-label">News From (End)</span>
          <input 
            type="date"
            className="border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 text-xs bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
            value={endDate}
            onChange={e => setEndDate(e.target.value)}
          />
        </div>
        
        <div className="toolbar-field">
          <span className="toolbar-field-label">Attribute Set ID</span>
          <select 
            className="border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 text-xs bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
            value={attributeSetId}
            onChange={e => setAttributeSetId(e.target.value)}
          >
            <option value="">-- All Sets --</option>
            {attributeSetOptions.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>

        <button 
          className="btn-primary ml-auto flex items-center gap-2" 
          onClick={handleCheckUrls} 
          disabled={isChecking}
        >
          {isChecking ? (
            <>
              <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
              <span>Checking ({checkProgress}%)</span>
            </>
          ) : 'Check URLs'}
        </button>
      </div>

      <div className="flex-1 overflow-hidden">
        {brokenVideos.length > 0 ? (
          <UpdatePanel
            columns={columns}
            rows={brokenVideos}
            onRowsChange={setBrokenVideos}
            onExport={() => exportRowsAsCsv('video-audit.csv', brokenVideos, columns)}
          />
        ) : (
          <div className="flex items-center justify-center h-full text-gray-500">
            {isChecking ? 'Checking URLs...' : 'Select filters and click "Check URLs" to view video statuses.'}
          </div>
        )}
      </div>
    </div>
  );
}
