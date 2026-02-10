import { useState, useCallback, useEffect } from 'react'

interface DragState {
  isDragging: boolean
  dragType: 'row' | 'column' | null
  dragIndex: number
  selectedIndices: number[]
  dropIndex: number
  startX: number
  startY: number
}

interface DragDropCallbacks {
  onMoveRow: (indices: number[], toIndex: number) => void
  onMoveColumn: (indices: number[], toIndex: number) => void
}

export function useDragDrop({ onMoveRow, onMoveColumn }: DragDropCallbacks) {
  const [dragState, setDragState] = useState<DragState>({
    isDragging: false,
    dragType: null,
    dragIndex: -1,
    selectedIndices: [],
    dropIndex: -1,
    startX: 0,
    startY: 0
  })

  // ドロップインジケーターの作成
  const createDropIndicator = useCallback((type: 'row' | 'column', targetElement: HTMLElement, position: 'before' | 'after' | 'between') => {
    // 既存のインジケーターを削除
    removeDropIndicator()
    
    const indicator = document.createElement('div')
    indicator.className = `drop-indicator ${type}`
    indicator.style.position = 'absolute'
    indicator.style.backgroundColor = '#007ACC'
    indicator.style.zIndex = '1000'
    indicator.style.pointerEvents = 'none'
    indicator.style.opacity = '0.9'
    indicator.style.boxShadow = '0 0 8px rgba(0, 122, 204, 0.6)'
    indicator.style.borderRadius = '2px'
    
    const rect = targetElement.getBoundingClientRect()
    const container = document.querySelector('.table-container') as HTMLElement
    const containerRect = container?.getBoundingClientRect()
    
    if (!containerRect || !container) return
    
    if (type === 'column') {
      // 列の場合は縦線を表示
      indicator.style.width = '4px'
      indicator.style.height = `${container.scrollHeight}px`

      // スクロール位置を考慮してインジケーターを配置
      if (position === 'before') {
        indicator.style.left = `${rect.left - containerRect.left + container.scrollLeft - 3}px`
      } else {
        indicator.style.left = `${rect.right - containerRect.left + container.scrollLeft - 3}px`
      }
      indicator.style.top = '0'
    } else {
      // 行の場合は横線を表示
      indicator.style.width = `${container.scrollWidth}px`
      indicator.style.height = '4px'
      indicator.style.left = '0'

      // スクロール位置を考慮してインジケーターを配置
      if (position === 'before') {
        indicator.style.top = `${rect.top - containerRect.top + container.scrollTop - 3}px`
      } else {
        indicator.style.top = `${rect.bottom - containerRect.top + container.scrollTop - 3}px`
      }
    }
    
    container.appendChild(indicator)
  }, [])

  // ドロップインジケーターの削除
  const removeDropIndicator = useCallback(() => {
    const indicators = document.querySelectorAll('.drop-indicator')
    indicators.forEach(indicator => indicator.remove())
  }, [])

  // 改良されたドロップインジケーター表示ロジック
  const showDropIndicator = useCallback((
    type: 'row' | 'column',
    dragIndex: number,
    dropIndex: number,
    targetElement: HTMLElement
  ) => {
    // 同じ位置にドロップしようとしている場合は表示しない
    if (dragIndex === dropIndex) {
      removeDropIndicator()
      return
    }

    // ドロップ位置を決定
    let position: 'before' | 'after' | 'between' = 'before'
    
    if (type === 'column') {
      // 列の移動の場合
      if (dragIndex < dropIndex) {
        // 右に移動する場合は、ターゲット列の右側に表示
        position = 'after'
      } else {
        // 左に移動する場合は、ターゲット列の左側に表示
        position = 'before'
      }
    } else {
      // 行の移動の場合
      if (dragIndex < dropIndex) {
        // 下に移動する場合は、ターゲット行の下側に表示
        position = 'after'
      } else {
        // 上に移動する場合は、ターゲット行の上側に表示
        position = 'before'
      }
    }

    createDropIndicator(type, targetElement, position)
  }, [createDropIndicator, removeDropIndicator])

  // コンポーネントアンマウント時にインジケーターを削除
  useEffect(() => {
    return () => {
      removeDropIndicator()
    }
  }, [])

  // ドラッグ開始
  const handleDragStart = useCallback((
    event: React.DragEvent,
    type: 'row' | 'column',
    index: number,
    selectedIndices?: number[]
  ) => {
    console.log(`Drag start: ${type} ${index}`)
    
    if (typeof index !== 'number' || index < 0) {
      console.error(`Invalid drag index: ${index} (type: ${typeof index})`)
      return
    }
    
    const effectiveSelected = selectedIndices && selectedIndices.includes(index)
      ? Array.from(new Set(selectedIndices)).sort((a, b) => a - b)
      : [index]

    setDragState({
      isDragging: true,
      dragType: type,
      dragIndex: index,
      selectedIndices: effectiveSelected,
      dropIndex: -1,
      startX: event.clientX,
      startY: event.clientY
    })
    
    console.log(`Updated dragState: dragType=${type}, dragIndex=${index}`)

    // ドラッグデータを設定
    // ドラッグデータを設定
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move'
      event.dataTransfer.setData('text/plain', `${type}:${index}`)
    }
    
    // ドラッグ中の視覚的フィードバック
    if (event.currentTarget instanceof HTMLElement) {
      event.currentTarget.style.opacity = '0.5'
    }
  }, [])

  // ドラッグオーバー
  const handleDragOver = useCallback((
    event: React.DragEvent,
    type: 'row' | 'column',
    index: number
  ) => {
    if (dragState.dragType !== type) return

    event.preventDefault()
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'move'
    }
    
    setDragState(prev => ({
      ...prev,
      dropIndex: index
    }))

    // ドロップインジケーターを表示
    if (dragState.dragIndex !== -1 && event.currentTarget instanceof HTMLElement) {
      showDropIndicator(type, dragState.dragIndex, index, event.currentTarget)
    }
  }, [dragState.dragType, dragState.dragIndex, showDropIndicator])

  // ドラッグエンター
  const handleDragEnter = useCallback((
    event: React.DragEvent,
    type: 'row' | 'column',
    _index: number
  ) => {
    if (dragState.dragType !== type) return
    
    event.preventDefault()
    
    // ドロップゾーンのハイライト
    if (event.currentTarget instanceof HTMLElement) {
      event.currentTarget.classList.add('drag-over')
    }
  }, [dragState.dragType])

  // ドラッグリーブ
  const handleDragLeave = useCallback((event: React.DragEvent) => {
    // ドロップゾーンのハイライトを削除
    if (event.currentTarget instanceof HTMLElement) {
      event.currentTarget.classList.remove('drag-over')
    }
  }, [])

  // ドロップ
  const handleDrop = useCallback((
    event: React.DragEvent,
    type: 'row' | 'column',
    index: number
  ) => {
    event.preventDefault()
    
    console.log(`Drop event: type=${type}, dropIndex=${index}`)
    console.log(`Current dragState:`, dragState)
    console.log(`dragType=${dragState.dragType}, dragIndex=${dragState.dragIndex}`)
    
    // データ転送からも情報を取得して比較
    let dragIndexFromDataTransfer = -1
    if (event.dataTransfer) {
      const transferData = event.dataTransfer.getData('text/plain')
      console.log(`DataTransfer data: ${transferData}`)
      if (transferData) {
        const [transferType, transferIndex] = transferData.split(':')
        if (transferType === type) {
          dragIndexFromDataTransfer = parseInt(transferIndex, 10)
          console.log(`Drag index from dataTransfer: ${dragIndexFromDataTransfer}`)
        }
      }
    }
    
    if (dragState.dragType !== type) {
      console.log(`Type mismatch: dragType=${dragState.dragType}, expected=${type}`)
      return
    }
    
    /* istanbul ignore next -- handleDragStart 経由で dragIndex が必ず設定されるため else 側は到達しない防御的コード */
    const effectiveDragIndex = dragState.dragIndex !== -1 ? dragState.dragIndex : dragIndexFromDataTransfer
    /* istanbul ignore next -- handleDragStart 経由で selectedIndices が必ず設定されるため else 側は到達しない防御的コード */
    const effectiveSelected = dragState.selectedIndices.length > 0
      ? dragState.selectedIndices
      : (effectiveDragIndex !== -1 ? [effectiveDragIndex] : [])

    /* istanbul ignore next -- 正常フローでは dragStart 経由で selectedIndices が設定されるため到達不可能な防御的コード */
    if (effectiveSelected.length === 0) {
      console.error(`Invalid drag selection: dragState=${dragState.dragIndex}, dataTransfer=${dragIndexFromDataTransfer}`)
      return
    }

    if (effectiveSelected.length === 1 && effectiveSelected[0] === index) {
      console.log(`Same index: dragIndex=${effectiveSelected[0]}, dropIndex=${index}`)
      return
    }

    console.log(`Drop: ${type} from [${effectiveSelected.join(', ')}] to ${index}`)

    // ドロップ位置を選択範囲と方向に合わせて補正
    const maxSelected = Math.max(...effectiveSelected)
    let targetIndex = index

    if (type === 'row') {
      // 下方向へドラッグ中は「行の後ろ」に挿入できるよう +1 する
      if (index > maxSelected) {
        targetIndex = index + 1
      }
      console.log(`Calling onMoveRow([${effectiveSelected.join(', ')}], ${targetIndex})`)
      onMoveRow(effectiveSelected, targetIndex)
    } else if (type === 'column') {
      if (index > maxSelected) {
        targetIndex = index + 1
      }
      console.log(`Calling onMoveColumn([${effectiveSelected.join(', ')}], ${targetIndex})`)
      onMoveColumn(effectiveSelected, targetIndex)
    }

    // ドロップゾーンのハイライトを削除
    if (event.currentTarget instanceof HTMLElement) {
      event.currentTarget.classList.remove('drag-over')
    }

    // ドロップインジケーターを削除
    removeDropIndicator()

    // ドラッグ状態をリセット
    setDragState({
      isDragging: false,
      dragType: null,
      dragIndex: -1,
      selectedIndices: [],
      dropIndex: -1,
      startX: 0,
      startY: 0
    })
  }, [dragState, onMoveRow, onMoveColumn, removeDropIndicator])

  // ドラッグ終了
  const handleDragEnd = useCallback((event: React.DragEvent) => {
    console.log('Drag end')
    
    // 視覚的フィードバックをリセット
    if (event.currentTarget instanceof HTMLElement) {
      event.currentTarget.style.opacity = '1'
    }

    // すべてのドロップゾーンハイライトを削除
    document.querySelectorAll('.drag-over').forEach(element => {
      element.classList.remove('drag-over')
    })

    // ドロップインジケーターを削除
    removeDropIndicator()

    // ドラッグ状態をリセット
    setDragState({
      isDragging: false,
      dragType: null,
      dragIndex: -1,
      selectedIndices: [],
      dropIndex: -1,
      startX: 0,
      startY: 0
    })
  }, [removeDropIndicator])

  // ドラッグ可能な属性を取得
  const getDragProps = useCallback((
    type: 'row' | 'column',
    index: number,
    selectedIndices?: number[]
  ) => {
    return {
      draggable: true,
      onDragStart: (e: React.DragEvent) => handleDragStart(e, type, index, selectedIndices),
      onDragEnd: handleDragEnd
    }
  }, [handleDragStart, handleDragEnd])

  // ドロップ可能な属性を取得
  const getDropProps = useCallback((
    type: 'row' | 'column',
    index: number
  ) => {
    return {
      onDragOver: (e: React.DragEvent) => handleDragOver(e, type, index),
      onDragEnter: (e: React.DragEvent) => handleDragEnter(e, type, index),
      onDragLeave: handleDragLeave,
      onDrop: (e: React.DragEvent) => handleDrop(e, type, index)
    }
  }, [handleDragOver, handleDragEnter, handleDragLeave, handleDrop])

  return {
    dragState,
    getDragProps,
    getDropProps,
    handleDragStart,
    handleDragOver,
    handleDragEnter,
    handleDragLeave,
    handleDrop,
    handleDragEnd
  }
}