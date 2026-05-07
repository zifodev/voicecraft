import { useState, useRef, useCallback, useEffect } from 'react'
import Head from 'next/head'

// ── constants ──────────────────────────────────────────────────────────────
const STEPS = ['upload','transcribe','enhance','voice','captions','done']
const STEP_LABELS = { upload:'Upload', transcribe:'Transcript', enhance:'Enhance', voice:'Voice', captions:'Captions', done:'Done' }
const STEP_PROGRESS = { upload:0, transcribe:20, enhance:40, voice:60, captions:80, done:100 }

const LANGS = [
  {code:'en',label:'English'},{code:'es',label:'Spanish'},{code:'fr',label:'French'},
  {code:'de',label:'German'},{code:'hi',label:'Hindi'},{code:'ar',label:'Arabic'},
  {code:'zh',label:'Chinese'},{code:'ja',label:'Japanese'},{code:'pt',label:'Portuguese'},{code:'ko',label:'Korean'},
]

const FALLBACK_VOICES = [
  {voice_id:'21m00Tcm4TlvDq8ikWAM',name:'Rachel',desc:'Calm · American'},
  {voice_id:'AZnzlk1XvdvUeBnXmlld',name:'Domi',desc:'Strong · American'},
  {voice_id:'EXAVITQu4vr4xnSDxMaL',name:'Bella',desc:'Soft · American'},
  {voice_id:'ErXwobaYiN019PkySvjV',name:'Antoni',desc:'Warm · American'},
  {voice_id:'TxGEqnHWrfWFTfGW9XjX',name:'Josh',desc:'Deep · American'},
  {voice_id:'VR6AewLTigWG4xSOukaG',name:'Arnold',desc:'Crisp · American'},
  {voice_id:'pNInz6obpgDQGcFmaJgB',name:'Adam',desc:'Deep · American'},
  {voice_id:'onwK4e9ZLuTAKqWW03F9',name:'Daniel',desc:'Authoritative · British'},
  {voice_id:'jsCqWAovK2LkecY7zXl4',name:'Freya',desc:'Overhyped · American'},
]

// ── helpers ────────────────────────────────────────────────────────────────
function toSRT(s) {
  const h=Math.floor(s/3600),m=Math.floor((s%3600)/60),sec=Math.floor(s%60),ms=Math.floor((s%1)*1000)
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')},${String(ms).padStart(3,'0')}`
}
function buildSRT(caps) {
  return caps.map((c,i)=>`${i+1}\n${toSRT(c.start)} --> ${toSRT(c.end)}\n${c.text}`).join('\n\n')
}
function dlFile(content, filename, type='text/plain') {
  const a=document.createElement('a')
  a.href=URL.createObjectURL(new Blob([content],{type}))
  a.download=filename; a.click()
}
function generateCaptions(script) {
  const words=script.trim().split(/\s+/), secPW=60/145, chunk=7, out=[]
  for(let i=0;i<words.length;i+=chunk)
    out.push({id:i,text:words.slice(i,i+chunk).join(' '),start:i*secPW,end:(i+chunk)*secPW})
  return out
}

// ── tiny components ────────────────────────────────────────────────────────
const Spinner = ({size=32}) => (
  <div style={{width:size,height:size,border:'2px solid #1a1a1a',borderTop:'2px solid #00e5a0',borderRadius:'50%',animation:'spin .8s linear infinite',flexShrink:0}} />
)
const Tag = ({children,color='#00e5a0'}) => (
  <span style={{padding:'2px 8px',borderRadius:4,fontSize:10,background:`${color}18`,color,border:`1px solid ${color}40`,letterSpacing:1,fontWeight:600}}>{children}</span>
)
const Lbl = ({children}) => (
  <div style={{fontSize:9,color:'#3a3a3a',letterSpacing:1.5,textTransform:'uppercase',marginBottom:7}}>{children}</div>
)
const Card = ({children,accent,style={}}) => (
  <div style={{background:'#0a0a0a',border:`1px solid ${accent?'#0f2a1f':'#141414'}`,borderRadius:12,padding:18,marginBottom:14,...style}}>
    {children}
  </div>
)
const Btn = ({onClick,disabled,loading,children,secondary,small}) => (
  <button onClick={onClick} disabled={disabled||loading} style={{
    width:small?'auto':'100%', padding:small?'8px 16px':'14px',
    fontFamily:'inherit',fontWeight:700,letterSpacing:2,fontSize:small?10:12,
    borderRadius:8,cursor:disabled||loading?'not-allowed':'pointer',transition:'all .2s',
    background:secondary?'transparent':(disabled||loading?'#0f2a1f':'#00e5a0'),
    color:secondary?'#444':(disabled||loading?'#1a4a30':'#000'),
    border:secondary?'1px solid #1e1e1e':'none',
    display:'flex',alignItems:'center',justifyContent:'center',gap:8,
  }}>
    {loading && <Spinner size={14} />}
    {children}
  </button>
)

const StepDot = ({step,current}) => {
  const idx=STEPS.indexOf(step),cur=STEPS.indexOf(current),done=idx<cur,active=idx===cur
  return (
    <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:3}}>
      <div style={{width:26,height:26,borderRadius:'50%',background:done?'#00e5a0':active?'#fff':'transparent',border:`2px solid ${done?'#00e5a0':active?'#fff':'#252525'}`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:10,fontWeight:700,color:done||active?'#000':'#3a3a3a',transition:'all .4s',boxShadow:active?'0 0 14px rgba(255,255,255,.2)':'none'}}>
        {done?'✓':idx+1}
      </div>
      <span style={{fontSize:8,letterSpacing:1,textTransform:'uppercase',color:active?'#fff':done?'#00e5a0':'#2a2a2a'}}>{STEP_LABELS[step]}</span>
    </div>
  )
}

// ── main ───────────────────────────────────────────────────────────────────
export default function Home() {
  const [step,setStep] = useState('upload')
  const [videoFile,setVideoFile] = useState(null)
  const [videoUrl,setVideoUrl] = useState(null)
  const [rawText,setRawText] = useState('')
  const [cleanScript,setCleanScript] = useState('')
  const [targetLang,setTargetLang] = useState('en')
  const [voices,setVoices] = useState(FALLBACK_VOICES)
  const [selectedVoice,setSelectedVoice] = useState(FALLBACK_VOICES[0].voice_id)
  const [audioUrl,setAudioUrl] = useState(null)
  const [captions,setCaptions] = useState([])
  const [activeCap,setActiveCap] = useState(0)
  const [loading,setLoading] = useState(false)
  const [loadingMsg,setLoadingMsg] = useState('')
  const [error,setError] = useState('')
  const [keyStatus,setKeyStatus] = useState('') // '' | 'ok' | 'missing'
  const fileRef = useRef()

  // On mount: load voices from server (uses server-side EL key)
  useEffect(() => {
    fetch('/api/voices')
      .then(r=>r.json())
      .then(data=>{
        if(data.keyOk && data.voices?.length) {
          setVoices(data.voices)
          setSelectedVoice(data.voices[0].voice_id)
          setKeyStatus('ok')
        } else if(data.keyMissing || data.keyError) {
          setKeyStatus('missing')
        }
      })
      .catch(()=>{})
  },[])

  const handleFile = useCallback((file) => {
    if(!file||!file.type.startsWith('video/')) { setError('Please upload a video file (mp4, mov, webm)'); return }
    setError(''); setVideoFile(file); setVideoUrl(URL.createObjectURL(file)); setStep('transcribe')
  },[])

  const onDrop = (e) => { e.preventDefault(); handleFile(e.dataTransfer.files[0]) }

  const runEnhance = async () => {
    if(!rawText.trim()) { setError('Paste your transcript first.'); return }
    setError(''); setLoading(true); setLoadingMsg('Claude is cleaning your script...')
    try {
      const res = await fetch('/api/enhance',{
        method:'POST', headers:{'Content-Type':'application/json'},
        body:JSON.stringify({rawText,targetLang})
      })
      const data = await res.json()
      if(!res.ok) throw new Error(data.error||'Enhancement failed')
      setCleanScript(data.cleanScript)
      setStep('voice')
    } catch(e) { setError(e.message) }
    setLoading(false)
  }

  const runVoice = async () => {
    setError(''); setLoading(true); setLoadingMsg('Generating AI voice with ElevenLabs...')
    try {
      const res = await fetch('/api/tts',{
        method:'POST', headers:{'Content-Type':'application/json'},
        body:JSON.stringify({script:cleanScript,voiceId:selectedVoice})
      })
      if(!res.ok) {
        const j = await res.json()
        throw new Error(j.error||`TTS failed (${res.status})`)
      }
      const blob = await res.blob()
      setAudioUrl(URL.createObjectURL(blob))
      setStep('captions')
    } catch(e) { setError(e.message) }
    setLoading(false)
  }

  const runCaptions = () => {
    setLoading(true); setLoadingMsg('Generating captions...')
    setTimeout(()=>{ setCaptions(generateCaptions(cleanScript)); setStep('done'); setLoading(false) },800)
  }

  const reset = () => {
    setStep('upload'); setVideoFile(null); setVideoUrl(null); setRawText('')
    setCleanScript(''); setAudioUrl(null); setCaptions([]); setError(''); setActiveCap(0)
  }

  return (
    <>
      <Head>
        <title>VOICECRAFT — AI Video Voice Enhancer</title>
        <meta name="description" content="Transform your raw video voice into a smooth AI-powered voiceover with captions" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      {/* scanlines */}
      <div style={{position:'fixed',inset:0,pointerEvents:'none',zIndex:0,background:'repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(0,0,0,.04) 2px,rgba(0,0,0,.04) 4px)'}} />

      <div style={{minHeight:'100vh',display:'flex',flexDirection:'column',position:'relative'}}>

        {/* HEADER */}
        <header style={{padding:'18px 24px',borderBottom:'1px solid #0f0f0f',display:'flex',justifyContent:'space-between',alignItems:'center',position:'relative',zIndex:10}}>
          <div>
            <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:24,letterSpacing:5,color:'#fff'}}>VOICECRAFT</div>
            <div style={{fontSize:8,color:'#2a2a2a',letterSpacing:2}}>AI VIDEO VOICE ENHANCER</div>
          </div>
          <div style={{display:'flex',gap:8,alignItems:'center'}}>
            {keyStatus==='ok' && <Tag>ElevenLabs ✓</Tag>}
            {keyStatus==='missing' && <Tag color='#ff9944'>EL Key Missing</Tag>}
            {keyStatus==='' && <div style={{fontSize:10,color:'#2a2a2a'}}>Loading...</div>}
          </div>
        </header>

        {/* PROGRESS */}
        <div style={{padding:'16px 24px 0',position:'relative',zIndex:1}}>
          <div style={{display:'flex',justifyContent:'space-between',marginBottom:8}}>
            {STEPS.map(s=><StepDot key={s} step={s} current={step}/>)}
          </div>
          <div style={{height:2,background:'#0f0f0f',borderRadius:99}}>
            <div style={{height:'100%',width:`${STEP_PROGRESS[step]}%`,background:'linear-gradient(90deg,#00e5a0,#00b8ff)',borderRadius:99,transition:'width .5s ease'}}/>
          </div>
        </div>

        {/* MAIN */}
        <main style={{flex:1,padding:'24px',maxWidth:680,margin:'0 auto',width:'100%',position:'relative',zIndex:1}}>

          {error && step!=='upload' && (
            <div style={{background:'rgba(255,60,60,.07)',border:'1px solid rgba(255,60,60,.2)',borderRadius:8,padding:'10px 14px',marginBottom:16,fontSize:11,color:'#ff7070'}}>⚠ {error}</div>
          )}

          {/* ── UPLOAD ── */}
          {step==='upload' && (
            <div className="fadeUp">
              <h2 style={{fontFamily:"'Bebas Neue'",fontSize:34,letterSpacing:3,color:'#fff',margin:'0 0 4px'}}>DROP YOUR VIDEO</h2>
              <p style={{color:'#333',fontSize:11,marginBottom:22}}>Upload your raw recording — clean voice, smooth tone, captions auto-generated</p>

              {keyStatus==='missing' && (
                <div style={{background:'rgba(255,153,68,.05)',border:'1px solid rgba(255,153,68,.2)',borderRadius:8,padding:'11px 14px',marginBottom:16,fontSize:11,color:'#ff9944'}}>
                  ⚠ ELEVENLABS_API_KEY not set in Vercel. Add it in your project environment variables.
                </div>
              )}

              <div className="drop-zone" onDrop={onDrop} onDragOver={e=>e.preventDefault()} onClick={()=>fileRef.current.click()}
                style={{border:'2px dashed #1a1a1a',borderRadius:14,padding:'50px 24px',textAlign:'center',cursor:'pointer',transition:'border-color .2s',background:'rgba(255,255,255,.003)'}}>
                <div style={{fontSize:40,marginBottom:12}}>⬆</div>
                <div style={{fontSize:14,color:'#555',marginBottom:4}}>Drag & drop your video</div>
                <div style={{fontSize:10,color:'#2a2a2a'}}>or tap to browse · MP4, MOV, WEBM</div>
                <input ref={fileRef} type="file" accept="video/*" style={{display:'none'}} onChange={e=>handleFile(e.target.files[0])}/>
              </div>
              {error && <div style={{marginTop:10,fontSize:11,color:'#ff7070'}}>⚠ {error}</div>}

              <div style={{marginTop:18,padding:14,background:'#090909',borderRadius:10,border:'1px solid #0f0f0f'}}>
                <Lbl>PIPELINE</Lbl>
                {[['Paste your raw transcript','free'],['Claude cleans grammar + removes fillers','server'],['ElevenLabs generates smooth AI voice','server'],['Captions synced to audio','auto']].map(([t,b])=>(
                  <div key={t} style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:7}}>
                    <span style={{fontSize:11,color:'#444'}}>→ {t}</span>
                    <Tag color={b==='server'?'#00b8ff':'#00e5a0'}>{b}</Tag>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── TRANSCRIBE ── */}
          {step==='transcribe' && (
            <div className="fadeUp">
              <h2 style={{fontFamily:"'Bebas Neue'",fontSize:34,letterSpacing:3,color:'#fff',margin:'0 0 4px'}}>YOUR TRANSCRIPT</h2>
              <p style={{color:'#333',fontSize:11,marginBottom:18}}>Paste exactly what you said — mistakes, fillers, all of it. Claude will fix everything.</p>

              <Card>
                <div style={{display:'flex',gap:10,alignItems:'center',marginBottom:videoUrl?14:0}}>
                  <span style={{fontSize:18}}>🎬</span>
                  <div>
                    <div style={{color:'#bbb',fontSize:12}}>{videoFile?.name}</div>
                    <div style={{color:'#2a2a2a',fontSize:10}}>{videoFile?(videoFile.size/1024/1024).toFixed(1)+' MB':''}</div>
                  </div>
                </div>
                {videoUrl && <video src={videoUrl} controls style={{width:'100%',borderRadius:8,maxHeight:200,background:'#000'}}/>}
              </Card>

              <div style={{marginBottom:14}}>
                <Lbl>PASTE YOUR RAW TRANSCRIPT</Lbl>
                <textarea value={rawText} onChange={e=>setRawText(e.target.value)} rows={6}
                  placeholder={"e.g. so basically um i want to show you how i builded my website using claude ai its actually pretty easy once you get the hang of it..."}
                  style={{width:'100%',background:'#0a0a0a',border:'1px solid #141414',color:'#ccc',borderRadius:8,padding:'11px 14px',fontSize:12,fontFamily:'inherit',outline:'none',resize:'vertical',lineHeight:1.8}}
                />
                <div style={{fontSize:9,color:'#1e1e1e',marginTop:4}}>Tip: Speak into a notes app while watching your video and paste the result here</div>
              </div>

              <div style={{marginBottom:16}}>
                <Lbl>OUTPUT LANGUAGE</Lbl>
                <select value={targetLang} onChange={e=>setTargetLang(e.target.value)}
                  style={{width:'100%',background:'#0a0a0a',border:'1px solid #141414',color:'#ccc',borderRadius:8,padding:'10px 14px',fontSize:12,fontFamily:'inherit',outline:'none',cursor:'pointer'}}>
                  {LANGS.map(l=><option key={l.code} value={l.code}>{l.label}</option>)}
                </select>
              </div>

              <Btn onClick={()=>{setError('');if(!rawText.trim()){setError('Paste your transcript first.');return;}setStep('enhance')}} disabled={!rawText.trim()}>
                NEXT: ENHANCE WITH CLAUDE →
              </Btn>
            </div>
          )}

          {/* ── ENHANCE ── */}
          {step==='enhance' && (
            <div className="fadeUp">
              <h2 style={{fontFamily:"'Bebas Neue'",fontSize:34,letterSpacing:3,color:'#fff',margin:'0 0 4px'}}>ENHANCE SCRIPT</h2>
              <p style={{color:'#333',fontSize:11,marginBottom:18}}>Claude will remove fillers, fix grammar, and make it sound professional</p>

              <Card>
                <Lbl>YOUR RAW TRANSCRIPT</Lbl>
                <div style={{fontSize:12,color:'#444',lineHeight:1.8,fontStyle:'italic'}}>"{rawText}"</div>
              </Card>

              {loading
                ? <div style={{display:'flex',gap:14,alignItems:'center',padding:20,background:'#090909',borderRadius:10}}><Spinner/><span style={{fontSize:12,color:'#444'}}>{loadingMsg}</span></div>
                : <Btn onClick={runEnhance}>CLEAN WITH CLAUDE →</Btn>
              }
            </div>
          )}

          {/* ── VOICE ── */}
          {step==='voice' && (
            <div className="fadeUp">
              <h2 style={{fontFamily:"'Bebas Neue'",fontSize:34,letterSpacing:3,color:'#fff',margin:'0 0 4px'}}>CHOOSE VOICE</h2>
              <p style={{color:'#333',fontSize:11,marginBottom:18}}>Script is polished — pick a voice to bring it to life</p>

              <Card accent>
                <div style={{display:'flex',gap:8,alignItems:'center',marginBottom:10}}>
                  <Tag>✓ CLAUDE ENHANCED</Tag>
                  {targetLang!=='en'&&<Tag color='#00b8ff'>{LANGS.find(l=>l.code===targetLang)?.label}</Tag>}
                </div>
                <div style={{fontSize:12,color:'#999',lineHeight:1.8}}>{cleanScript}</div>
              </Card>

              <Lbl>SELECT VOICE</Lbl>
              <div style={{border:'1px solid #111',borderRadius:10,overflow:'hidden',marginBottom:14,maxHeight:280,overflowY:'auto'}}>
                {voices.map((v,i)=>(
                  <div key={v.voice_id} className="voice-row" onClick={()=>setSelectedVoice(v.voice_id)}
                    style={{display:'flex',gap:12,alignItems:'center',padding:'11px 14px',background:selectedVoice===v.voice_id?'rgba(0,229,160,.06)':'transparent',borderBottom:i<voices.length-1?'1px solid #0d0d0d':'none',cursor:'pointer',transition:'background .15s'}}>
                    <div style={{width:30,height:30,borderRadius:'50%',background:selectedVoice===v.voice_id?'#00e5a0':'#111',display:'flex',alignItems:'center',justifyContent:'center',fontSize:12,color:selectedVoice===v.voice_id?'#000':'#444',flexShrink:0,fontWeight:700}}>
                      {v.name[0]}
                    </div>
                    <div style={{flex:1}}>
                      <div style={{fontSize:13,color:selectedVoice===v.voice_id?'#fff':'#777'}}>{v.name}</div>
                      <div style={{fontSize:10,color:'#2a2a2a'}}>{v.desc}</div>
                    </div>
                    {selectedVoice===v.voice_id&&<span style={{color:'#00e5a0'}}>✓</span>}
                  </div>
                ))}
              </div>

              {loading
                ? <div style={{display:'flex',gap:14,alignItems:'center',padding:20,background:'#090909',borderRadius:10}}><Spinner/><span style={{fontSize:12,color:'#444'}}>{loadingMsg}</span></div>
                : <Btn onClick={runVoice} disabled={!selectedVoice}>GENERATE VOICE →</Btn>
              }
            </div>
          )}

          {/* ── CAPTIONS ── */}
          {step==='captions' && (
            <div className="fadeUp">
              <h2 style={{fontFamily:"'Bebas Neue'",fontSize:34,letterSpacing:3,color:'#fff',margin:'0 0 4px'}}>VOICE READY</h2>
              <p style={{color:'#333',fontSize:11,marginBottom:18}}>Preview your AI voice, then generate captions</p>
              <Card accent>
                <Lbl>AI GENERATED AUDIO</Lbl>
                {audioUrl&&<audio src={audioUrl} controls/>}
              </Card>
              {loading
                ? <div style={{display:'flex',gap:14,alignItems:'center',padding:20,background:'#090909',borderRadius:10}}><Spinner/><span style={{fontSize:12,color:'#444'}}>{loadingMsg}</span></div>
                : <Btn onClick={runCaptions}>GENERATE CAPTIONS →</Btn>
              }
            </div>
          )}

          {/* ── DONE ── */}
          {step==='done' && (
            <div className="fadeUp">
              <div style={{textAlign:'center',marginBottom:24}}>
                <div style={{fontSize:40,marginBottom:8,animation:'glow 2s infinite'}}>✦</div>
                <h2 style={{fontFamily:"'Bebas Neue'",fontSize:40,letterSpacing:4,color:'#00e5a0',margin:0}}>ALL DONE</h2>
                <p style={{color:'#333',fontSize:11}}>Your enhanced video assets are ready to download</p>
              </div>

              <Card accent>
                <Lbl>FINAL AI VOICE</Lbl>
                {audioUrl&&<audio src={audioUrl} controls/>}
              </Card>

              <Card>
                <Lbl>CAPTION PREVIEW</Lbl>
                <div style={{background:'#000',borderRadius:8,overflow:'hidden',marginBottom:10}}>
                  <div style={{padding:'36px 16px',textAlign:'center',display:'flex',alignItems:'center',justifyContent:'center',minHeight:90}}>
                    <div style={{background:'rgba(0,0,0,.85)',padding:'9px 18px',borderRadius:5,fontSize:13,color:'#fff',border:'1px solid rgba(255,255,255,.08)',maxWidth:320}}>
                      {captions[activeCap]?.text}
                    </div>
                  </div>
                  <div style={{padding:'8px 12px',display:'flex',gap:5,flexWrap:'wrap',borderTop:'1px solid #0d0d0d'}}>
                    {captions.map((c,i)=>(
                      <button key={c.id} onClick={()=>setActiveCap(i)} style={{padding:'2px 7px',borderRadius:3,fontSize:9,cursor:'pointer',background:activeCap===i?'rgba(0,229,160,.15)':'transparent',border:`1px solid ${activeCap===i?'#00e5a0':'#1a1a1a'}`,color:activeCap===i?'#00e5a0':'#333',fontFamily:'inherit'}}>
                        {c.start.toFixed(1)}s
                      </button>
                    ))}
                  </div>
                </div>
              </Card>

              <Lbl>DOWNLOAD YOUR FILES</Lbl>
              <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:8,marginBottom:14}}>
                {[
                  {icon:'📝',label:'Script',sub:'.txt',fn:()=>dlFile(cleanScript,'enhanced_script.txt')},
                  {icon:'🎵',label:'Audio',sub:'.mp3',fn:()=>{if(audioUrl){const a=document.createElement('a');a.href=audioUrl;a.download='voicecraft_audio.mp3';a.click()}}},
                  {icon:'💬',label:'Captions',sub:'.srt',fn:()=>dlFile(buildSRT(captions),'captions.srt')},
                ].map(({icon,label,sub,fn})=>(
                  <button key={label} onClick={fn} style={{background:'#090909',border:'1px solid #111',borderRadius:10,padding:'16px 10px',cursor:'pointer',color:'#777',fontFamily:'inherit',textAlign:'center',transition:'all .2s'}}>
                    <div style={{fontSize:22,marginBottom:4}}>{icon}</div>
                    <div style={{fontSize:12,color:'#bbb'}}>{label}</div>
                    <div style={{fontSize:9,color:'#2a2a2a'}}>{sub}</div>
                  </button>
                ))}
              </div>

              <div style={{fontSize:10,color:'#2a2a2a',lineHeight:1.8,padding:12,background:'#090909',borderRadius:8,marginBottom:14}}>
                💡 Import the audio (.mp3) + captions (.srt) into CapCut, DaVinci Resolve, or Premiere Pro to replace your original voice track.
              </div>

              <Btn onClick={reset} secondary>← PROCESS ANOTHER VIDEO</Btn>
            </div>
          )}
        </main>

        <footer style={{padding:'12px 24px',borderTop:'1px solid #0a0a0a',display:'flex',justifyContent:'space-between',zIndex:1,position:'relative'}}>
          <div style={{fontSize:8,color:'#181818'}}>VOICECRAFT · CLAUDE + ELEVENLABS</div>
          <div style={{fontSize:8,color:'#181818'}}>API KEYS SECURED SERVER-SIDE</div>
        </footer>
      </div>
    </>
  )
}
