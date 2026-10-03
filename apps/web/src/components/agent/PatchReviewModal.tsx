'use client';
import React, { useState } from 'react';

export default function PatchReviewModal({ patch, repoFullName, prNumber, onClose }) {
  const [loading, setLoading]   = useState(false);
  const [applied, setApplied]   = useState(false);
  const [toast,   setToast]     = useState(null);

  if (!patch) return null;

  // Accept either unified_diff or diff field name
  const diffText = patch.unified_diff || patch.diff || '# No diff available';

  const showToast = (msg, type='success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  const handleApply = async () => {
    setLoading(true);
    try {
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'https://prison-jmno.onrender.com';
      const res = await fetch(`${backendUrl}/api/v1/agent/apply-patch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          repo_full_name: repoFullName || 'demo/repo',
          pr_number:      prNumber     || 42,
          branch_name:    patch.branch_name || 'prison/patch-branch',
          patch_diff:     diffText,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setApplied(true);
        showToast('Patch applied! Redirecting to GitHub PR...', 'success');
        const target = data.pr_url || 'https://github.com/' + (repoFullName || 'demo/repo') + '/pull/' + (prNumber || 42);
        setTimeout(() => { window.open(target, '_blank'); if (onClose) onClose(); }, 1200);
      } else {
        showToast('Failed to apply patch: ' + (data.detail || res.status), 'error');
      }
    } catch (err) {
      showToast('Network error: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div id="anakin-patch-card" style={{
      background:'linear-gradient(135deg,rgba(99,102,241,.06),rgba(99,102,241,.02))',
      border:'2px solid #6366f1',
      boxShadow:'3px 3px 0 #000,5px 5px 0 #6366f1',
      borderRadius:0,
      padding:'1.5rem',
      position:'relative',
      fontFamily:'JetBrains Mono,monospace',
    }}>
      {/* Inline toast */}
      {toast && (
        <div style={{
          position:'absolute', top:'1rem', right:'1rem',
          background: toast.type==='success' ? 'rgba(16,185,129,.12)' : 'rgba(239,68,68,.12)',
          border: `2px solid ${toast.type==='success' ? '#10b981' : '#ef4444'}`,
          padding:'.5rem 1rem', fontSize:'.75rem',
          color: toast.type==='success' ? '#10b981' : '#ef4444',
          fontFamily:'JetBrains Mono,monospace', zIndex:100,
          boxShadow:'2px 2px 0 #000',
        }}>
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'1rem',flexWrap:'wrap',gap:'.5rem'}}>
        <div style={{display:'flex',alignItems:'center',gap:'.75rem'}}>
          <span style={{fontSize:'1.25rem'}}>&#129302;</span>
          <span style={{fontFamily:'Silkscreen,Press Start 2P,monospace',color:'#818cf8',fontSize:'.7rem',textTransform:'uppercase',letterSpacing:'.08em',fontWeight:700}}>
            ANAKIN Security Remediation Patch
          </span>
        </div>
        <div style={{display:'flex',gap:'.5rem',alignItems:'center'}}>
          {applied && <span style={{fontFamily:'Silkscreen,monospace',fontSize:'.6rem',background:'rgba(16,185,129,.15)',color:'#10b981',border:'1px solid #10b981',padding:'2px 8px'}}>APPLIED</span>}
          <span style={{fontFamily:'Silkscreen,monospace',fontSize:'.6rem',background:'rgba(99,102,241,.15)',color:'#818cf8',border:'1px solid #6366f1',padding:'2px 8px'}}>PATCH READY</span>
        </div>
      </div>

      {patch.summary && (
        <p style={{color:'#94a3b8',fontSize:'.82rem',marginBottom:'1rem',lineHeight:1.6}}>{patch.summary}</p>
      )}

      {/* Diff viewer */}
      <div style={{background:'#030507',border:'1px solid #1e293b',padding:'1rem',marginBottom:'1.25rem',overflowX:'auto',maxHeight:320,overflowY:'auto'}}>
        <pre style={{margin:0,fontSize:'.75rem',lineHeight:1.7,whiteSpace:'pre-wrap'}}>
          {diffText.split('\n').map((line, idx) => {
            let color = '#64748b';
            if (line.startsWith('+') && !line.startsWith('+++')) color = '#10b981';
            else if (line.startsWith('-') && !line.startsWith('---')) color = '#ef4444';
            else if (line.startsWith('@@')) color = '#06b6d4';
            else if (line.startsWith('+++') || line.startsWith('---')) color = '#e2e8f0';
            else if (line.startsWith('#')) color = '#475569';
            return <div key={idx} style={{color}}>{line}</div>;
          })}
        </pre>
      </div>

      {/* Branch info */}
      {patch.branch_name && (
        <div style={{fontSize:'.7rem',color:'#475569',marginBottom:'1.25rem',fontFamily:'JetBrains Mono,monospace'}}>
          Branch: <span style={{color:'#818cf8'}}>{patch.branch_name}</span>
          {patch.target_file && <> &middot; File: <span style={{color:'#818cf8'}}>{patch.target_file}</span></>}
        </div>
      )}

      {/* Action buttons */}
      <div style={{display:'flex',gap:'.75rem',justifyContent:'flex-end',flexWrap:'wrap'}}>
        <button
          id="btn-view-pr"
          onClick={()=>window.open('https://github.com/'+(repoFullName||'demo/repo')+'/pull/'+(prNumber||42),'_blank')}
          style={{
            fontFamily:'Silkscreen,monospace',fontSize:'.65rem',padding:'.65rem 1.25rem',
            background:'transparent',color:'#64748b',border:'2px solid #1e293b',
            cursor:'pointer',textTransform:'uppercase',letterSpacing:'.06em',
            boxShadow:'2px 2px 0 #000',
          }}>
          View PR on GitHub
        </button>
        <button
          id="btn-apply-patch"
          onClick={handleApply}
          disabled={loading || applied}
          style={{
            fontFamily:'Silkscreen,monospace',fontSize:'.65rem',padding:'.65rem 1.5rem',
            background: applied ? '#1e293b' : '#6366f1',
            color: applied ? '#64748b' : '#fff',
            border:'2px solid #fff',
            cursor: loading || applied ? 'not-allowed' : 'pointer',
            textTransform:'uppercase',letterSpacing:'.06em',fontWeight:700,
            boxShadow:'3px 3px 0 #000,5px 5px 0 #6366f1',
          }}>
          {applied ? 'Patch Applied' : loading ? 'Applying...' : 'Approve & Apply Patch to GitHub PR'}
        </button>
      </div>
    </div>
  );
}
