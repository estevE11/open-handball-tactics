import type { DrillProject } from '../../types/project'

export function Court({ config }: { config: DrillProject['courtConfig'] }) {
  const { themeColors: c, type, lineWeight, grid, highlight } = config
  const width = type === 'custom_box' ? config.dimensions.width * 20 : 400
  const height = type === 'full' ? 800 : type === 'half' ? 400 : config.dimensions.height * 20
  const end = (bottom = false) => <g transform={bottom ? 'translate(400 800) rotate(180)' : undefined}>
    <path d="M50 0 A120 120 0 0 0 170 120 H230 A120 120 0 0 0 350 0 Z" fill={c.area} stroke={highlight ? '#eaa958' : c.lines}/>
    <path d="M-10 0 A180 180 0 0 0 170 180 H230 A180 180 0 0 0 410 0" fill="none" strokeDasharray="8 7"/>
    <path d="M190 140h20M195 80h10" stroke={highlight ? '#eaa958' : c.lines}/>
    <rect x="170" y="-12" width="60" height="12" fill="#fafafa" stroke="#697d73"/>
    <path d="M180 -12v12m10 -12v12m10 -12v12m10 -12v12m10 -12v12" stroke="#a1b0a8" strokeWidth="2"/>
  </g>
  return <g stroke={c.lines} strokeWidth={lineWeight}>
    <defs><pattern id="court-grid" width="20" height="20" patternUnits="userSpaceOnUse"><path d="M20 0H0V20" fill="none" stroke="#536c5d" strokeWidth="0.5" opacity="0.2"/></pattern></defs>
    <rect width={width} height={height} fill={c.floor}/>
    {type !== 'custom_box' && <>{end()}{type === 'full' && end(true)}<path d={`M0 ${type === 'full' ? 400 : 399}H400`}/><path d="M0 310h-7M400 310h7" stroke={highlight ? '#eaa958' : c.lines}/>{type === 'full' && <path d="M0 490h-7M400 490h7"/>}</>}
    {grid && <rect width={width} height={height} fill="url(#court-grid)" stroke="none"/>}
    <rect width={width} height={height} fill="none"/>
  </g>
}
