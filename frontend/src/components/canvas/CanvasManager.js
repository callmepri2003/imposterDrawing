export default class CanvasManager {
  constructor(committedCanvas, activeCanvas) {
    this.committed = committedCanvas
    this.active = activeCanvas
    this.dpr = 1
    this.isDrawing = false
    this.activePointerId = null
    this.currentColor = '#a78bfa'
    this.currentWidth = 4
    this._onBegin = null
    this._onPoint = null
    this._onEnd = null
    this._remoteColor = '#000000'
    this._remoteWidth = 4
    this._remotePoints = []
    this._isActive = false
    this._resizeObserver = null
    this._boundHandlers = {}
  }

  init() {
    this._scaleDpr()
    this._registerEvents()
    this._setupResizeObserver()
  }

  _scaleDpr() {
    this.dpr = window.devicePixelRatio || 1
    for (const canvas of [this.committed, this.active]) {
      const rect = canvas.getBoundingClientRect()
      canvas.width = Math.round(rect.width * this.dpr)
      canvas.height = Math.round(rect.height * this.dpr)
      const ctx = canvas.getContext('2d')
      ctx.scale(this.dpr, this.dpr)
    }
  }

  _cssSize() {
    const rect = this.active.getBoundingClientRect()
    return { w: rect.width, h: rect.height }
  }

  _normalise(clientX, clientY) {
    const rect = this.active.getBoundingClientRect()
    return {
      x: Math.min(1, Math.max(0, (clientX - rect.left) / rect.width)),
      y: Math.min(1, Math.max(0, (clientY - rect.top) / rect.height)),
    }
  }

  _denormalise(x, y) {
    const { w, h } = this._cssSize()
    return { px: x * w, py: y * h }
  }

  _registerEvents() {
    const el = this.active

    const onDown = (e) => {
      if (!this._isActive) return
      if (this.activePointerId !== null) return
      e.preventDefault()
      this.activePointerId = e.pointerId
      el.setPointerCapture(e.pointerId)
      this.isDrawing = true

      const { x, y } = this._normalise(e.clientX, e.clientY)
      const ctx = el.getContext('2d')
      ctx.clearRect(0, 0, el.width, el.height)
      ctx.beginPath()
      const { px, py } = this._denormalise(x, y)
      ctx.moveTo(px, py)
      ctx.strokeStyle = this.currentColor
      ctx.lineWidth = this.currentWidth
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      this._localPoints = [{ x, y }]
      this._onBegin?.({ x, y })
    }

    const onMove = (e) => {
      if (!this.isDrawing || e.pointerId !== this.activePointerId) return
      e.preventDefault()
      const { x, y } = this._normalise(e.clientX, e.clientY)
      const ctx = el.getContext('2d')
      const { px, py } = this._denormalise(x, y)
      ctx.lineTo(px, py)
      ctx.stroke()
      this._localPoints.push({ x, y })
      this._onPoint?.({ x, y })
    }

    const onUp = (e) => {
      if (e.pointerId !== this.activePointerId) return
      if (!this.isDrawing) return
      e.preventDefault()
      this.isDrawing = false
      this.activePointerId = null
      this._onEnd?.({ points: this._localPoints, color: this.currentColor, width: this.currentWidth })
      this._localPoints = []
    }

    el.addEventListener('pointerdown', onDown)
    el.addEventListener('pointermove', onMove)
    el.addEventListener('pointerup', onUp)
    el.addEventListener('pointercancel', onUp)
    el.style.touchAction = 'none'

    this._boundHandlers = { onDown, onMove, onUp }
  }

  _setupResizeObserver() {
    this._resizeObserver = new ResizeObserver(() => {
      const prevCommitted = this.committed.toDataURL()
      this._scaleDpr()
      // Restore committed canvas from data URL
      const img = new Image()
      img.onload = () => {
        const ctx = this.committed.getContext('2d')
        const { w, h } = this._cssSize()
        ctx.drawImage(img, 0, 0, w, h)
      }
      img.src = prevCommitted
    })
    this._resizeObserver.observe(this.active)
  }

  setActive(active) {
    this._isActive = active
    this.active.style.cursor = active ? 'crosshair' : 'default'
    if (!active) {
      this.isDrawing = false
      this.activePointerId = null
    }
  }

  setColor(color) { this.currentColor = color }
  setWidth(width) { this.currentWidth = width }

  onStrokeBegin(cb) { this._onBegin = cb }
  onStrokePoint(cb) { this._onPoint = cb }
  onStrokeEnd(cb) { this._onEnd = cb }

  drawRemoteStrokeBegin(x, y, color, width) {
    this._remoteColor = color
    this._remoteWidth = width
    this._remotePoints = [{ x, y }]
    const ctx = this.active.getContext('2d')
    ctx.clearRect(0, 0, this.active.width, this.active.height)
    ctx.beginPath()
    const { px, py } = this._denormalise(x, y)
    ctx.moveTo(px, py)
    ctx.strokeStyle = color
    ctx.lineWidth = width
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
  }

  drawRemoteStrokePoint(x, y) {
    this._remotePoints.push({ x, y })
    const ctx = this.active.getContext('2d')
    const { px, py } = this._denormalise(x, y)
    ctx.lineTo(px, py)
    ctx.stroke()
  }

  drawRemoteStrokeEnd(points, color, width) {
    const activeCtx = this.active.getContext('2d')
    activeCtx.clearRect(0, 0, this.active.width, this.active.height)
    this._drawStrokeOnCanvas(this.committed, points, color, width)
  }

  _drawStrokeOnCanvas(canvas, points, color, width) {
    if (!points || points.length === 0) return
    const ctx = canvas.getContext('2d')
    ctx.beginPath()
    ctx.strokeStyle = color
    ctx.lineWidth = width
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    const first = this._denormalise(points[0].x, points[0].y)
    ctx.moveTo(first.px, first.py)
    for (let i = 1; i < points.length; i++) {
      const { px, py } = this._denormalise(points[i].x, points[i].y)
      ctx.lineTo(px, py)
    }
    ctx.stroke()
  }

  replayStrokes(strokes) {
    const ctx = this.committed.getContext('2d')
    const { w, h } = this._cssSize()
    ctx.clearRect(0, 0, w * this.dpr, h * this.dpr)
    for (const stroke of strokes) {
      this._drawStrokeOnCanvas(this.committed, stroke.points, stroke.color, stroke.width)
    }
    // Clear in-progress active canvas
    const actx = this.active.getContext('2d')
    actx.clearRect(0, 0, this.active.width, this.active.height)
  }

  destroy() {
    this._resizeObserver?.disconnect()
    const el = this.active
    const { onDown, onMove, onUp } = this._boundHandlers
    if (onDown) {
      el.removeEventListener('pointerdown', onDown)
      el.removeEventListener('pointermove', onMove)
      el.removeEventListener('pointerup', onUp)
      el.removeEventListener('pointercancel', onUp)
    }
  }
}
