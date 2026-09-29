import type { Tab } from '../state'

interface Props {
  tabs: Tab[]
  activeId: string | undefined
  onActivate: (id: string) => void
  onClose: (id: string) => void
}

/** 複数の文書をタブで開く（D13） */
export function TabBar({ tabs, activeId, onActivate, onClose }: Props) {
  return (
    <div className="tabbar" role="tablist" aria-label="開いている文書">
      {tabs.map((tab) => (
        <div key={tab.id} className={tab.id === activeId ? 'tab is-active' : 'tab'} title={tab.doc.path}>
          <button
            type="button"
            role="tab"
            aria-selected={tab.id === activeId}
            className="tab-name"
            onClick={() => onActivate(tab.id)}
            onAuxClick={(e) => {
              if (e.button === 1) onClose(tab.id)
            }}
          >
            {tab.doc.name}
            {tab.stale && <span className="tab-stale" aria-label="更新あり" />}
          </button>
          <button type="button" className="tab-close" aria-label={`${tab.doc.name}を閉じる`} onClick={() => onClose(tab.id)}>
            ×
          </button>
        </div>
      ))}
    </div>
  )
}
