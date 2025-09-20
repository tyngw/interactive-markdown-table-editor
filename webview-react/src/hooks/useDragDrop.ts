import { useState, useCallback, useEffect } from 'react'

interface DragState {
  isDragging: boolean
  dragType: 'row' | 'column' | null
  dragIndex: number
  dropIndex: number
  startX: number
  startY: number
}

interface DragDropCallbacks {
  onMoveRow: (fromIndex: number, toIndex: number) => void
  onMoveColumn: (fromIndex: number, toIndex: number) => void
}

export function useDragDrop({ onMoveRow, onMoveColumn }: DragDropCallbacks) {
  const [dragState, setDragState] = useState<DragState>({
    isDragging: false,
    dragType: null,
    dragIndex: -1,
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
      
      if (position === 'before') {
        indicator.style.left = `${rect.left - containerRect.left - 3}px`
      } else {
        indicator.style.left = `${rect.right - containerRect.left - 3}px`
      }
      indicator.style.top = '0'
    } else {
      // 行の場合は横線を表示
      indicator.style.width = `${container.scrollWidth}px`
      indicator.style.height = '4px'
      indicator.style.left = '0'
      
      if (position === 'before') {
        indicator.style.top = `${rect.top - containerRect.top - 3}px`
      } else {
        indicator.style.top = `${rect.bottom - containerRect.top - 3}px`
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
    index: number
  ) => {
    console.log(`Drag start: ${type} ${index}`)
    
    if (typeof index !== 'number' || index < 0) {
      console.error(`Invalid drag index: ${index} (type: ${typeof index})`)
      return
    }
    
    setDragState({
      isDragging: true,
      dragType: type,
      dragIndex: index,
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
    
    // どちらからもドラッグインデックスを取得できない場合はエラー
    const effectiveDragIndex = dragState.dragIndex !== -1 ? dragState.dragIndex : dragIndexFromDataTransfer
    
    if (effectiveDragIndex === index) {
      console.log(`Same index: dragIndex=${effectiveDragIndex}, dropIndex=${index}`)
      return
    }

    if (effectiveDragIndex === -1) {
      console.error(`Invalid dragIndex: dragState=${dragState.dragIndex}, dataTransfer=${dragIndexFromDataTransfer}`)
      return
    }

    console.log(`Drop: ${type} from ${effectiveDragIndex} to ${index}`)

    // 移動を実行
    if (type === 'row') {
      console.log(`Calling onMoveRow(${effectiveDragIndex}, ${index})`)
      onMoveRow(effectiveDragIndex, index)
    } else if (type === 'column') {
      console.log(`Calling onMoveColumn(${effectiveDragIndex}, ${index})`)
      onMoveColumn(effectiveDragIndex, index)
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
      dropIndex: -1,
      startX: 0,
      startY: 0
    })
  }, [removeDropIndicator])

  // ドラッグ可能な属性を取得
  const getDragProps = useCallback((
    type: 'row' | 'column',
    index: number
  ) => {
    return {
      draggable: true,
      onDragStart: (e: React.DragEvent) => handleDragStart(e, type, index),
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