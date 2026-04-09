import { useEffect, useRef, useCallback } from 'react'
import * as d3 from 'd3'
import * as topojson from 'topojson-client'
import type { GridData, BaGenData, BaCarbonData, Mode, LayerKey } from '../types'
import { FUEL_COLORS, BA_COLORS, BA_DEFS } from '../data/ba'
import { NUCLEAR_PLANTS, HYDRO_PLANTS, WIND_FARMS, SOLAR_FARMS, GAS_PLANTS, COAL_PLANTS, EXTRA_SEEDS } from '../data/plants'

function hexToRgb(hex: string) {
  return {
    r: parseInt(hex.slice(1, 3), 16),
    g: parseInt(hex.slice(3, 5), 16),
    b: parseInt(hex.slice(5, 7), 16),
  }
}

function controlPoint(src: [number, number], tgt: [number, number]): [number, number] {
  const mx = (src[0] + tgt[0]) / 2, my = (src[1] + tgt[1]) / 2
  const dx = tgt[0] - src[0], dy = tgt[1] - src[1]
  const len = Math.sqrt(dx * dx + dy * dy) || 1
  return [mx - (dy / len) * len * 0.18, my + (dx / len) * len * 0.18]
}

function bezierPt(t: number, p0: [number, number], cp: [number, number], p1: [number, number]): [number, number] {
  const mt = 1 - t
  return [mt * mt * p0[0] + 2 * mt * t * cp[0] + t * t * p1[0], mt * mt * p0[1] + 2 * mt * t * cp[1] + t * t * p1[1]]
}

interface Arc { src: [number, number]; cp: [number, number]; tgt: [number, number]; norm: number; fwd: boolean; srcId: string; tgtId: string }
interface Particle { src: [number, number]; cp: [number, number]; tgt: [number, number]; t: number; speed: number; norm: number; fwd: boolean; srcId: string; tgtId: string }

// Carbon intensity color scale: green (clean) → red (dirty), domain [0, 800] g CO2/kWh
const carbonColor = d3.scaleSequential(d3.interpolateRdYlGn).domain([800, 0])

interface Props {
  data: GridData | null
  onBAHover: (id: string | null) => void
  selectedBA: string | null
  onBASelect: (id: string | null) => void
  mode: Mode
  layers: Set<LayerKey>
  genData: BaGenData[] | null
  carbonData: BaCarbonData[] | null
}

export function GridMap({ data, onBAHover, selectedBA, onBASelect, mode, layers, genData, carbonData }: Props) {
  const svgRef    = useRef<SVGSVGElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const dataRef   = useRef<typeof data>(null)

  // Refs for D3-owned hover state — no React in the mousemove hot path
  const hoveredBARef  = useRef<string | null>(null)
  const selectedBARef = useRef<string | null>(selectedBA)
  const modeRef       = useRef<Mode>(mode)
  const carbonDataRef = useRef(carbonData)
  const S = useRef({
    transform:      d3.zoomIdentity as d3.ZoomTransform,
    pos:            new Map<string, [number, number]>(),
    arcData:        [] as Arc[],
    particles:      [] as Particle[],
    plantPts:       { nuclear: [] as [number,number,number][], hydro: [] as [number,number,number][], wind: [] as [number,number,number][], solar: [] as [number,number,number][], gas: [] as [number,number,number][], coal: [] as [number,number,number][] },
    raf:            0,
    mode:           'flow' as Mode,
    layerArcs:      true,
    layerParticles: true,
    layerNuclear:   true,
    layerHydro:     true,
    layerWind:      true,
    layerSolar:     true,
    layerGas:       true,
    layerCoal:      true,
    genMap:         new Map<string, BaGenData>(),
    carbonMap:      new Map<string, number>(),
  })

  // Stable — reads all visual state from refs so D3 event handlers can call it
  // directly without going through React. Zero re-renders on mousemove.
  const applyHoverVisuals = useCallback(() => { // eslint-disable-line react-hooks/exhaustive-deps
    if (!svgRef.current) return
    const svg      = d3.select(svgRef.current)
    const pos      = S.current.pos
    const k        = S.current.transform.k
    const hovered  = hoveredBARef.current
    const selected = selectedBARef.current
    const activeBA = hovered ?? selected
    const m        = modeRef.current
    const cData    = carbonDataRef.current

    svg.selectAll<SVGPathElement, any>('.ba-fill').each(function () {
      const baId    = d3.select(this).attr('data-ba')
      const isActive = baId === activeBA
      let fill: string
      if (m === 'carbon' && cData) {
        const entry = cData.find(d => d.ba === baId)
        if (entry) {
          const c = d3.color(carbonColor(entry.intensity))!.rgb()
          fill = isActive ? `rgba(${c.r},${c.g},${c.b},0.50)` : `rgba(${c.r},${c.g},${c.b},0.28)`
        } else {
          fill = isActive ? 'rgba(0,0,0,0.08)' : 'rgba(0,0,0,0.03)'
        }
      } else {
        const { r, g, b } = hexToRgb(BA_COLORS[baId] ?? '#333333')
        fill = isActive ? `rgba(${r},${g},${b},0.22)` : `rgba(${r},${g},${b},0.1)`
      }
      d3.select(this).transition().duration(120).attr('fill', fill)
    })

    svg.selectAll<SVGCircleElement, (typeof BA_DEFS)[number]>('circle.ba-ring')
      .transition().duration(120)
      .attr('r', ([id]) => id === activeBA ? 17/k : id === selected ? 12/k : 10/k)
      .style('opacity', ([id]) => id === activeBA ? 0.65 : id === selected ? 0.30 : 0)

    svg.selectAll<SVGCircleElement, (typeof BA_DEFS)[number]>('circle.ba-dot')
      .transition().duration(120)
      .attr('r',            ([id]) => (id === activeBA ? 8 : id === selected ? 6 : 5) / k)
      .attr('stroke-width', ([id]) => (id === activeBA ? 2 : 1.2) / k)
      .attr('fill', ([id]) => {
        const { r, g, b } = hexToRgb(BA_COLORS[id] ?? '#333')
        return id === activeBA ? `rgba(${r},${g},${b},1)` : `rgba(${r},${g},${b},0.85)`
      })

    svg.selectAll<SVGTextElement, (typeof BA_DEFS)[number]>('text.ba-label')
      .transition().duration(120)
      .attr('font-size',      ([id]) => (id === activeBA ? 11 : 7) / k)
      .attr('font-weight',    ([id]) => id === activeBA ? '600' : '500')
      .attr('letter-spacing', ([id]) => id === activeBA ? '0.14em' : '0.1em')
      .attr('y', ([id]) => { const p = pos.get(id); return p ? p[1] - (id === activeBA ? 18 : 10) / k : 0 })
      .attr('fill', ([id]) => {
        if (id === activeBA) { const { r, g, b } = hexToRgb(BA_COLORS[id] ?? '#333'); return `rgba(${r},${g},${b},1)` }
        return id === selected ? 'rgba(0,0,0,0.6)' : 'rgba(0,0,0,0.45)'
      })

    svg.selectAll<SVGTextElement, (typeof BA_DEFS)[number]>('text.ba-name')
      .transition().duration(120)
      .attr('font-size', ([id]) => (id === activeBA ? 7 : 5.5) / k)
      .attr('y', ([id]) => { const p = pos.get(id); return p ? p[1] + 16/k : 0 })
      .attr('fill', ([id]) => {
        if (id === activeBA) { const { r, g, b } = hexToRgb(BA_COLORS[id] ?? '#333'); return `rgba(${r},${g},${b},0.7)` }
        return 'rgba(0,0,0,0.18)'
      })
  }, []) // stable — all reads are from refs

  useEffect(() => {
    const svgEl = svgRef.current!, canvasEl = canvasRef.current!
    const W = window.innerWidth, H = window.innerHeight
    const svg = d3.select(svgEl).attr('width', W).attr('height', H)
    canvasEl.width = W; canvasEl.height = H
    const ctx = canvasEl.getContext('2d')!

    const proj = d3.geoAlbersUsa().scale(1200).translate([W / 2, H / 2])
    const path = d3.geoPath().projection(proj)
    const pos  = S.current.pos

    const scene = svg.append('g')
    svg.call(
      d3.zoom<SVGSVGElement, unknown>()
        .scaleExtent([0.5, 12])
        .on('zoom', e => {
          S.current.transform = e.transform
          scene.attr('transform', e.transform.toString())
          const k = e.transform.k
          // Keep visual sizes constant — divide SVG attributes by zoom scale
          scene.selectAll<SVGCircleElement, unknown>('circle.ba-dot')
            .attr('r', 5 / k).attr('stroke-width', 1.2 / k)
          scene.selectAll<SVGCircleElement, unknown>('circle.ba-hit')
            .attr('r', 18 / k)
          scene.selectAll<SVGTextElement, (typeof BA_DEFS)[number]>('text.ba-label')
            .attr('font-size', 7 / k)
            .attr('y', ([id]) => { const p = pos.get(id); return p ? p[1] - 10 / k : 0 })
          scene.selectAll<SVGTextElement, (typeof BA_DEFS)[number]>('text.ba-name')
            .attr('font-size', 5.5 / k)
            .attr('y', ([id]) => { const p = pos.get(id); return p ? p[1] + 16 / k : 0 })
          const el = document.getElementById('stat-zoom')
          if (el) el.textContent = e.transform.k.toFixed(1) + '\u00d7'
        })
    ).on('dblclick.zoom', null)
    svg.on('click', () => onBASelect(null))

    fetch('/us-states.json').then(r => r.json()).then((us: any) => {

      // Continental US land mass (no AK/HI)
      const continental = topojson.merge(
        us, us.objects.states.geometries.filter((g: any) => g.id !== '02' && g.id !== '15')
      ) as any
      scene.append('path')
        .datum(continental)
        .attr('d', path as any)
        .attr('fill', 'rgba(0,0,0,0.04)')
        .attr('stroke', 'none')
        .attr('pointer-events', 'none')

      // Clip mask — continental US only
      const defs = scene.append('defs')
      defs.append('clipPath').attr('id', 'us-clip')
        .append('path').datum(continental).attr('d', path as any)

      // State borders — interior only, very subtle
      scene.append('path')
        .datum(topojson.mesh(us, us.objects.states,
          (a: any, b: any) => a !== b && a.id !== '02' && b.id !== '02' && a.id !== '15' && b.id !== '15'
        ) as any)
        .attr('d', path as any)
        .attr('fill', 'none')
        .attr('stroke', 'rgba(0,0,0,0.07)')
        .attr('stroke-width', 0.5)
        .attr('pointer-events', 'none')

      // Project primary BA positions
      for (const [id, , lonlat] of BA_DEFS) {
        const p = proj(lonlat)
        if (p) pos.set(id, p as [number, number])
      }

      // Project generation facility positions (carries nameplate capacity MW)
      const plantSources: [string, [string, number, number, number][]][] = [
        ['nuclear', NUCLEAR_PLANTS],
        ['hydro',   HYDRO_PLANTS],
        ['wind',    WIND_FARMS],
        ['solar',   SOLAR_FARMS],
        ['gas',     GAS_PLANTS],
        ['coal',    COAL_PLANTS],
      ]
      for (const [fuel, list] of plantSources) {
        const pts = S.current.plantPts[fuel as keyof typeof S.current.plantPts]
        for (const [, lon, lat, cap] of list) {
          const p = proj([lon, lat])
          if (p) pts.push([p[0], p[1], cap] as [number, number, number])
        }
      }

      // If data already arrived before the map loaded, build arcs now
      const d = dataRef.current
      if (d) {
        const maxMW = d3.max(d.links, l => Math.abs(l.value)) ?? 1
        S.current.arcData = d.links.flatMap(l => {
          const src = pos.get(l.source), tgt = pos.get(l.target)
          if (!src || !tgt) return []
          return [{ src, cp: controlPoint(src, tgt), tgt, norm: Math.abs(l.value) / maxMW, fwd: l.value > 0, srcId: l.source, tgtId: l.target }]
        })
      }

      const baWithPos = BA_DEFS.filter(([id]) => pos.has(id))

      // Build multi-seed list: primary + extra seeds for large BAs
      const seeds: Array<{ id: string; pt: [number, number] }> = [
        ...baWithPos.map(([id]) => ({ id, pt: pos.get(id)! })),
      ]
      for (const [id, lonlat] of EXTRA_SEEDS) {
        const p = proj(lonlat)
        if (p) seeds.push({ id, pt: p as [number, number] })
      }

      // Voronoi from all seeds, clipped to US land
      const voronoi = d3.Delaunay
        .from(seeds.map(s => s.pt))
        .voronoi([0, 0, W, H])

      const baGroup = scene.append('g').attr('clip-path', 'url(#us-clip)')
      baGroup.selectAll<SVGPathElement, typeof seeds[number]>('path.ba-fill')
        .data(seeds, s => `${s.id}-${s.pt}`)
        .join('path')
        .attr('class', 'ba-fill')
        .attr('data-ba', s => s.id)
        .attr('d', (_, i) => voronoi.renderCell(i))
        .attr('fill', s => {
          const { r, g, b } = hexToRgb(BA_COLORS[s.id] ?? '#333')
          return `rgba(${r},${g},${b},0.1)`
        })
        .attr('stroke', 'none')
        .attr('pointer-events', 'none')

      // Rings — hidden until hover
      scene.selectAll<SVGCircleElement, (typeof BA_DEFS)[number]>('circle.ba-ring')
        .data(baWithPos, ([id]) => id).join('circle')
        .attr('class', 'ba-ring')
        .attr('cx', ([id]) => pos.get(id)![0]).attr('cy', ([id]) => pos.get(id)![1])
        .attr('r', 10).attr('fill', 'none')
        .attr('stroke', ([id]) => { const { r, g, b } = hexToRgb(BA_COLORS[id] ?? '#333'); return `rgba(${r},${g},${b},0.5)` })
        .attr('stroke-width', 0.8).style('opacity', 0).attr('pointer-events', 'none')

      // Core dots
      scene.selectAll<SVGCircleElement, (typeof BA_DEFS)[number]>('circle.ba-dot')
        .data(baWithPos, ([id]) => id).join('circle')
        .attr('class', 'ba-dot')
        .attr('cx', ([id]) => pos.get(id)![0]).attr('cy', ([id]) => pos.get(id)![1])
        .attr('r', 5)
        .attr('fill', ([id]) => { const { r, g, b } = hexToRgb(BA_COLORS[id] ?? '#333'); return `rgba(${r},${g},${b},0.85)` })
        .attr('stroke', 'rgba(255,255,255,0.9)').attr('stroke-width', 1.2)
        .attr('pointer-events', 'none')

      // Hit circles
      scene.selectAll<SVGCircleElement, (typeof BA_DEFS)[number]>('circle.ba-hit')
        .data(baWithPos, ([id]) => id).join('circle')
        .attr('class', 'ba-hit')
        .attr('cx', ([id]) => pos.get(id)![0]).attr('cy', ([id]) => pos.get(id)![1])
        .attr('r', 18).attr('fill', 'transparent').attr('pointer-events', 'all')
        .style('cursor', 'pointer')
        .on('mouseover', (_e, [id]) => { hoveredBARef.current = id;   applyHoverVisuals(); onBAHover(id) })
        .on('mouseout',  ()         => { hoveredBARef.current = null; applyHoverVisuals(); onBAHover(null) })
        .on('click', (e, [id]) => { e.stopPropagation(); onBASelect(id) })

      // BA abbreviation label (always visible)
      scene.selectAll<SVGTextElement, (typeof BA_DEFS)[number]>('text.ba-label')
        .data(baWithPos, ([id]) => id).join('text')
        .attr('class', 'ba-label')
        .attr('x', ([id]) => pos.get(id)![0])
        .attr('y', ([id]) => pos.get(id)![1] - 10)
        .attr('text-anchor', 'middle')
        .attr('font-size', 7).attr('font-weight', '500')
        .attr('font-family', 'IBM Plex Mono, monospace')
        .attr('letter-spacing', '0.1em')
        .attr('fill', 'rgba(0,0,0,0.45)')
        .attr('pointer-events', 'none')
        .text(([id]) => id)

      // Full BA name (shown below dot, very subtle)
      scene.selectAll<SVGTextElement, (typeof BA_DEFS)[number]>('text.ba-name')
        .data(baWithPos, ([id]) => id).join('text')
        .attr('class', 'ba-name')
        .attr('x', ([id]) => pos.get(id)![0])
        .attr('y', ([id]) => pos.get(id)![1] + 16)
        .attr('text-anchor', 'middle')
        .attr('font-size', 5.5).attr('font-weight', '400')
        .attr('font-family', 'IBM Plex Mono, monospace')
        .attr('letter-spacing', '0.06em')
        .attr('fill', 'rgba(0,0,0,0.18)')
        .attr('pointer-events', 'none')
        .text(([, name]) => name)
    })

    // ── Render loop ───────────────────────────────────────────────────────
    function frame() {
      const { transform: T, arcData, particles, plantPts, mode: m,
              layerArcs, layerParticles, layerNuclear, layerHydro, layerWind, layerSolar,
              layerGas, layerCoal, genMap, carbonMap, pos } = S.current
      ctx.setTransform(T.k, 0, 0, T.k, T.x, T.y)
      ctx.clearRect(-T.x / T.k, -T.y / T.k, W / T.k, H / T.k)

      // ── Flow mode ────────────────────────────────────────────────────
      if (m === 'flow' && arcData.length > 0) {
        if (layerArcs) {
          ctx.lineCap = 'round'
          for (const arc of arcData) {
            const { src, cp, tgt, norm, fwd, srcId, tgtId } = arc
            const srcColor = hexToRgb(BA_COLORS[srcId] ?? (fwd ? '#2563eb' : '#ea580c'))
            const tgtColor = hexToRgb(BA_COLORS[tgtId] ?? (fwd ? '#2563eb' : '#ea580c'))

            // Gradient along arc midpoint
            const mid = bezierPt(0.5, src, cp, tgt)
            const grad = ctx.createLinearGradient(src[0], src[1], tgt[0], tgt[1])
            grad.addColorStop(0,   `rgba(${srcColor.r},${srcColor.g},${srcColor.b},${0.15 + norm * 0.25})`)
            grad.addColorStop(0.5, `rgba(${mid[0] > 0 ? srcColor.r : tgtColor.r},${srcColor.g},${srcColor.b},${0.25 + norm * 0.35})`)
            grad.addColorStop(1,   `rgba(${tgtColor.r},${tgtColor.g},${tgtColor.b},${0.15 + norm * 0.25})`)

            // Wide glow
            ctx.beginPath(); ctx.moveTo(src[0], src[1]); ctx.quadraticCurveTo(cp[0], cp[1], tgt[0], tgt[1])
            ctx.strokeStyle = `rgba(${srcColor.r},${srcColor.g},${srcColor.b},${0.03 + norm * 0.05})`
            ctx.lineWidth = (8 + norm * 12) / T.k; ctx.stroke()

            // Core line with gradient
            ctx.beginPath(); ctx.moveTo(src[0], src[1]); ctx.quadraticCurveTo(cp[0], cp[1], tgt[0], tgt[1])
            ctx.strokeStyle = grad
            ctx.lineWidth = (0.8 + norm * 1.5) / T.k
            ctx.shadowColor = `rgba(${srcColor.r},${srcColor.g},${srcColor.b},0.4)`
            ctx.shadowBlur  = (4 + norm * 8) / T.k
            ctx.stroke(); ctx.shadowBlur = 0
          }
        }

        if (layerParticles) {
          for (const arc of arcData) {
            if (Math.random() < 0.05 + arc.norm * 0.12) particles.push({
              ...arc,
              t:     arc.fwd ? 0 : 1,
              speed: (0.004 + arc.norm * 0.01) * (arc.fwd ? 1 : -1),
            })
          }
          S.current.particles = particles.filter(p => { p.t += p.speed; return p.t >= 0 && p.t <= 1 })
          if (S.current.particles.length > 1500) S.current.particles.splice(0, S.current.particles.length - 1500)

          for (const p of S.current.particles) {
            const [x, y] = bezierPt(p.t, p.src, p.cp, p.tgt)
            const c = hexToRgb(BA_COLORS[p.fwd ? p.srcId : p.tgtId] ?? '#2563eb')
            const pr = (1.2 + p.norm * 0.8) / T.k
            ctx.beginPath(); ctx.arc(x, y, pr, 0, Math.PI * 2)
            ctx.fillStyle   = `rgba(${c.r},${c.g},${c.b},${0.6 + p.norm * 0.35})`
            ctx.shadowColor = `rgba(${c.r},${c.g},${c.b},0.7)`
            ctx.shadowBlur  = (4 + p.norm * 6) / T.k
            ctx.fill(); ctx.shadowBlur = 0
          }
        }
      }

      // ── Generation mode — fuel-mix donut rings ───────────────────────
      if (m === 'generation' && genMap.size > 0) {
        let maxMw = 0
        for (const [, d] of genMap) if (d.totalMw > maxMw) maxMw = d.totalMw

        for (const [baId, gd] of genMap) {
          const p = pos.get(baId)
          if (!p) continue
          const norm      = Math.sqrt(gd.totalMw / Math.max(maxMw, 1))
          const outerR    = (10 + norm * 32) / T.k
          const innerR    = outerR * 0.58
          const ringWidth = outerR - innerR

          // Soft bloom behind ring
          const bloom = ctx.createRadialGradient(p[0], p[1], innerR, p[0], p[1], outerR * 2)
          const dc = hexToRgb(FUEL_COLORS[gd.dominantFuel] ?? '#6b7280')
          bloom.addColorStop(0,   `rgba(${dc.r},${dc.g},${dc.b},0.12)`)
          bloom.addColorStop(1,   `rgba(${dc.r},${dc.g},${dc.b},0)`)
          ctx.beginPath(); ctx.arc(p[0], p[1], outerR * 2, 0, Math.PI * 2)
          ctx.fillStyle = bloom; ctx.fill()

          // Fuel-mix donut ring
          let angle = -Math.PI / 2
          const gap  = 0.03
          for (const { fuel, mw } of gd.fuels) {
            if (mw <= 0) continue
            const sweep = (mw / gd.totalMw) * Math.PI * 2 - gap
            if (sweep <= 0) continue
            const fc = hexToRgb(FUEL_COLORS[fuel] ?? '#6b7280')
            ctx.beginPath()
            ctx.arc(p[0], p[1], outerR, angle, angle + sweep)
            ctx.arc(p[0], p[1], innerR, angle + sweep, angle, true)
            ctx.closePath()
            ctx.fillStyle   = `rgba(${fc.r},${fc.g},${fc.b},0.82)`
            ctx.shadowColor = `rgba(${fc.r},${fc.g},${fc.b},0.4)`
            ctx.shadowBlur  = ringWidth * T.k * 0.6
            ctx.fill(); ctx.shadowBlur = 0
            angle += sweep + gap
          }

          // White center cap
          ctx.beginPath(); ctx.arc(p[0], p[1], innerR * 0.85, 0, Math.PI * 2)
          ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.fill()
        }
      }

      // Ghost rings for BAs with a position but no generation data reported
      if (m === 'generation') {
        for (const [baId, p] of pos) {
          if (genMap.has(baId)) continue
          ctx.beginPath()
          ctx.arc(p[0], p[1], 7 / T.k, 0, Math.PI * 2)
          ctx.strokeStyle = 'rgba(107,114,128,0.25)'
          ctx.lineWidth   = 0.8 / T.k
          ctx.stroke()
        }
      }

      // ── Carbon mode — intensity dots ─────────────────────────────────────
      if (m === 'carbon' && carbonMap.size > 0) {
        for (const [baId, intensity] of carbonMap) {
          const p = pos.get(baId)
          if (!p) continue
          const color = carbonColor(intensity)
          // Parse rgb string from d3 color
          const c = d3.color(color)!.rgb()
          const r = 14 / T.k
          const grd = ctx.createRadialGradient(p[0], p[1], 0, p[0], p[1], r * 2.5)
          grd.addColorStop(0, `rgba(${c.r},${c.g},${c.b},0.55)`)
          grd.addColorStop(1, `rgba(${c.r},${c.g},${c.b},0)`)
          ctx.beginPath(); ctx.arc(p[0], p[1], r * 2.5, 0, Math.PI * 2)
          ctx.fillStyle = grd; ctx.fill()
          ctx.beginPath(); ctx.arc(p[0], p[1], r, 0, Math.PI * 2)
          ctx.fillStyle = `rgba(${c.r},${c.g},${c.b},0.88)`
          ctx.shadowColor = `rgba(${c.r},${c.g},${c.b},0.5)`
          ctx.shadowBlur = r * 4
          ctx.fill(); ctx.shadowBlur = 0
          // Intensity label
          ctx.fillStyle = 'rgba(255,255,255,0.9)'
          ctx.font = `bold ${Math.round(5 / T.k)}px IBM Plex Mono, monospace`
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
          ctx.fillText(Math.round(intensity).toString(), p[0], p[1])
        }
      }

      // ── Generation facility layers — dot size ∝ √(nameplate MW) ────────
      function capR(cap: number, maxCap: number, minPx: number, maxPx: number) {
        return (minPx + Math.sqrt(cap / maxCap) * (maxPx - minPx)) / T.k
      }

      // nuclear — purple cross + dot
      if (layerNuclear && plantPts.nuclear.length > 0) {
        const maxCap = Math.max(...plantPts.nuclear.map(p => p[2]))
        ctx.lineWidth = 0.8 / T.k
        for (const [x, y, cap] of plantPts.nuclear) {
          const r = capR(cap, maxCap, 1.5, 5.5)
          const halo = ctx.createRadialGradient(x, y, 0, x, y, r * 5)
          halo.addColorStop(0, 'rgba(139,92,246,0.2)'); halo.addColorStop(1, 'rgba(139,92,246,0)')
          ctx.beginPath(); ctx.arc(x, y, r * 5, 0, Math.PI * 2); ctx.fillStyle = halo; ctx.fill()
          ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2)
          ctx.fillStyle = 'rgba(139,92,246,0.9)'
          ctx.shadowColor = 'rgba(139,92,246,0.6)'; ctx.shadowBlur = r * 3
          ctx.fill(); ctx.shadowBlur = 0
          const arm = r * 2.2
          ctx.strokeStyle = 'rgba(139,92,246,0.4)'
          ctx.beginPath()
          ctx.moveTo(x - arm, y); ctx.lineTo(x + arm, y)
          ctx.moveTo(x, y - arm); ctx.lineTo(x, y + arm)
          ctx.stroke()
        }
      }

      // hydro — blue diamond, Grand Coulee visibly largest
      if (layerHydro && plantPts.hydro.length > 0) {
        const maxCap = Math.max(...plantPts.hydro.map(p => p[2]))
        for (const [x, y, cap] of plantPts.hydro) {
          const r = capR(cap, maxCap, 1.2, 6.0)
          const halo = ctx.createRadialGradient(x, y, 0, x, y, r * 5)
          halo.addColorStop(0, 'rgba(37,99,235,0.18)'); halo.addColorStop(1, 'rgba(37,99,235,0)')
          ctx.beginPath(); ctx.arc(x, y, r * 5, 0, Math.PI * 2); ctx.fillStyle = halo; ctx.fill()
          const d = r * 1.5
          ctx.beginPath()
          ctx.moveTo(x, y - d); ctx.lineTo(x + d, y); ctx.lineTo(x, y + d); ctx.lineTo(x - d, y)
          ctx.closePath()
          ctx.fillStyle = 'rgba(37,99,235,0.85)'
          ctx.shadowColor = 'rgba(37,99,235,0.5)'; ctx.shadowBlur = r * 3
          ctx.fill(); ctx.shadowBlur = 0
        }
      }

      // wind — teal triangle
      if (layerWind && plantPts.wind.length > 0) {
        const maxCap = Math.max(...plantPts.wind.map(p => p[2]))
        for (const [x, y, cap] of plantPts.wind) {
          const r = capR(cap, maxCap, 1.2, 5.0)
          const halo = ctx.createRadialGradient(x, y, 0, x, y, r * 5)
          halo.addColorStop(0, 'rgba(8,145,178,0.16)'); halo.addColorStop(1, 'rgba(8,145,178,0)')
          ctx.beginPath(); ctx.arc(x, y, r * 5, 0, Math.PI * 2); ctx.fillStyle = halo; ctx.fill()
          ctx.beginPath()
          ctx.moveTo(x, y - r * 1.6)
          ctx.lineTo(x + r * 1.4, y + r * 0.9)
          ctx.lineTo(x - r * 1.4, y + r * 0.9)
          ctx.closePath()
          ctx.fillStyle = 'rgba(8,145,178,0.85)'
          ctx.shadowColor = 'rgba(8,145,178,0.5)'; ctx.shadowBlur = r * 3
          ctx.fill(); ctx.shadowBlur = 0
        }
      }

      // solar — amber circle with rays
      if (layerSolar && plantPts.solar.length > 0) {
        const maxCap = Math.max(...plantPts.solar.map(p => p[2]))
        ctx.lineWidth = 0.7 / T.k
        for (const [x, y, cap] of plantPts.solar) {
          const r = capR(cap, maxCap, 1.2, 5.0)
          const halo = ctx.createRadialGradient(x, y, 0, x, y, r * 5)
          halo.addColorStop(0, 'rgba(217,119,6,0.2)'); halo.addColorStop(1, 'rgba(217,119,6,0)')
          ctx.beginPath(); ctx.arc(x, y, r * 5, 0, Math.PI * 2); ctx.fillStyle = halo; ctx.fill()
          ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2)
          ctx.fillStyle = 'rgba(217,119,6,0.9)'
          ctx.shadowColor = 'rgba(217,119,6,0.5)'; ctx.shadowBlur = r * 3
          ctx.fill(); ctx.shadowBlur = 0
          ctx.strokeStyle = 'rgba(217,119,6,0.38)'
          const rayLen = r * 1.8
          for (let i = 0; i < 8; i++) {
            const a = (i / 8) * Math.PI * 2
            const inner = r * 1.35, outer = inner + rayLen
            ctx.beginPath()
            ctx.moveTo(x + Math.cos(a) * inner, y + Math.sin(a) * inner)
            ctx.lineTo(x + Math.cos(a) * outer, y + Math.sin(a) * outer)
            ctx.stroke()
          }
        }
      }

      // gas — orange square (industrial)
      if (layerGas && plantPts.gas.length > 0) {
        const maxCap = Math.max(...plantPts.gas.map(p => p[2]))
        for (const [x, y, cap] of plantPts.gas) {
          const r = capR(cap, maxCap, 1.2, 5.0)
          const halo = ctx.createRadialGradient(x, y, 0, x, y, r * 5)
          halo.addColorStop(0, 'rgba(234,88,12,0.18)'); halo.addColorStop(1, 'rgba(234,88,12,0)')
          ctx.beginPath(); ctx.arc(x, y, r * 5, 0, Math.PI * 2); ctx.fillStyle = halo; ctx.fill()
          const s = r * 1.3
          ctx.beginPath()
          ctx.rect(x - s, y - s, s * 2, s * 2)
          ctx.fillStyle = 'rgba(234,88,12,0.85)'
          ctx.shadowColor = 'rgba(234,88,12,0.5)'; ctx.shadowBlur = r * 3
          ctx.fill(); ctx.shadowBlur = 0
        }
      }

      // coal — dark red pentagon
      if (layerCoal && plantPts.coal.length > 0) {
        const maxCap = Math.max(...plantPts.coal.map(p => p[2]))
        for (const [x, y, cap] of plantPts.coal) {
          const r = capR(cap, maxCap, 1.2, 5.5)
          const halo = ctx.createRadialGradient(x, y, 0, x, y, r * 5)
          halo.addColorStop(0, 'rgba(220,38,38,0.16)'); halo.addColorStop(1, 'rgba(220,38,38,0)')
          ctx.beginPath(); ctx.arc(x, y, r * 5, 0, Math.PI * 2); ctx.fillStyle = halo; ctx.fill()
          ctx.beginPath()
          for (let i = 0; i < 5; i++) {
            const a = (i / 5) * Math.PI * 2 - Math.PI / 2
            const px = x + r * 1.5 * Math.cos(a), py = y + r * 1.5 * Math.sin(a)
            i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py)
          }
          ctx.closePath()
          ctx.fillStyle = 'rgba(220,38,38,0.85)'
          ctx.shadowColor = 'rgba(220,38,38,0.5)'; ctx.shadowBlur = r * 3
          ctx.fill(); ctx.shadowBlur = 0
        }
      }

      S.current.raf = requestAnimationFrame(frame)
    }
    S.current.raf = requestAnimationFrame(frame)

    return () => {
      cancelAnimationFrame(S.current.raf)
      svg.selectAll('*').remove(); svg.on('.zoom', null)
      S.current.pos.clear(); S.current.arcData = []; S.current.particles = []
      S.current.plantPts = { nuclear: [] as [number,number,number][], hydro: [] as [number,number,number][], wind: [] as [number,number,number][], solar: [] as [number,number,number][], gas: [] as [number,number,number][], coal: [] as [number,number,number][] }
    }
  }, []) // eslint-disable-line

  // Sync selectedBA ref and re-apply visuals when selection changes
  useEffect(() => {
    selectedBARef.current = selectedBA
    applyHoverVisuals()
  }, [selectedBA, applyHoverVisuals])

  // Sync mode/carbon refs and re-apply when mode or carbon data changes
  useEffect(() => {
    modeRef.current      = mode
    carbonDataRef.current = carbonData
    applyHoverVisuals()
  }, [mode, carbonData, applyHoverVisuals])

  // ── Rebuild arcs on new data ──────────────────────────────────────────
  useEffect(() => {
    dataRef.current = data
    if (!data) return
    const pos = S.current.pos
    if (!pos.size) return  // pos not ready yet — map setup will build arcs on load
    const maxMW = d3.max(data.links, d => Math.abs(d.value)) ?? 1
    S.current.particles = []
    S.current.arcData   = data.links.flatMap(l => {
      const src = pos.get(l.source), tgt = pos.get(l.target)
      if (!src || !tgt) return []
      return [{ src, cp: controlPoint(src, tgt), tgt, norm: Math.abs(l.value) / maxMW, fwd: l.value > 0, srcId: l.source, tgtId: l.target }]
    })
  }, [data])

  useEffect(() => {
    S.current.mode           = mode
    S.current.layerArcs      = layers.has('arcs')
    S.current.layerParticles = layers.has('particles')
    S.current.layerNuclear   = layers.has('nuclear')
    S.current.layerHydro     = layers.has('hydro')
    S.current.layerWind      = layers.has('wind')
    S.current.layerSolar     = layers.has('solar')
    S.current.layerGas       = layers.has('gas')
    S.current.layerCoal      = layers.has('coal')
    if (mode !== 'flow') S.current.particles = []
  }, [mode, layers])

  useEffect(() => {
    const m = new Map<string, BaGenData>()
    if (genData) genData.forEach(d => m.set(d.ba, d))
    S.current.genMap = m
  }, [genData])

  useEffect(() => {
    const m = new Map<string, number>()
    if (carbonData) carbonData.forEach(d => m.set(d.ba, d.intensity))
    S.current.carbonMap = m
  }, [carbonData])

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <svg    ref={svgRef}    style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />
      <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} />

      {/* Carbon legend */}
      {mode === 'carbon' && (
        <div style={{
          position: 'fixed', bottom: 120, left: 20, zIndex: 20,
          background: 'rgba(255,255,255,0.88)',
          backdropFilter: 'blur(14px)',
          WebkitBackdropFilter: 'blur(14px)',
          border: '1px solid rgba(0,0,0,0.08)',
          borderRadius: 10, padding: '10px 14px',
          boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
          minWidth: 140,
        }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'rgba(0,0,0,0.4)', marginBottom: 8 }}>
            Carbon Intensity
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{
              width: 100, height: 10, borderRadius: 5,
              background: 'linear-gradient(to right, #1a9641, #ffffbf, #d7191c)',
            }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--font-mono)', fontSize: 7, color: 'rgba(0,0,0,0.35)', marginTop: 4 }}>
            <span>Clean</span>
            <span>Dirty</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--font-mono)', fontSize: 7, color: 'rgba(0,0,0,0.25)', marginTop: 2 }}>
            <span>0</span>
            <span>800 g/kWh</span>
          </div>
        </div>
      )}
    </div>
  )
}
