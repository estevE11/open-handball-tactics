import { Circle, Triangle, Square, ImagePlus, Trash2 } from 'lucide-react'
import { useRef } from 'react'
import { defenses, offenses, formation, type Defense, type Offense } from '../../lib/formations'
import { useProjectStore } from '../../store/projectStore'
import type { Point, StoredAsset, TacticalToken } from '../../types/project'

export function Inspector({ assets, urls, upload, addAsset, removeAsset }: { assets: StoredAsset[]; urls: Record<string, string>; upload: (file: File) => void; addAsset: (id: string, p: Point) => void; removeAsset: (id: string) => void }) {
  const { project, frameIndex, edit, selected } = useProjectStore()
  const file = useRef<HTMLInputElement>(null)
  if (!project) return null
  const config = project.courtConfig
  const token = project.keyframes[frameIndex].tokens.find(t => t.id === selected)
  const arrow = project.keyframes[frameIndex].arrows.find(a => a.id === selected)
  function updateToken(patch: Partial<TacticalToken>) { edit(d => { const t = d.keyframes[frameIndex].tokens.find(t => t.id === selected); if (t) Object.assign(t, patch) }) }
  function preset(role: 'defender' | 'attacker', system: Defense | Offense) {
    edit(d => { const frame = d.keyframes[frameIndex]; frame.tokens = [...frame.tokens.filter(t => t.role !== role), ...formation(role, system)] })
  }
  return <aside className="inspector">
    <div className="panel-title">Board settings <span className="tiny-label">LIVE</span></div>
    {(token || arrow) && <section className="inspector-section selected-panel"><h3>Selected {token ? token.role : 'trajectory'}</h3>
      {token && <><label>Label<input aria-label="Token label" maxLength={80} value={token.label} onChange={e => updateToken({ label: e.target.value })}/></label>
        {!token.equipment && <div className="shape-options">{(['circle', 'triangle', 'square'] as const).map((shape, i) => { const Icon = [Circle, Triangle, Square][i]; return <button key={shape} className={token.shape === shape ? 'active' : ''} onClick={() => updateToken({ shape })} aria-label={`Use ${shape}`}><Icon size={16}/></button> })}</div>}
        <label className="inline-label">Color<input type="color" aria-label="Token color" value={token.color} onChange={e => updateToken({ color: e.target.value })}/></label>
        <label className="inline-label">Size<input type="range" aria-label="Token size" min="4" max="50" value={token.size} onChange={e => updateToken({ size: Number(e.target.value) })}/></label></>}
      {arrow && <p className="muted">Drag the blue handle to curve this trajectory.</p>}
      <button className="text-button danger" onClick={() => edit(d => { const f = d.keyframes[frameIndex]; f.tokens = f.tokens.filter(t => t.id !== selected); f.arrows = f.arrows.filter(a => a.id !== selected); const used = new Set(d.keyframes.flatMap(f => f.tokens.map(t => t.assetId))); d.customAssets = d.customAssets.filter(a => used.has(a.id)) })}><Trash2 size={14}/> Delete selection</button>
    </section>}
    <section className="inspector-section"><h3>Court</h3><label>Template<select value={config.type} onChange={e => edit(d => { d.courtConfig.type = e.target.value as typeof config.type; d.courtConfig.dimensions = { width: 20, height: e.target.value === 'full' ? 40 : 20 } })}><option value="half">Half court · 20 × 20 m</option><option value="full">Full court · 40 × 20 m</option><option value="custom_box">Custom practice area</option></select></label>
      {config.type === 'custom_box' && <div className="two-cols">{(['width', 'height'] as const).map(axis => <label key={axis}>{axis} (m)<input type="number" min="10" max="100" value={config.dimensions[axis]} onChange={e => edit(d => { d.courtConfig.dimensions[axis] = Math.max(10, Math.min(100, Number(e.target.value))) })}/></label>)}</div>}
      <div className="color-row">{(['floor', 'area', 'lines'] as const).map(key => <label key={key}><input type="color" aria-label={`Court ${key} color`} value={config.themeColors[key]} onChange={e => edit(d => { d.courtConfig.themeColors[key] = e.target.value })}/><span>{key}</span></label>)}</div>
      <label className="inline-label">Line weight<input type="range" aria-label="Court line weight" min="1" max="5" step=".5" value={config.lineWeight} onChange={e => edit(d => { d.courtConfig.lineWeight = Number(e.target.value) })}/></label>
      {(['grid', 'showLabels', 'highlight'] as const).map((key, i) => <label className="toggle-row" key={key}>{['Show grid', 'Player labels', 'Highlight key lines'][i]}<input type="checkbox" checked={config[key]} onChange={e => edit(d => { d.courtConfig[key] = e.target.checked })}/></label>)}
    </section>
    <section className="inspector-section"><h3>Quick formations</h3><p className="muted">Set your shape. Make it your own.</p><div className="formation-label"><Triangle size={12} fill="#eaa958" color="#c88b41"/> Defense</div><div className="preset-grid">{defenses.map(system => <button key={system} onClick={() => preset('defender', system)}>{system}</button>)}</div><div className="formation-label"><Circle size={12} fill="#4f8cba" color="#4f8cba"/> Offense</div><div className="preset-grid">{offenses.map(system => <button key={system} onClick={() => preset('attacker', system)}>{system}</button>)}</div></section>
    <section className="inspector-section"><div className="section-heading"><h3>Your assets</h3><button className="icon-button" aria-label="Upload image" onClick={() => file.current?.click()}><ImagePlus size={16}/></button></div><input ref={file} hidden type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={e => { if (e.target.files?.[0]) upload(e.target.files[0]); e.target.value = '' }}/>
      {assets.length ? <div className="assets">{assets.map(a => <div key={a.id} className="asset"><button draggable onDragStart={e => e.dataTransfer.setData('application/handball-asset', a.id)} onClick={() => addAsset(a.id, { x: 200, y: 330 })} title={`Add ${a.name}`} aria-label={`Add ${a.name}`}><img src={urls[a.id]} alt={a.name}/></button><button className="asset-delete" onClick={() => removeAsset(a.id)} aria-label={`Delete asset ${a.name}`}><Trash2 size={10}/></button></div>)}</div> : <button className="asset-upload" onClick={() => file.current?.click()}><ImagePlus size={21}/><span>Bring your own images</span><small>PNG, JPG, WebP, GIF · up to 10 MB</small></button>}
      {assets.length > 0 && <p className="muted">Click or drag an image onto the court.</p>}
    </section>
  </aside>
}
