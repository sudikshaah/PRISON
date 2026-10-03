'use client';
import { useState, useEffect, useRef } from 'react';
import AttackGraph from '@/components/AttackGraph';
import PatchReviewModal from '@/components/agent/PatchReviewModal';
import ToastContainer, { toast } from '@/components/Toast';
import { api } from '@/lib/api';

const RETRO_CSS = [
  'body{background-color:#05070a!important;color:#e2e8f0}',
  '.crt-overlay::before{content:" ";display:block;position:fixed;top:0;left:0;bottom:0;right:0;',
  'background:linear-gradient(rgba(18,16,16,0) 50%,rgba(0,0,0,.25) 50%),linear-gradient(90deg,rgba(255,0,0,.03),rgba(0,255,0,.01),rgba(0,0,255,.03));',
  'z-index:50;background-size:100% 3px,6px 100%;pointer-events:none}',
  '.px-shadow{box-shadow:3px 3px 0 #000,4px 4px 0 #1e293b}',
  '.px-shadow-cyan{box-shadow:3px 3px 0 #000,4px 4px 0 #06b6d4}',
  '.px-shadow-grn{box-shadow:3px 3px 0 #000,4px 4px 0 #10b981}',
  '.px-shadow-acc{box-shadow:3px 3px 0 #000,5px 5px 0 #6366f1}',
  '.pixel-btn:active{transform:translate(2px,2px);box-shadow:1px 1px 0 #000}',
  '@keyframes retro-blink{0%,49%{opacity:1}50%,100%{opacity:0}}',
  '.pixel-cursor{display:inline-block;width:9px;height:1.15em;background:#10b981;vertical-align:text-bottom;animation:retro-blink .9s infinite}',
  '.pixel-cursor-cyan{background:#06b6d4}',
  '.retro-switch{width:44px;height:22px;position:relative;border:2px solid #1e293b;background:#0c111f;cursor:pointer}',
  '.retro-switch.on{background:#06b6d4;border-color:#22d3ee;box-shadow:0 0 10px rgba(6,182,212,.4)}',
  '.retro-switch .knob{width:14px;height:14px;background:#475569;position:absolute;top:2px;left:2px;transition:all .1s steps(2)}',
  '.retro-switch.on .knob{left:24px;background:#021e28}',
  '.tl-breach{color:#ef4444}.tl-success{color:#10b981}.tl-running{color:#06b6d4}.tl-agent{color:#818cf8}.tl-line{color:#94a3b8}',
].join('');

const TW_CFG = `tailwind.config={theme:{extend:{colors:{
  retroBg:'#05070a',retroCard:'#0a0e1a',retroPanel:'#070b14',
  retroBorder:'#1c2438',retroBorderBright:'#3b4b73',
  silkIndigo:'#6366f1',silkIndigoLight:'#818cf8',
  pixelCyan:'#06b6d4',neonGreen:'#10b981',neonRed:'#ef4444',neonYellow:'#f59e0b',
},fontFamily:{
  pixel:['Silkscreen','Press Start 2P','monospace'],
  arcade:['Press Start 2P','cursive'],
  mono:['JetBrains Mono','monospace'],
}}}};`;

const EBPF_COL = {EXECVE:'#06b6d4',CONNECT:'#ef4444',OPENAT:'#f59e0b',HONEYPOT_TRIGGER:'#ef4444'};
const nodeColor = t => !t?'#64748b':t.includes('RED')?'#ef4444':t.includes('AMBER')?'#f59e0b':'#06b6d4';

export default function SandboxPage() {
  const [prUrl,setPrUrl]           = useState('');
  const [stage,setStage]           = useState('idle');
  const [termLines,setTermLines]   = useState([]);
  const [events,setEvents]         = useState([]);
  const [dag,setDag]               = useState(null);
  const [selectedNode,setNode]     = useState(null);
  const [patch,setPatch]           = useState(null);
  const [sandboxId,setSandboxId]   = useState(null);
  const [threatReport,setReport]   = useState(null);
  const [apiStatus,setApiStatus]   = useState(null);
  const [repoMeta,setRepoMeta]     = useState({fullName:'demo/repo',prNumber:42});
  const [honeypot,setHoneypot]     = useState(true);
  const [blockSock,setBlockSock]   = useState(true);
  const [bypass,setBypass]         = useState(false);
  const termRef = useRef(null);
  const ebpfRef = useRef(null);

  useEffect(()=>{if(termRef.current)termRef.current.scrollTop=termRef.current.scrollHeight;},[termLines]);
  useEffect(()=>{if(ebpfRef.current)ebpfRef.current.scrollTop=ebpfRef.current.scrollHeight;},[events]);

  const addLine = (type,msg) => setTermLines(p=>[...p,{type,msg,ts:new Date().toISOString()}]);

  const handleDetonate = async () => {
    const url = prUrl.trim() || 'https://github.com/test/repo/pull/42';
    setStage('detonating');
    setTermLines([]); setEvents([]); setDag(null); setPatch(null);
    setNode(null); setReport(null); setApiStatus(null);
    addLine('agent','[PRISON] Initiating detonation for: '+url);
    try {
      const data = await api.detonateSync(url);
      if (!data || !data.execution_id) {
        throw new Error(data?.detail || 'Detonation payload returned empty response.');
      }
      setSandboxId(data.execution_id);
      setApiStatus(data.status);
      addLine('running','[PRISON] Sandbox ID: '+data.execution_id);
      let fullName='demo/repo', prNum=42;
      try { const m=url.match(/github\.com\/([^/]+\/[^/]+)\/pull\/(\d+)/); if(m){fullName=m[1];prNum=+m[2];} } catch{}
      setRepoMeta({fullName,prNumber:prNum});
      (data?.terminal_logs || []).forEach((l,i)=>setTimeout(()=>addLine(l.type,l.msg),i*280));
      const base = (data?.terminal_logs || []).length*280;
      setTimeout(()=>{setEvents(data?.ebpf_events||[]);setStage('observing');},base);
      setTimeout(()=>{
        if(data.nodes?.length) setDag({execution_id:data.execution_id,nodes:data.nodes,edges:data.edges||[],has_honeypot_hit:data.severity>80,has_malicious_node:data.severity>50});
        setReport({threat_detected:data.severity>0,severity_score:data.severity,confidence_score:data.confidence,summary:data.summary||'Analysis complete.',gating_action:data.gating_action||'ALLOW_MERGE'});
        setStage(data.severity>0?'analyzing':'done');
      },base+1000);
      setTimeout(()=>{
        const hp = data.patch_diff && data.patch_diff.trim().length>0;
        if(data.severity>0 && hp){
          setStage('patching');
          setPatch({target_file:'package.json',branch_name:'prison/fix-security-'+data.execution_id.slice(4,12),summary:data.summary||'Threat neutralized.',unified_diff:data.patch_diff});
          setTimeout(()=>setStage('done'),500);
        }
      },base+2200);
    } catch(err){ addLine('breach','[PRISON] Detonation failed: '+err.message); setStage('idle'); }
  };

  const running = stage!=='idle' && stage!=='done';
  const sb = {
    idle:      {label:'READY',       cls:'bg-slate-800 text-slate-400 border-slate-700'},
    detonating:{label:'DETONATING',  cls:'bg-amber-900/60 text-amber-400 border-amber-700 animate-pulse'},
    observing: {label:'OBSERVING',   cls:'bg-cyan-900/60 text-cyan-400 border-cyan-700 animate-pulse'},
    analyzing: {label:'ANALYZING',   cls:'bg-indigo-900/60 text-indigo-400 border-indigo-700 animate-pulse'},
    patching:  {label:'PATCHING',    cls:'bg-emerald-900/60 text-emerald-400 border-emerald-700 animate-pulse'},
    done:      {label:'COMPLETE',    cls:'bg-emerald-900/60 text-emerald-400 border-emerald-700'},
  }[stage];

  const TermPanel = ({label,refProp,children}) => (
    <div className="border-2 border-retroBorder bg-[#04060a] px-shadow flex flex-col" style={{minHeight:380}}>
      <div className="bg-retroPanel border-b-2 border-retroBorder px-4 py-2.5 flex items-center justify-between">
        <div className="flex gap-1.5">
          <span className="w-3 h-3 bg-neonRed border border-black inline-block"/>
          <span className="w-3 h-3 bg-neonYellow border border-black inline-block"/>
          <span className="w-3 h-3 bg-neonGreen border border-black inline-block"/>
        </div>
        <div className="font-pixel text-[10px] tracking-wider text-slate-400 uppercase">{label}</div>
        <div className="w-8"/>
      </div>
      <div ref={refProp} className="p-4 font-mono text-xs leading-relaxed flex-1 overflow-y-auto" style={{maxHeight:340}}>
        {children}
      </div>
    </div>
  );

  return (
    <>
      <style dangerouslySetInnerHTML={{__html:RETRO_CSS}}/>
      <script dangerouslySetInnerHTML={{__html:TW_CFG}}/>
      <div className="crt-overlay font-mono antialiased min-h-screen flex flex-col justify-between bg-[#05070a] selection:bg-silkIndigo selection:text-white">
        <ToastContainer />
        <main className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 flex-1 relative z-40">
          <section className="mb-7" data-purpose="page-title">
            <div className="flex items-center space-x-3 mb-2 flex-wrap gap-y-2">
              <span className="text-neonYellow text-xl animate-pulse">⚡</span>
              <h1 className="font-pixel text-xl sm:text-2xl md:text-3xl font-bold tracking-wide text-white uppercase">
                MANUAL DETONATION SANDBOX
              </h1>
              <span className={`font-pixel text-[10px] border px-2.5 py-1 tracking-widest uppercase ${sb.cls}`}>{sb.label}</span>
            </div>
            <p className="font-mono text-xs sm:text-sm text-slate-400 max-w-4xl">
              Paste a GitHub PR URL and watch PRISON detonate it inside a Firecracker microVM with live eBPF tracing.
            </p>
          </section>

          {/* Input Panel */}
          <section className="bg-retroCard border-2 border-retroBorder p-5 sm:p-6 mb-8 px-shadow">
            <label className="block font-pixel text-[11px] text-slate-400 uppercase tracking-widest mb-3" htmlFor="pr-url-input">
              GITHUB PULL REQUEST URL OR LOCAL PATH
            </label>
            <div className="flex flex-col sm:flex-row gap-3">
              <input id="pr-url-input" type="text" value={prUrl}
                onChange={e=>setPrUrl(e.target.value)}
                onKeyDown={e=>e.key==='Enter'&&!running&&handleDetonate()}
                disabled={running}
                placeholder="https://github.com/owner/repo/pull/42"
                className="flex-1 bg-[#04060a] border-2 border-retroBorder text-slate-100 font-mono text-sm px-4 py-3 focus:outline-none focus:border-pixelCyan placeholder-slate-600 disabled:opacity-50"
              />
              <button id="btn-detonate" onClick={handleDetonate} disabled={running}
                className="pixel-btn bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-500 text-white font-arcade text-xs px-6 py-3.5 border-2 border-white px-shadow-acc flex items-center gap-2 font-bold tracking-wider uppercase">
                <span>{running?'RUNNING...':'DETONATE IN MICROVM'}</span>
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-5 mt-5 border-t border-retroBorder">
              {[
                {id:'toggle-honeypot',label:'Inject Honeypots',     sub:'AWS, GH_TOKEN decoy keys',val:honeypot, set:setHoneypot},
                {id:'toggle-socket',  label:'Block Outbound Sockets',sub:'Deny all external TCP',  val:blockSock,set:setBlockSock},
                {id:'toggle-cache',   label:'Bypass Cache',          sub:'Force fresh detonation', val:bypass,   set:setBypass},
              ].map(t=>(
                <div key={t.id} className="flex items-center justify-between p-3 bg-retroPanel border border-retroBorder">
                  <div>
                    <div className="font-pixel text-xs text-white font-bold uppercase mb-0.5">{t.label}</div>
                    <div className="font-mono text-[11px] text-slate-400">{t.sub}</div>
                  </div>
                  <div id={t.id} className={'retro-switch shrink-0 ml-3'+(t.val?' on':'')} onClick={()=>t.set(v=>!v)}>
                    <div className="knob"/>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Dual Terminal */}
          <section className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            <TermPanel label={sandboxId?'PRISON TERMINAL - '+sandboxId:'PRISON TERMINAL - AWAITING DETONATION'} refProp={termRef}>
              {termLines.length===0 ? (
                <div className="text-slate-400 space-y-2">
                  <p>Paste a PR URL above and click <span className="text-neonYellow">Detonate</span>.</p>
                  <p className="text-slate-500">The full pipeline will stream here.</p>
                </div>
              ) : (
                <div className="space-y-1">
                  {termLines.map((ln,i)=>(
                    <div key={i} className={'tl-'+ln.type}>
                      <span className="text-slate-600 mr-2 text-[10px]">{new Date(ln.ts).toLocaleTimeString()}</span>
                      {ln.msg}
                    </div>
                  ))}
                  {running && (
                    <div className="mt-2 text-slate-400 pt-2 border-t border-retroBorder/40">
                      <span className="text-emerald-500 font-bold">prison@sandbox</span>:<span className="text-cyan-400">~$</span>{' '}
                      <span className="pixel-cursor"/>
                    </div>
                  )}
                </div>
              )}
            </TermPanel>

            <TermPanel label="OSEN EBPF - SYSCALL EVENT STREAM" refProp={ebpfRef}>
              {events.length===0 ? (
                <div className="space-y-2">
                  <p className="text-slate-500">Kernel events will stream here during sandbox execution.</p>
                  {running && (
                    <div className="mt-4 text-slate-400 pt-2 border-t border-retroBorder/40">
                      <span className="text-indigo-400 font-bold">ebpf::ringbuf</span>:<span className="text-cyan-400">[0]</span>{' '}
                      <span className="pixel-cursor pixel-cursor-cyan"/>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  {events.map((ev,i)=>{
                    const c=EBPF_COL[ev.event_type]||'#94a3b8';
                    const det=ev.details;
                    const s=det?.argv?det.argv.join(' '):det?.ip?(det.ip+':'+det.port):det?.filename||'';
                    return (
                      <div key={i} className={'px-2 py-1.5 border-l-2 '+(ev.is_anomaly?'border-red-500 bg-red-950/20':'border-slate-700')}>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span style={{color:c}} className="font-bold">{ev.event_type}</span>
                          <span className="text-slate-500">PID {ev.pid}</span>
                          <span className="text-slate-300">{ev.comm}</span>
                          {ev.is_anomaly && <span className="font-pixel text-[8px] bg-red-900/60 text-red-400 border border-red-700 px-1">ANOMALY</span>}
                        </div>
                        {s && <div className="text-slate-500 text-[10px] mt-0.5 pl-2">&gt; {s}</div>}
                      </div>
                    );
                  })}
                </div>
              )}
            </TermPanel>
          </section>
          {/* Attack Graph */}
          {dag && (
            <section className="mb-8">
              <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
                <div>
                  <h2 className="font-pixel text-sm text-white uppercase tracking-wider">TRACECOMMON Attack Graph</h2>
                  <p className="font-mono text-xs text-slate-400 mt-1">Click any node to inspect syscall details.</p>
                </div>
                {threatReport && (
                  <div className="flex gap-2 flex-wrap">
                    <span className="font-pixel text-[9px] bg-red-900/60 text-red-400 border border-red-700 px-2 py-1">SEVERITY {threatReport.severity_score}/100</span>
                    <span className="font-pixel text-[9px] bg-amber-900/60 text-amber-400 border border-amber-700 px-2 py-1">CONF {((threatReport.confidence_score||0)*100).toFixed(0)}%</span>
                    <span className={'font-pixel text-[9px] border px-2 py-1 '+(threatReport.gating_action==='BLOCK_PR'?'bg-red-900/60 text-red-400 border-red-700':threatReport.gating_action==='ALLOW_MERGE'?'bg-emerald-900/60 text-emerald-400 border-emerald-700':'bg-amber-900/60 text-amber-400 border-amber-700')}>
                      {threatReport.gating_action}
                    </span>
                  </div>
                )}
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-4">
                <AttackGraph dag={dag} onNodeClick={setNode}/>
                <div className="border-2 border-retroBorder bg-[#04060a] px-shadow p-5">
                  <div className="font-pixel text-[10px] text-pixelCyan uppercase tracking-widest mb-3">NODE INSPECTOR</div>
                  {selectedNode ? (
                    <div className="font-mono text-xs space-y-2">
                      {[['PID',selectedNode.pid],['PPID',selectedNode.ppid],['COMM',selectedNode.comm],
                        ['SYSCALL',selectedNode.syscall],['TYPE',selectedNode.node_type],
                        ['RISK',selectedNode.details?.risk_level||'--'],['FILE',selectedNode.details?.resolved_path||'--'],
                      ].map(([k,v])=>(
                        <div key={k} className="flex justify-between border-b border-retroBorder pb-1.5">
                          <span className="text-slate-500">{k}</span>
                          <span style={{color:nodeColor(selectedNode.node_type)}} className="text-right truncate max-w-[60%]">{String(v)}</span>
                        </div>
                      ))}
                    </div>
                  ) : <p className="text-slate-500 text-xs">Click a node to inspect syscall details.</p>}
                  {threatReport && (
                    <div className={'mt-4 p-3 border '+(threatReport.threat_detected?'bg-red-950/30 border-red-800/50':'bg-emerald-950/30 border-emerald-800/50')}>
                      <div className={'font-pixel text-[9px] uppercase tracking-wider mb-2 '+(threatReport.threat_detected?'text-red-400':'text-emerald-400')}>ANAKIN TRIAGE</div>
                      <p className="text-xs text-slate-300 leading-relaxed">{threatReport.summary}</p>
                    </div>
                  )}
                </div>
              </div>
            </section>
          )}

          {/* Safe Banner */}
          {apiStatus==='SAFE' && !patch && threatReport && stage==='done' && (
            <section className="mb-8">
              <div className="border-2 border-emerald-700 bg-emerald-950/20 px-shadow-grn p-6 flex items-start gap-5">
                <div className="text-4xl mt-1 shrink-0">&#9989;</div>
                <div>
                  <div className="font-pixel text-sm text-emerald-400 uppercase tracking-wider mb-2">[SAFE] No Security Vulnerabilities Detected</div>
                  <p className="font-mono text-sm text-slate-300 leading-relaxed mb-3">{threatReport.summary}</p>
                  <div className="flex gap-2 flex-wrap">
                    <span className="font-pixel text-[9px] bg-emerald-900/60 text-emerald-400 border border-emerald-700 px-2 py-1">ALLOW_MERGE</span>
                    <span className="font-pixel text-[9px] bg-slate-900 text-slate-400 border border-slate-700 px-2 py-1">Confidence {((threatReport.confidence_score||0.97)*100).toFixed(0)}%</span>
                    <span className="font-pixel text-[9px] bg-slate-900 text-slate-400 border border-slate-700 px-2 py-1">Severity 0/100</span>
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* Patch Card */}
          {patch && threatReport && threatReport.severity_score>0 && (
            <section className="mb-8">
              <PatchReviewModal patch={patch} repoFullName={repoMeta.fullName} prNumber={repoMeta.prNumber} onClose={()=>toast('Patch process completed.','success')}/>
            </section>
          )}

        </main>
        
        <footer className="border-t border-retroBorder bg-retroBg px-4 py-3 mt-10 text-center font-pixel text-[10px] text-slate-500 z-[100] relative">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-2">
            <div>© 2026 PRISON — PULL REQUEST ISOLATION &amp; SECURITY OBSERVATION NETWORK</div>
            <div className="flex items-center gap-3">
              <span className="text-emerald-500">■ v1.0.0</span>
              <span>ALL SYSTEMS OPERATIONAL</span>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
}
