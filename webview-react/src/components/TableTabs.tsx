import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { TableData } from '../types'
import { useDynamicTheme } from '../contexts/DynamicThemeContext'
import {
  TabsContainer,
  TabsScrollArea,
  TabButton,
  HamburgerButton,
  DropdownMenu,
  DropdownItem,
  Tooltip
} from './TableTabs.styles'

interface TableTabsProps {
  tables: TableData[]
  currentTableIndex: number
  onTabChange: (index: number) => void
  tabLabelMode?: string
}

interface FixedPos { top: number; left: number }
interface MenuPos { top?: number; bottom?: number; left: number }

const TOOLTIP_DELAY_MS = 1000

const TableTabs: React.FC<TableTabsProps> = ({
  tables,
  currentTableIndex,
  onTabChange,
  tabLabelMode = 'number'
}) => {
  const { t } = useTranslation()
  const { theme } = useDynamicTheme()
  const [menuOpen, setMenuOpen] = useState(false)
  const [menuPos, setMenuPos] = useState<MenuPos>({ top: 0, left: 0 })
  const [tooltip, setTooltip] = useState<{ label: string; pos: FixedPos } | null>(null)
  const hamburgerRef = useRef<HTMLButtonElement>(null)
  const dropdownMenuRef = useRef<HTMLUListElement>(null)
  const tooltipTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const getTabLabel = useCallback((table: TableData, index: number): string => {
    if (tabLabelMode === 'heading' && table.headingLabel) {
      return table.headingLabel
    }
    return t('tableTabs.tableLabel', { index: index + 1 })
  }, [tabLabelMode, t])

  const handleHamburgerClick = useCallback(() => {
    if (!hamburgerRef.current) return
    const rect = hamburgerRef.current.getBoundingClientRect()
    const DROPDOWN_MAX_HEIGHT = 320
    const GAP = 4
    const spaceBelow = window.innerHeight - rect.bottom - GAP
    const spaceAbove = rect.top - GAP
    const openUpward = spaceBelow < DROPDOWN_MAX_HEIGHT && spaceAbove > spaceBelow
    const pos: MenuPos = openUpward
      ? { bottom: window.innerHeight - rect.top + GAP, left: rect.left }
      : { top: rect.bottom + GAP, left: rect.left }
    setMenuPos(pos)
    setMenuOpen(prev => !prev)
  }, [])

  useEffect(() => {
    if (!menuOpen) return
    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as Node
      if (hamburgerRef.current && hamburgerRef.current.contains(target)) return
      if (dropdownMenuRef.current && dropdownMenuRef.current.contains(target)) return
      setMenuOpen(false)
    }
    document.addEventListener('mousedown', handleOutsideClick)
    return () => document.removeEventListener('mousedown', handleOutsideClick)
  }, [menuOpen])

  const handleTabMouseEnter = useCallback((e: React.MouseEvent<HTMLButtonElement>, label: string) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const pos = { top: rect.top - 32, left: rect.left + rect.width / 2 }
    if (tooltipTimerRef.current) clearTimeout(tooltipTimerRef.current)
    tooltipTimerRef.current = setTimeout(() => {
      setTooltip({ label, pos })
    }, TOOLTIP_DELAY_MS)
  }, [])

  const handleTabMouseLeave = useCallback(() => {
    if (tooltipTimerRef.current) {
      clearTimeout(tooltipTimerRef.current)
      tooltipTimerRef.current = null
    }
    setTooltip(null)
  }, [])

  useEffect(() => () => {
    if (tooltipTimerRef.current) clearTimeout(tooltipTimerRef.current)
  }, [])

  if (tables.length <= 1) {
    return null
  }

  return (
    <TabsContainer
      data-testid="mte-table-tabs"
      style={{
        backgroundColor: theme.panelBackground,
        borderTop: `1px solid ${theme.panelBorder}`,
      }}
    >
      <HamburgerButton
        ref={hamburgerRef}
        data-testid="mte-tab-menu-button"
        onClick={handleHamburgerClick}
        title={t('tableTabs.menuTitle', 'Table list')}
        aria-haspopup="listbox"
        aria-expanded={menuOpen}
        style={{ color: theme.editorForeground }}
      >
        ☰
      </HamburgerButton>

      <TabsScrollArea>
        {tables.map((table, index) => {
          const label = getTabLabel(table, index)
          const active = index === currentTableIndex
          return (
            <TabButton
              key={index}
              data-testid={`mte-tab-button-${index}`}
              active={active}
              data-tooltip={label}
              onClick={() => onTabChange(index)}
              onMouseEnter={e => handleTabMouseEnter(e, label)}
              onMouseLeave={handleTabMouseLeave}
              style={{
                backgroundColor: active ? theme.tabActiveBackground : theme.tabInactiveBackground,
                color: active ? theme.tabActiveForeground : theme.tabInactiveForeground,
                borderBottom: `2px solid ${active ? theme.tabActiveBorderTop : 'transparent'}`,
              }}
            >
              {label}
            </TabButton>
          )
        })}
      </TabsScrollArea>

      {menuOpen && createPortal(
        <DropdownMenu
          ref={dropdownMenuRef}
          role="listbox"
          data-testid="mte-tab-menu"
          {...menuPos}
          style={{
            backgroundColor: theme.menuBackground,
            color: theme.menuForeground,
            border: `1px solid ${theme.menuBorder}`,
          }}
        >
          {tables.map((table, index) => {
            const label = getTabLabel(table, index)
            return (
              <DropdownItem
                key={index}
                role="option"
                active={index === currentTableIndex}
                data-testid={`mte-tab-menu-item-${index}`}
                title={label}
                onClick={() => {
                  onTabChange(index)
                  setMenuOpen(false)
                }}
              >
                {label}
              </DropdownItem>
            )
          })}
        </DropdownMenu>,
        document.body
      )}

      {tooltip && createPortal(
        <Tooltip
          top={tooltip.pos.top}
          left={tooltip.pos.left}
          style={{
            backgroundColor: theme.editorWidgetBackground,
            color: theme.editorForeground,
            border: `1px solid ${theme.editorWidgetBorder}`,
          }}
        >
          {tooltip.label}
        </Tooltip>,
        document.body
      )}
    </TabsContainer>
  )
}

export default TableTabs
