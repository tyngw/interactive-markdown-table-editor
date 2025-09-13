import { useState, useCallback } from 'react'

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

  // ドラッグ開始
  const handleDragStart = useCallback((
    event: React.DragEvent,
    type: 'row' | 'column',
    index: number
  ) => {
    console.log(`Drag start: ${type} ${index}`)
    
    setDragState({
      isDragging: true,
      dragType: type,
      dragIndex: index,
      dropIndex: -1,
      startX: event.clientX,
      startY: event.clientY
    })

    // ドラッグデータを設定
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', `${type}:${index}`)
    
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
    event.dataTransfer.dropEffect = 'move'
    
    setDragState(prev => ({
      ...prev,
      dropIndex: index
    }))
  }, [dragState.dragType])

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
    
    if (dragState.dragType !== type || dragState.dragIndex === index) {
      return
    }

    console.log(`Drop: ${type} from ${dragState.dragIndex} to ${index}`)

    // 移動を実行
    if (type === 'row') {
      onMoveRow(dragState.dragIndex, index)
    } else if (type === 'column') {
      onMoveColumn(dragState.dragIndex, index)
    }

    // ドロップゾーンのハイライトを削除
    if (event.currentTarget instanceof HTMLElement) {
      event.currentTarget.classList.remove('drag-over')
    }

    // ドラッグ状態をリセット
    setDragState({
      isDragging: false,
      dragType: null,
      dragIndex: -1,
      dropIndex: -1,
      startX: 0,
      startY: 0
    })
  }, [dragState, onMoveRow, onMoveColumn])

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

    // ドラッグ状態をリセット
    setDragState({
      isDragging: false,
      dragType: null,
      dragIndex: -1,
      dropIndex: -1,
      startX: 0,
      startY: 0
    })
  }, [])

  // ドラッグ可能な属性を取得
  const getDragProps = useCallback((
    type: 'row' | 'column',
    index: number
  ) => ({
    draggable: true,
    onDragStart: (e: React.DragEvent) => handleDragStart(e, type, index),
    onDragEnd: handleDragEnd
  }), [handleDragStart, handleDragEnd])

  // ドロップ可能な属性を取得
  const getDropProps = useCallback((
    type: 'row' | 'column',
    index: number
  ) => ({
    onDragOver: (e: React.DragEvent) => handleDragOver(e, type, index),
    onDragEnter: (e: React.DragEvent) => handleDragEnter(e, type, index),
    onDragLeave: handleDragLeave,
    onDrop: (e: React.DragEvent) => handleDrop(e, type, index)
  }), [handleDragOver, handleDragEnter, handleDragLeave, handleDrop])

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