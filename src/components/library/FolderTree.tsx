import { ChevronDown, ChevronRight, Folder, FolderOpen, MoreHorizontal, LayoutGrid } from 'lucide-react'
import { useState } from 'react'
import type { DrillProject, FolderNode } from '../../types/project'

interface Props { folders: FolderNode[]; projects: DrillProject[]; active: string | null; onSelect: (id: string | null) => void; onManage: (folder: FolderNode) => void }
export function FolderTree({ folders, projects, active, onSelect, onManage }: Props) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  function branch(parent: string | null, depth = 0): React.ReactNode {
    return folders.filter(f => f.parentId === parent).sort((a, b) => a.name.localeCompare(b.name)).map(folder => {
      const open = !collapsed.has(folder.id)
      const children = folders.some(f => f.parentId === folder.id)
      return <div key={folder.id}>
        <div className={`folder-row ${active === folder.id ? 'active' : ''}`} style={{ paddingLeft: 9 + depth * 15 }}>
          <button className="tree-toggle" aria-label={`${open ? 'Collapse' : 'Expand'} ${folder.name}`} disabled={!children} onClick={() => setCollapsed(previous => { const next = new Set(previous); if (open) next.add(folder.id); else next.delete(folder.id); return next })}>{children && (open ? <ChevronDown size={12}/> : <ChevronRight size={12}/>)}</button>
          <button className="folder-select" onClick={() => onSelect(folder.id)}>{active === folder.id ? <FolderOpen size={16}/> : <Folder size={16}/>}<span>{folder.name}</span><small>{projects.filter(p => p.folderId === folder.id).length}</small></button>
          <button className="folder-manage icon-button" aria-label={`Manage ${folder.name}`} onClick={() => onManage(folder)}><MoreHorizontal size={14}/></button>
        </div>
        {open && branch(folder.id, depth + 1)}
      </div>
    })
  }
  return <nav aria-label="Drill folders"><button className={`all-drills ${active === null ? 'active' : ''}`} onClick={() => onSelect(null)}><LayoutGrid size={16}/><span>All drills</span><small>{projects.length}</small></button>{branch(null)}</nav>
}
