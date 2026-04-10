import { useEffect, useRef } from 'react'
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
  return [
    mt * mt * p0[0] + 2 * mt * t * cp[0] + t * t * p1[0],
    mt * mt * p0[1] + 2 * mt * t * cp[1] + t * t * p1[1],
  ]
}

interface Arc {
  src: [number, number]; cp: [number, number]; tgt: [number, number]
  norm: number; fwd: boolean; srcId: string; tgtId: string
}
interface Particle extends Arc { t: number; speed: number }

const carbonColor = d3.scaleSequential(d3.interpolateRdYlGn).domain([800, 0])

interface Props {
  data:       GridData | null
  onBAHover:  (id: string | null) => void
  selectedBA: string | null
  onBASelect: (id: string | null) => void
  mode:       Mode
  layers:     Set<LayerKey>
  genData:    BaGenData[] | null
  carbonData: BaCarbonData[] | null
}

export function GridMap({ data, onBAHover, selectedBA, onBASelect, mode, layers, genData, carbonData }: Props) {
  const canvasRef     = useRef<HTMLCanvasElement>(null)
  const onBAHoverRef  = useRef(onBAHover)
  const onBASelectRef = useRef(onBASelect)
  const dataRef       = useRef<typeof data>(null)

  // Always-current callback refs — updated inline so event handlers never stale-close
  onBAHoverRef.current  = onBAHover
  onBASelectRef.current = onBASelect

  const S = useRef({
    transform:      d3.zoomIdentity as d3.ZoomTransform,
    // Geo (pre-computed, rebuilt on resize)
    W:              window.innerWidth,
    H:              window.innerHeight,
    usGeo:          null as any,
    geoReady:       false,
    continentalP2d: null as Path2D | null,
    stateMeshP2d:   null as Path2D | null,
    voronoiCells:   [] as { id: string; path2d: Path2D }[],
    baList:         [] as { id: string; name: string; pt: [number, number] }[],
    pos:            new Map<string, [number, number]>(),
    plantPts: {
      nuclear: [] as [number, number, number][],
      hydro:   [] as [number, number, number][],
      wind:    [] as [number, number, number][],
      solar:   [] as [number, number, number][],
      gas:     [] as [number, number, number][],
      coal:    [] as [number, number, number][],
    },
    // Dynamic
    arcData:    [] as Arc[],
    particles:  [] as Particle[],
    hoverT:     new Map<string, number>(), // per-BA lerp progress 0..1
    raf:        0,
    hoveredBA:  null as string | null,
    selectedBA: null as string | null,
    mode:           'flow' as Mode,
    layerArcs:      true,
    layerParticles: true,
    layerNuclear:   true,
    layerHydro:     true,
    layerWind:      true,
    layerSolar:     true,
    layerGas:       true,
    layerCoal:      true,
    genMap:     new Map<string, BaGenData>(),
    carbonMap:  new Map<string, number>(),
  })

  useEffect(() => {
    const canvas = canvasRef.current!
    const ctx = canvas.getContext('2d')!

    // ── Size canvas to physical pixels ───────────────────────────────────
    function resizeCanvas() {
      const dpr = window.devicePixelRatio || 1
      const W   = window.innerWidth
      const H   = window.innerHeight
      canvas.width  = W * dpr
      canvas.height = H * dpr
      ctx.scale(dpr, dpr)
      S.current.W = W
      S.current.H = H
    }
    resizeCanvas()

    // ── Build all geo Path2D objects from stored TopoJSON ────────────────
    function rebuildGeo(us: any) {
      const { W, H } = S.current
      const proj    = d3.geoAlbersUsa().scale(1200).translate([W / 2, H / 2])
      const pathStr = d3.geoPath().projection(proj)

      const continental = topojson.merge(
        us, us.objects.states.geometries.filter((g: any) => g.id !== '02' && g.id !== '15')
      ) as any
      const stateMesh = topojson.mesh(
        us, us.objects.states,
        (a: any, b: any) => a !== b && a.id !== '02' && b.id !== '02' && a.id !== '15' && b.id !== '15'
      ) as any

      const contStr = pathStr(continental)
      S.current.continentalP2d = contStr ? new Path2D(contStr) : null
      const meshStr = pathStr(stateMesh)
      S.current.stateMeshP2d = meshStr ? new Path2D(meshStr) : null

      const pos = new Map<string, [number, number]>()
      for (const [id, , lonlat] of BA_DEFS) {
        const p = proj(lonlat as [number, number])
        if (p) pos.set(id, p as [number, number])
      }
      S.current.pos = pos

      S.current.baList = BA_DEFS.flatMap(([id, name]) => {
        const pt = pos.get(id); return pt ? [{ id, name, pt }] : []
      })

      const seeds: { id: string; pt: [number, number] }[] = [
        ...S.current.baList.map(b => ({ id: b.id, pt: b.pt })),
      ]
      for (const [id, lonlat] of EXTRA_SEEDS) {
        const p = proj(lonlat as [number, number])
        if (p) seeds.push({ id, pt: p as [number, number] })
      }
      const voronoi = d3.Delaunay.from(seeds.map(s => s.pt)).voronoi([0, 0, W, H])
      S.current.voronoiCells = seeds.map((s, i) => ({
        id: s.id, path2d: new Path2D(voronoi.renderCell(i)),
      }))

      S.current.plantPts = { nuclear: [], hydro: [], wind: [], solar: [], gas: [], coal: [] }
      const plantSources: [keyof typeof S.current.plantPts, [string, number, number, number][]][] = [
        ['nuclear', NUCLEAR_PLANTS], ['hydro', HYDRO_PLANTS],
        ['wind', WIND_FARMS],        ['solar', SOLAR_FARMS],
        ['gas', GAS_PLANTS],         ['coal', COAL_PLANTS],
      ]
      for (const [fuel, list] of plantSources) {
        for (const [, lon, lat, cap] of list) {
          const p = proj([lon, lat]); if (p) S.current.plantPts[fuel].push([p[0], p[1], cap])
        }
      }

      // Rebuild arcs with new positions
      const d = dataRef.current
      if (d) {
        const maxMW = d3.max(d.links, l => Math.abs(l.value)) ?? 1
        S.current.particles = []
        S.current.arcData = d.links.flatMap(l => {
          const src = pos.get(l.source), tgt = pos.get(l.target)
          if (!src || !tgt) return []
          return [{ src, cp: controlPoint(src, tgt), tgt, norm: Math.abs(l.value) / maxMW, fwd: l.value > 0, srcId: l.source, tgtId: l.target }]
        })
      }

      S.current.geoReady = true
    }

    // ── D3 zoom on canvas ────────────────────────────────────────────────
    d3.select(canvas)
      .call(
        d3.zoom<HTMLCanvasElement, unknown>()
          .scaleExtent([0.5, 12])
          .on('zoom', e => {
            S.current.transform = e.transform
            const el = document.getElementById('stat-zoom')
            if (el) el.textContent = e.transform.k.toFixed(1) + '\u00d7'
          })
      )
      .on('dblclick.zoom', null)

    // ── Hit test (18 px screen radius) ───────────────────────────────────
    function hitBA(ex: number, ey: number): string | null {
      const T = S.current.transform
      let best: string | null = null, bestD = Infinity
      for (const [id, [px, py]] of S.current.pos) {
        const sx = px * T.k + T.x, sy = py * T.k + T.y
        const d  = Math.hypot(sx - ex, sy - ey)
        if (d < 18 && d < bestD) { best = id; bestD = d }
      }
      return best
    }

    canvas.addEventListener('mousemove', e => {
      const hit = hitBA(e.offsetX, e.offsetY)
      canvas.style.cursor = hit ? 'pointer' : 'default'
      if (hit !== S.current.hoveredBA) {
        S.current.hoveredBA = hit
        onBAHoverRef.current(hit)
      }
    })
    canvas.addEventListener('mouseleave', () => {
      canvas.style.cursor = 'default'
      if (S.current.hoveredBA !== null) {
        S.current.hoveredBA = null
        onBAHoverRef.current(null)
      }
    })
    canvas.addEventListener('click', e => {
      onBASelectRef.current(hitBA(e.offsetX, e.offsetY))
    })

    // ── Debounced resize handler ─────────────────────────────────────────
    let resizeTimer = 0
    function handleResize() {
      resizeCanvas() // immediate — keeps canvas pixel-perfect during drag
      clearTimeout(resizeTimer)
      resizeTimer = window.setTimeout(() => {
        if (S.current.usGeo) rebuildGeo(S.current.usGeo)
      }, 120)
    }
    window.addEventListener('resize', handleResize)

    // ── Load geo → build Path2D objects ──────────────────────────────────
    fetch('/us-states.json').then(r => r.json()).then((us: any) => {
      S.current.usGeo = us
      rebuildGeo(us)
    })

    // ── RAF render loop ───────────────────────────────────────────────────
    function frame() {
      const ss = S.current
      const { transform: T, hoveredBA, selectedBA: selBA, mode: m,
              layerArcs, layerParticles, layerNuclear, layerHydro,
              layerWind, layerSolar, layerGas, layerCoal,
              genMap, carbonMap, arcData, particles, plantPts } = ss
      void (hoveredBA ?? selBA) // activeBA — reserved for future use

      // Advance per-BA hover lerp (smooth 6-frame transition)
      for (const { id } of ss.baList) {
        const target = id === hoveredBA ? 1 : id === selBA ? 0.55 : 0
        const cur    = ss.hoverT.get(id) ?? 0
        ss.hoverT.set(id, cur + (target - cur) * 0.2)
      }

      ctx.clearRect(0, 0, ss.W, ss.H)
      ctx.save()
      ctx.translate(T.x, T.y)
      ctx.scale(T.k, T.k)

      // ── Static geo ───────────────────────────────────────────────────────
      if (ss.geoReady && ss.continentalP2d) {
        ctx.fillStyle = 'rgba(0,0,0,0.04)'
        ctx.fill(ss.continentalP2d)

        // Voronoi BA fills clipped to continental US
        ctx.save()
        ctx.clip(ss.continentalP2d)
        for (const { id, path2d } of ss.voronoiCells) {
          const t = ss.hoverT.get(id) ?? 0
          if (m === 'carbon' && carbonMap.size > 0) {
            const intensity = carbonMap.get(id)
            if (intensity !== undefined) {
              const c = d3.color(carbonColor(intensity))!.rgb()
              ctx.fillStyle = `rgba(${c.r},${c.g},${c.b},${0.12 + t * 0.25})`
            } else {
              ctx.fillStyle = `rgba(0,0,0,${0.02 + t * 0.06})`
            }
          } else {
            const { r, g, b } = hexToRgb(BA_COLORS[id] ?? '#333')
            ctx.fillStyle = `rgba(${r},${g},${b},${0.1 + t * 0.12})`
          }
          ctx.fill(path2d)
        }
        ctx.restore()

        if (ss.stateMeshP2d) {
          ctx.strokeStyle = 'rgba(0,0,0,0.07)'
          ctx.lineWidth   = 0.5 / T.k
          ctx.stroke(ss.stateMeshP2d)
        }
      }

      // ── Flow arcs + particles ────────────────────────────────────────────
      if (m === 'flow' && arcData.length > 0) {
        if (layerArcs) {
          ctx.lineCap = 'round'
          for (const arc of arcData) {
            const { src, cp, tgt, norm, srcId, tgtId } = arc
            const sc = hexToRgb(BA_COLORS[srcId] ?? '#2563eb')
            const tc = hexToRgb(BA_COLORS[tgtId] ?? '#ea580c')
            const grad = ctx.createLinearGradient(src[0], src[1], tgt[0], tgt[1])
            grad.addColorStop(0,   `rgba(${sc.r},${sc.g},${sc.b},${0.15 + norm * 0.25})`)
            grad.addColorStop(0.5, `rgba(${sc.r},${sc.g},${sc.b},${0.25 + norm * 0.35})`)
            grad.addColorStop(1,   `rgba(${tc.r},${tc.g},${tc.b},${0.15 + norm * 0.25})`)
            ctx.beginPath(); ctx.moveTo(src[0], src[1]); ctx.quadraticCurveTo(cp[0], cp[1], tgt[0], tgt[1])
            ctx.strokeStyle = `rgba(${sc.r},${sc.g},${sc.b},${0.03 + norm * 0.05})`
            ctx.lineWidth   = (8 + norm * 12) / T.k; ctx.stroke()
            ctx.beginPath(); ctx.moveTo(src[0], src[1]); ctx.quadraticCurveTo(cp[0], cp[1], tgt[0], tgt[1])
            ctx.strokeStyle = grad; ctx.lineWidth = (0.8 + norm * 1.5) / T.k
            ctx.shadowColor = `rgba(${sc.r},${sc.g},${sc.b},0.4)`; ctx.shadowBlur = (4 + norm * 8) / T.k
            ctx.stroke(); ctx.shadowBlur = 0
          }
        }

        if (layerParticles) {
          for (const arc of arcData) {
            if (Math.random() < 0.05 + arc.norm * 0.12)
              particles.push({ ...arc, t: arc.fwd ? 0 : 1, speed: (0.004 + arc.norm * 0.01) * (arc.fwd ? 1 : -1) })
          }
          ss.particles = particles.filter(p => { p.t += p.speed; return p.t >= 0 && p.t <= 1 })
          if (ss.particles.length > 1500) ss.particles.splice(0, ss.particles.length - 1500)
          for (const p of ss.particles) {
            const [x, y] = bezierPt(p.t, p.src, p.cp, p.tgt)
            const c  = hexToRgb(BA_COLORS[p.fwd ? p.srcId : p.tgtId] ?? '#2563eb')
            const pr = (1.2 + p.norm * 0.8) / T.k
            ctx.beginPath(); ctx.arc(x, y, pr, 0, Math.PI * 2)
            ctx.fillStyle = `rgba(${c.r},${c.g},${c.b},${0.6 + p.norm * 0.35})`
            ctx.shadowColor = `rgba(${c.r},${c.g},${c.b},0.7)`; ctx.shadowBlur = (4 + p.norm * 6) / T.k
            ctx.fill(); ctx.shadowBlur = 0
          }
        }
      }

      // ── Generation mode — fuel-mix donut rings ────────────────────────
      if (m === 'generation' && genMap.size > 0) {
        let maxMw = 0
        for (const [, d] of genMap) if (d.totalMw > maxMw) maxMw = d.totalMw
        for (const [baId, gd] of genMap) {
          const p = ss.pos.get(baId); if (!p) continue
          const norm   = Math.sqrt(gd.totalMw / Math.max(maxMw, 1))
          const outerR = (10 + norm * 32) / T.k
          const innerR = outerR * 0.58
          const ringW  = outerR - innerR
          const dc     = hexToRgb(FUEL_COLORS[gd.dominantFuel] ?? '#6b7280')
          const bloom  = ctx.createRadialGradient(p[0], p[1], innerR, p[0], p[1], outerR * 2)
          bloom.addColorStop(0, `rgba(${dc.r},${dc.g},${dc.b},0.12)`)
          bloom.addColorStop(1, `rgba(${dc.r},${dc.g},${dc.b},0)`)
          ctx.beginPath(); ctx.arc(p[0], p[1], outerR * 2, 0, Math.PI * 2)
          ctx.fillStyle = bloom; ctx.fill()
          let angle = -Math.PI / 2
          for (const { fuel, mw } of gd.fuels) {
            if (mw <= 0) continue
            const sweep = (mw / gd.totalMw) * Math.PI * 2 - 0.03; if (sweep <= 0) continue
            const fc = hexToRgb(FUEL_COLORS[fuel] ?? '#6b7280')
            ctx.beginPath()
            ctx.arc(p[0], p[1], outerR, angle, angle + sweep)
            ctx.arc(p[0], p[1], innerR, angle + sweep, angle, true)
            ctx.closePath()
            ctx.fillStyle = `rgba(${fc.r},${fc.g},${fc.b},0.82)`
            ctx.shadowColor = `rgba(${fc.r},${fc.g},${fc.b},0.4)`; ctx.shadowBlur = ringW * T.k * 0.6
            ctx.fill(); ctx.shadowBlur = 0
            angle += sweep + 0.03
          }
          ctx.beginPath(); ctx.arc(p[0], p[1], innerR * 0.85, 0, Math.PI * 2)
          ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.fill()
        }
        for (const [baId, p] of ss.pos) {
          if (genMap.has(baId)) continue
          ctx.beginPath(); ctx.arc(p[0], p[1], 7 / T.k, 0, Math.PI * 2)
          ctx.strokeStyle = 'rgba(107,114,128,0.25)'; ctx.lineWidth = 0.8 / T.k; ctx.stroke()
        }
      }

      // ── Carbon mode — intensity dots ──────────────────────────────────
      if (m === 'carbon' && carbonMap.size > 0) {
        for (const [baId, intensity] of carbonMap) {
          const p = ss.pos.get(baId); if (!p) continue
          const c = d3.color(carbonColor(intensity))!.rgb()
          const r = 14 / T.k
          const grd = ctx.createRadialGradient(p[0], p[1], 0, p[0], p[1], r * 2.5)
          grd.addColorStop(0, `rgba(${c.r},${c.g},${c.b},0.55)`)
          grd.addColorStop(1, `rgba(${c.r},${c.g},${c.b},0)`)
          ctx.beginPath(); ctx.arc(p[0], p[1], r * 2.5, 0, Math.PI * 2)
          ctx.fillStyle = grd; ctx.fill()
          ctx.beginPath(); ctx.arc(p[0], p[1], r, 0, Math.PI * 2)
          ctx.fillStyle = `rgba(${c.r},${c.g},${c.b},0.88)`
          ctx.shadowColor = `rgba(${c.r},${c.g},${c.b},0.5)`; ctx.shadowBlur = r * 4
          ctx.fill(); ctx.shadowBlur = 0
          ctx.fillStyle = 'rgba(255,255,255,0.9)'
          ctx.font = `bold ${Math.round(5 / T.k)}px IBM Plex Mono, monospace`
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
          ctx.fillText(Math.round(intensity).toString(), p[0], p[1])
        }
      }

      // ── Facility layers — dot size ∝ √(nameplate MW) ─────────────────
      function capR(cap: number, maxCap: number, minPx: number, maxPx: number) {
        return (minPx + Math.sqrt(cap / maxCap) * (maxPx - minPx)) / T.k
      }

      if (layerNuclear && plantPts.nuclear.length > 0) {
        const maxCap = Math.max(...plantPts.nuclear.map(p => p[2]))
        ctx.lineWidth = 0.8 / T.k
        for (const [x, y, cap] of plantPts.nuclear) {
          const r    = capR(cap, maxCap, 1.5, 5.5)
          const halo = ctx.createRadialGradient(x, y, 0, x, y, r * 5)
          halo.addColorStop(0, 'rgba(139,92,246,0.2)'); halo.addColorStop(1, 'rgba(139,92,246,0)')
          ctx.beginPath(); ctx.arc(x, y, r * 5, 0, Math.PI * 2); ctx.fillStyle = halo; ctx.fill()
          ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2)
          ctx.fillStyle = 'rgba(139,92,246,0.9)'
          ctx.shadowColor = 'rgba(139,92,246,0.6)'; ctx.shadowBlur = r * 3
          ctx.fill(); ctx.shadowBlur = 0
          const arm = r * 2.2
          ctx.strokeStyle = 'rgba(139,92,246,0.4)'
          ctx.beginPath(); ctx.moveTo(x - arm, y); ctx.lineTo(x + arm, y)
          ctx.moveTo(x, y - arm); ctx.lineTo(x, y + arm); ctx.stroke()
        }
      }

      if (layerHydro && plantPts.hydro.length > 0) {
        const maxCap = Math.max(...plantPts.hydro.map(p => p[2]))
        for (const [x, y, cap] of plantPts.hydro) {
          const r    = capR(cap, maxCap, 1.2, 6.0)
          const halo = ctx.createRadialGradient(x, y, 0, x, y, r * 5)
          halo.addColorStop(0, 'rgba(37,99,235,0.18)'); halo.addColorStop(1, 'rgba(37,99,235,0)')
          ctx.beginPath(); ctx.arc(x, y, r * 5, 0, Math.PI * 2); ctx.fillStyle = halo; ctx.fill()
          const dv = r * 1.5
          ctx.beginPath()
          ctx.moveTo(x, y - dv); ctx.lineTo(x + dv, y); ctx.lineTo(x, y + dv); ctx.lineTo(x - dv, y)
          ctx.closePath()
          ctx.fillStyle = 'rgba(37,99,235,0.85)'
          ctx.shadowColor = 'rgba(37,99,235,0.5)'; ctx.shadowBlur = r * 3
          ctx.fill(); ctx.shadowBlur = 0
        }
      }

      if (layerWind && plantPts.wind.length > 0) {
        const maxCap = Math.max(...plantPts.wind.map(p => p[2]))
        for (const [x, y, cap] of plantPts.wind) {
          const r    = capR(cap, maxCap, 1.2, 5.0)
          const halo = ctx.createRadialGradient(x, y, 0, x, y, r * 5)
          halo.addColorStop(0, 'rgba(8,145,178,0.16)'); halo.addColorStop(1, 'rgba(8,145,178,0)')
          ctx.beginPath(); ctx.arc(x, y, r * 5, 0, Math.PI * 2); ctx.fillStyle = halo; ctx.fill()
          ctx.beginPath()
          ctx.moveTo(x, y - r * 1.6); ctx.lineTo(x + r * 1.4, y + r * 0.9); ctx.lineTo(x - r * 1.4, y + r * 0.9)
          ctx.closePath()
          ctx.fillStyle = 'rgba(8,145,178,0.85)'
          ctx.shadowColor = 'rgba(8,145,178,0.5)'; ctx.shadowBlur = r * 3
          ctx.fill(); ctx.shadowBlur = 0
        }
      }

      if (layerSolar && plantPts.solar.length > 0) {
        const maxCap = Math.max(...plantPts.solar.map(p => p[2]))
        ctx.lineWidth = 0.7 / T.k
        for (const [x, y, cap] of plantPts.solar) {
          const r    = capR(cap, maxCap, 1.2, 5.0)
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
            const inner = r * 1.35
            ctx.beginPath()
            ctx.moveTo(x + Math.cos(a) * inner, y + Math.sin(a) * inner)
            ctx.lineTo(x + Math.cos(a) * (inner + rayLen), y + Math.sin(a) * (inner + rayLen))
            ctx.stroke()
          }
        }
      }

      if (layerGas && plantPts.gas.length > 0) {
        const maxCap = Math.max(...plantPts.gas.map(p => p[2]))
        for (const [x, y, cap] of plantPts.gas) {
          const r    = capR(cap, maxCap, 1.2, 5.0)
          const halo = ctx.createRadialGradient(x, y, 0, x, y, r * 5)
          halo.addColorStop(0, 'rgba(234,88,12,0.18)'); halo.addColorStop(1, 'rgba(234,88,12,0)')
          ctx.beginPath(); ctx.arc(x, y, r * 5, 0, Math.PI * 2); ctx.fillStyle = halo; ctx.fill()
          const s = r * 1.3
          ctx.beginPath(); ctx.rect(x - s, y - s, s * 2, s * 2)
          ctx.fillStyle = 'rgba(234,88,12,0.85)'
          ctx.shadowColor = 'rgba(234,88,12,0.5)'; ctx.shadowBlur = r * 3
          ctx.fill(); ctx.shadowBlur = 0
        }
      }

      if (layerCoal && plantPts.coal.length > 0) {
        const maxCap = Math.max(...plantPts.coal.map(p => p[2]))
        for (const [x, y, cap] of plantPts.coal) {
          const r    = capR(cap, maxCap, 1.2, 5.5)
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

      // ── BA rings (lerp-animated) ──────────────────────────────────────
      for (const { id, pt } of ss.baList) {
        const t = ss.hoverT.get(id) ?? 0; if (t < 0.01) continue
        const { r, g, b } = hexToRgb(BA_COLORS[id] ?? '#333')
        ctx.beginPath(); ctx.arc(pt[0], pt[1], (10 + t * 7) / T.k, 0, Math.PI * 2)
        ctx.strokeStyle = `rgba(${r},${g},${b},${t * 0.65})`
        ctx.lineWidth   = 0.8 / T.k; ctx.stroke()
      }

      // ── BA dots ───────────────────────────────────────────────────────
      for (const { id, pt } of ss.baList) {
        const t    = ss.hoverT.get(id) ?? 0
        const { r, g, b } = hexToRgb(BA_COLORS[id] ?? '#333')
        ctx.beginPath(); ctx.arc(pt[0], pt[1], (5 + t * 3) / T.k, 0, Math.PI * 2)
        ctx.fillStyle   = `rgba(${r},${g},${b},${0.85 + t * 0.15})`
        ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = (1.2 + t * 0.8) / T.k
        ctx.fill(); ctx.stroke()
      }

      // ── BA labels — pill chips ────────────────────────────────────────
      const hPad = 4 / T.k
      const vPad = 2.5 / T.k
      const pRad = 3 / T.k

      for (const { id, name, pt } of ss.baList) {
        const t    = ss.hoverT.get(id) ?? 0
        const { r, g, b } = hexToRgb(BA_COLORS[id] ?? '#333')
        const dotR = (5 + t * 3) / T.k

        // 9px screen-space at rest, grows to 13px on full hover
        const textSize = (9 + t * 4) / T.k
        ctx.font = `${t > 0.3 ? 600 : 500} ${textSize}px IBM Plex Mono, monospace`
        ctx.textAlign    = 'center'
        ctx.textBaseline = 'alphabetic'

        const tw   = ctx.measureText(id).width
        const capH = textSize * 0.68   // approx cap height for IBM Plex Mono
        const pillW = tw + hPad * 2
        const pillH = capH + vPad * 2

        // Pill floats above the dot
        const pillGap  = 5 / T.k
        const pillCY   = pt[1] - dotR - pillGap - pillH / 2
        const pillTop  = pillCY - pillH / 2
        const pillLeft = pt[0] - pillW / 2

        // Background
        ctx.beginPath()
        ctx.roundRect(pillLeft, pillTop, pillW, pillH, pRad)
        ctx.fillStyle = `rgba(255,255,255,${0.78 + t * 0.14})`
        ctx.fill()

        // BA-colored border fades in with hover
        if (t > 0.04) {
          ctx.strokeStyle = `rgba(${r},${g},${b},${t * 0.65})`
          ctx.lineWidth   = 0.7 / T.k
          ctx.stroke()
        }

        // Abbreviation text — near-black at rest, BA color on hover
        ctx.fillStyle = t > 0.15
          ? `rgba(${r},${g},${b},${0.52 + t * 0.48})`
          : `rgba(20,20,20,${0.52 + t * 0.48})`
        ctx.fillText(id, pt[0], pillCY + capH * 0.5)

        // Full name fades in above 2× zoom, below the dot
        if (T.k > 2) {
          const nameOpacity = Math.min(1, (T.k - 2) / 1.2) * (0.4 + t * 0.4)
          ctx.font         = `400 ${7 / T.k}px IBM Plex Mono, monospace`
          ctx.textBaseline = 'top'
          ctx.fillStyle    = t > 0.15
            ? `rgba(${r},${g},${b},${nameOpacity})`
            : `rgba(20,20,20,${nameOpacity})`
          ctx.fillText(name, pt[0], pt[1] + dotR + 4 / T.k)
        }
      }

      ctx.restore()
      ss.raf = requestAnimationFrame(frame)
    }
    S.current.raf = requestAnimationFrame(frame)

    return () => {
      cancelAnimationFrame(S.current.raf)
      clearTimeout(resizeTimer)
      window.removeEventListener('resize', handleResize)
      d3.select(canvas).on('.zoom', null)
      S.current.pos.clear()
      S.current.arcData = []; S.current.particles = []
      S.current.voronoiCells = []; S.current.baList = []
      S.current.geoReady = false
      S.current.continentalP2d = null; S.current.stateMeshP2d = null
      S.current.plantPts = { nuclear: [], hydro: [], wind: [], solar: [], gas: [], coal: [] }
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Sync props → S.current (no DOM work, just ref writes) ────────────
  useEffect(() => { S.current.selectedBA = selectedBA }, [selectedBA])

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

  useEffect(() => {
    dataRef.current = data
    if (!data || !S.current.pos.size) return
    const maxMW = d3.max(data.links, l => Math.abs(l.value)) ?? 1
    S.current.particles = []
    S.current.arcData   = data.links.flatMap(l => {
      const src = S.current.pos.get(l.source), tgt = S.current.pos.get(l.target)
      if (!src || !tgt) return []
      return [{ src, cp: controlPoint(src, tgt), tgt, norm: Math.abs(l.value) / maxMW, fwd: l.value > 0, srcId: l.source, tgtId: l.target }]
    })
  }, [data])

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <canvas
        ref={canvasRef}
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
      />

      {/* Carbon intensity legend */}
      {mode === 'carbon' && (
        <div style={{
          position: 'fixed', bottom: 120, left: 20, zIndex: 20,
          background: 'rgba(255,255,255,0.88)',
          backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)',
          border: '1px solid rgba(0,0,0,0.08)', borderRadius: 10,
          padding: '10px 14px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
          minWidth: 140,
        }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'rgba(0,0,0,0.4)', marginBottom: 8 }}>
            Carbon Intensity
          </div>
          <div style={{ width: 100, height: 10, borderRadius: 5, background: 'linear-gradient(to right, #1a9641, #ffffbf, #d7191c)' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--font-mono)', fontSize: 7, color: 'rgba(0,0,0,0.35)', marginTop: 4 }}>
            <span>Clean</span><span>Dirty</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--font-mono)', fontSize: 7, color: 'rgba(0,0,0,0.25)', marginTop: 2 }}>
            <span>0</span><span>800 g/kWh</span>
          </div>
        </div>
      )}
    </div>
  )
}
