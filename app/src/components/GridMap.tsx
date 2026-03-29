import { useEffect, useRef } from 'react'
import * as d3 from 'd3'
import * as topojson from 'topojson-client'
import type { GridData, BaGenData, Mode, LayerKey } from '../types'

export const FUEL_COLORS: Record<string, string> = {
  nuclear: '#c084fc',
  wind:    '#00e5ff',
  solar:   '#fbbf24',
  gas:     '#fb923c',
  coal:    '#f43f5e',
  hydro:   '#3b82f6',
  other:   '#6b7280',
}

export const BA_DEFS: [string, string, [number, number]][] = [
  ['BPAT', 'Bonneville Power Admin',     [-122.5, 46.8]],
  ['PACW', 'PacifiCorp West',            [-120.5, 44.2]],
  ['CISO', 'California ISO',             [-119.5, 37.2]],
  ['IPCO', 'Idaho Power',                [-114.8, 43.5]],
  ['NEVP', 'NV Energy',                  [-117.2, 39.3]],
  ['PACE', 'PacifiCorp East',            [-111.5, 40.8]],
  ['AZPS', 'Arizona Public Service',     [-112.2, 33.6]],
  ['SRP',  'Salt River Project',         [-111.9, 33.4]],
  ['WACM', 'WAPA Colorado',              [-108.5, 39.2]],
  ['PSCO', 'Xcel Energy Colorado',       [-104.8, 39.7]],
  ['SWPP', 'Southwest Power Pool',       [ -97.5, 38.5]],
  ['ERCO', 'ERCOT',                      [ -99.3, 31.5]],
  ['MISO', 'Midcontinent ISO',           [ -90.0, 42.5]],
  ['TVA',  'Tennessee Valley Authority', [ -87.0, 35.5]],
  ['PJM',  'PJM Interconnection',        [ -79.5, 40.5]],
  ['DUK',  'Duke Energy',                [ -80.8, 35.4]],
  ['SC',   'South Carolina E&G',         [ -81.2, 33.7]],
  ['FPL',  'Florida Power & Light',      [ -80.8, 27.5]],
  ['NYIS', 'New York ISO',               [ -75.5, 43.0]],
  ['ISNE', 'ISO New England',            [ -71.8, 42.4]],
]

export const BA_COLORS: Record<string, string> = {
  BPAT: '#4a9eff',
  PACW: '#38c4f0',
  CISO: '#f0c93a',
  IPCO: '#5bcce0',
  NEVP: '#f0a83a',
  PACE: '#8870e0',
  AZPS: '#f07840',
  SRP:  '#e86030',
  WACM: '#7090d8',
  PSCO: '#5878c8',
  SWPP: '#40c878',
  ERCO: '#e84848',
  MISO: '#50b870',
  TVA:  '#38c0a8',
  PJM:  '#7878f0',
  DUK:  '#90c840',
  SC:   '#b0d840',
  FPL:  '#f09040',
  NYIS: '#9090f8',
  ISNE: '#c0c0ff',
}


function hexToRgb(hex: string) {
  return {
    r: parseInt(hex.slice(1,3),16),
    g: parseInt(hex.slice(3,5),16),
    b: parseInt(hex.slice(5,7),16),
  }
}

function controlPoint(src:[number,number], tgt:[number,number]):[number,number] {
  const mx=(src[0]+tgt[0])/2, my=(src[1]+tgt[1])/2
  const dx=tgt[0]-src[0],     dy=tgt[1]-src[1]
  const len=Math.sqrt(dx*dx+dy*dy)||1
  return [mx-(dy/len)*len*0.18, my+(dx/len)*len*0.18]
}

function bezierPt(t:number, p0:[number,number], cp:[number,number], p1:[number,number]):[number,number] {
  const mt=1-t
  return [mt*mt*p0[0]+2*mt*t*cp[0]+t*t*p1[0], mt*mt*p0[1]+2*mt*t*cp[1]+t*t*p1[1]]
}

interface Arc      { src:[number,number]; cp:[number,number]; tgt:[number,number]; norm:number; fwd:boolean }
interface Particle { src:[number,number]; cp:[number,number]; tgt:[number,number]; t:number; speed:number; norm:number; fwd:boolean }

interface Props {
  data:      GridData | null
  hoveredBA: string | null
  onBAHover: (id: string | null) => void
  mode:      Mode
  layers:    Set<LayerKey>
  genData:   BaGenData[] | null
}

export function GridMap({ data, hoveredBA, onBAHover, mode, layers, genData }: Props) {
  const svgRef    = useRef<SVGSVGElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const S = useRef({
    transform:     d3.zoomIdentity as d3.ZoomTransform,
    pos:           new Map<string,[number,number]>(),
    arcData:       [] as Arc[],
    particles:     [] as Particle[],
    raf:           0,
    mode:          'flow' as Mode,
    layerArcs:     true,
    layerParticles: true,
    genMap:        new Map<string, BaGenData>(),
  })

  // ── Map setup (once) ─────────────────────────────────────────────────
  useEffect(() => {
    const svgEl=svgRef.current!, canvasEl=canvasRef.current!
    const W=window.innerWidth, H=window.innerHeight
    const svg=d3.select(svgEl).attr('width',W).attr('height',H)
    canvasEl.width=W; canvasEl.height=H
    const ctx=canvasEl.getContext('2d')!

    const proj=d3.geoAlbersUsa().scale(1100).translate([W/2,H/2])
    const path=d3.geoPath().projection(proj)
    const pos=S.current.pos

    const scene=svg.append('g')
    svg.call(
      d3.zoom<SVGSVGElement,unknown>()
        .scaleExtent([0.5,12])
        .on('zoom', e=>{
          S.current.transform=e.transform
          scene.attr('transform',e.transform.toString())
          const el=document.getElementById('stat-zoom')
          if(el) el.textContent=e.transform.k.toFixed(1)+'×'
        })
    ).on('dblclick.zoom',null)

    Promise.all([
      fetch('/us-states.json').then(r=>r.json()),
      fetch('/ba-boundaries.geojson').then(r=>r.json()),
    ]).then(([us, baGeo]:[any,any])=>{

      // 1. State borders — ghost grid for geographic context
      scene.append('path')
        .datum(topojson.mesh(us,us.objects.states,(a:any,b:any)=>a!==b) as any)
        .attr('d',path as any).attr('fill','none')
        .attr('stroke','rgba(255,255,255,0.04)').attr('stroke-width',0.3)
        .attr('pointer-events','none')

      // 3. BA fills — real boundaries, compute centroids (fills are visual placeholders only)
      baGeo.features.forEach((feature:any)=>{
        const baId=feature.properties.BA_Abbrev
        if(!BA_COLORS[baId]) return
        const centroid=proj(d3.geoCentroid(feature) as [number,number])
        if(centroid) pos.set(baId, centroid as [number,number])
        scene.append('path')
          .datum(feature)
          .attr('class','ba-fill').attr('data-ba',baId)
          .attr('d',path as any)
          .attr('fill','none')
          .attr('pointer-events','none')
      })

      // 4. BA borders — real boundaries, subtle at rest
      baGeo.features.forEach((feature:any)=>{
        const baId=feature.properties.BA_Abbrev
        if(!BA_COLORS[baId]) return
        const {r,g,b}=hexToRgb(BA_COLORS[baId])
        scene.append('path')
          .datum(feature)
          .attr('class','ba-border').attr('data-ba',baId)
          .attr('d',path as any).attr('fill','none')
          .attr('stroke',`rgba(${r},${g},${b},0.16)`)
          .attr('stroke-width',0.6).attr('stroke-linejoin','round')
          .attr('pointer-events','none')
      })

      // 5. Coastline — exterior US boundary only
      scene.append('path')
        .datum(topojson.mesh(us,us.objects.states,(a:any,b:any)=>a===b) as any)
        .attr('d',path as any).attr('fill','none')
        .attr('stroke','rgba(255,255,255,0.22)').attr('stroke-width',0.8)
        .attr('pointer-events','none')

      // 7. Rings — at real centroids, hidden until hover
      const baWithPos=BA_DEFS.filter(([id])=>pos.has(id))
      scene.selectAll<SVGCircleElement,(typeof BA_DEFS)[number]>('circle.ba-ring')
        .data(baWithPos).join('circle')
        .attr('class','ba-ring')
        .attr('cx',([id])=>pos.get(id)![0]).attr('cy',([id])=>pos.get(id)![1])
        .attr('r',10).attr('fill','none')
        .attr('stroke',([id])=>{ const {r,g,b}=hexToRgb(BA_COLORS[id]??'#fff'); return `rgba(${r},${g},${b},0.6)` })
        .attr('stroke-width',0.8).style('opacity',0).attr('pointer-events','none')

      // 8. Core dots — at real centroids
      scene.selectAll<SVGCircleElement,(typeof BA_DEFS)[number]>('circle.ba-dot')
        .data(baWithPos).join('circle')
        .attr('class','ba-dot')
        .attr('cx',([id])=>pos.get(id)![0]).attr('cy',([id])=>pos.get(id)![1])
        .attr('r',5)
        .attr('fill',([id])=>{ const {r,g,b}=hexToRgb(BA_COLORS[id]??'#fff'); return `rgba(${r},${g},${b},0.7)` })
        .attr('stroke','rgba(8,8,8,0.8)').attr('stroke-width',1.2)
        .attr('pointer-events','none')  // hit circles handle interaction

      // 8b. Invisible hit circles — large transparent targets around each dot
      //     Drawn on top of fills/borders so they win in the z-order
      scene.selectAll<SVGCircleElement,(typeof BA_DEFS)[number]>('circle.ba-hit')
        .data(baWithPos).join('circle')
        .attr('class','ba-hit')
        .attr('cx',([id])=>pos.get(id)![0]).attr('cy',([id])=>pos.get(id)![1])
        .attr('r',18)
        .attr('fill','transparent')
        .attr('pointer-events','all')
        .style('cursor','pointer')
        .on('mouseover',(_e,[id])=>onBAHover(id))
        .on('mouseout', ()        =>onBAHover(null))

      // 9. Labels — at real centroids, dim at rest
      scene.selectAll<SVGTextElement,(typeof BA_DEFS)[number]>('text.ba-label')
        .data(baWithPos).join('text')
        .attr('class','ba-label')
        .attr('x',([id])=>pos.get(id)![0])
        .attr('y',([id])=>pos.get(id)![1]-14)
        .attr('text-anchor','middle')
        .attr('font-size',7).attr('font-weight','400')
        .attr('font-family','IBM Plex Mono, monospace')
        .attr('letter-spacing','0.1em')
        .attr('fill','rgba(255,255,255,0.18)')
        .attr('pointer-events','none')
        .text(([id])=>id)
    })

    // ── Render loop ───────────────────────────────────────────────────
    function frame(){
      const {transform:T,arcData,particles,mode:m,layerArcs,layerParticles,genMap,pos}=S.current
      ctx.setTransform(T.k,0,0,T.k,T.x,T.y)
      ctx.clearRect(-T.x/T.k,-T.y/T.k,W/T.k,H/T.k)

      // ── Flow mode: arcs + particles ──────────────────────────────
      if(m==='flow' && arcData.length>0){
        if(layerArcs){
          ctx.lineCap='round'
          for(const {src,cp,tgt,norm,fwd} of arcData){
            const [r,g,b]=fwd?[74,158,255]:[255,128,64]
            ctx.beginPath(); ctx.moveTo(src[0],src[1]); ctx.quadraticCurveTo(cp[0],cp[1],tgt[0],tgt[1])
            ctx.strokeStyle=`rgba(${r},${g},${b},${0.03+norm*0.05})`; ctx.lineWidth=(6+norm*10)/T.k; ctx.stroke()
            ctx.beginPath(); ctx.moveTo(src[0],src[1]); ctx.quadraticCurveTo(cp[0],cp[1],tgt[0],tgt[1])
            ctx.strokeStyle=`rgba(${r},${g},${b},${0.07+norm*0.18})`; ctx.lineWidth=(1.5+norm*2.5)/T.k; ctx.stroke()
            ctx.beginPath(); ctx.moveTo(src[0],src[1]); ctx.quadraticCurveTo(cp[0],cp[1],tgt[0],tgt[1])
            ctx.strokeStyle=`rgba(${r},${g},${b},${0.22+norm*0.45})`; ctx.lineWidth=(0.5+norm*0.8)/T.k
            ctx.shadowColor=`rgba(${r},${g},${b},0.7)`; ctx.shadowBlur=(3+norm*7)/T.k; ctx.stroke(); ctx.shadowBlur=0
          }
        }
        if(layerParticles){
          for(const arc of arcData){
            if(Math.random()<0.07+arc.norm*0.11) particles.push({
              src:arc.src,cp:arc.cp,tgt:arc.tgt,
              t:arc.fwd?0:1, speed:(0.003+arc.norm*0.009)*(arc.fwd?1:-1),
              norm:arc.norm, fwd:arc.fwd
            })
          }
          S.current.particles=particles.filter(p=>{ p.t+=p.speed; return p.t>=0&&p.t<=1 })
          if(S.current.particles.length>1200) S.current.particles.splice(0,S.current.particles.length-1200)
          const pr=1.4/T.k
          for(const p of S.current.particles){
            const [x,y]=bezierPt(p.t,p.src,p.cp,p.tgt)
            const [r,g,b]=p.fwd?[140,200,255]:[255,155,75]
            ctx.beginPath(); ctx.arc(x,y,pr+(p.norm*0.7)/T.k,0,Math.PI*2)
            ctx.fillStyle=`rgba(${r},${g},${b},${0.45+p.norm*0.45})`
            ctx.shadowColor=`rgba(${r},${g},${b},0.85)`; ctx.shadowBlur=(5+p.norm*5)/T.k
            ctx.fill(); ctx.shadowBlur=0
          }
        }
      }

      // ── Generation mode: neutral scale halos (size = total MW) ──
      if(m==='generation' && genMap.size>0){
        let maxMw=0
        for(const [,d] of genMap) if(d.totalMw>maxMw) maxMw=d.totalMw

        for(const [baId,gd] of genMap){
          const p=pos.get(baId)
          if(!p) continue
          const norm=Math.sqrt(gd.totalMw/Math.max(maxMw,1))
          const radius=(5+norm*28)/T.k

          // Bloom
          ctx.beginPath(); ctx.arc(p[0],p[1],radius,0,Math.PI*2)
          ctx.fillStyle='rgba(180,210,255,0.05)'
          ctx.shadowColor='rgba(160,200,255,0.45)'
          ctx.shadowBlur=(radius*T.k*1.6)/T.k
          ctx.fill(); ctx.shadowBlur=0

          // Ring
          ctx.beginPath(); ctx.arc(p[0],p[1],radius,0,Math.PI*2)
          ctx.strokeStyle='rgba(160,200,255,0.22)'
          ctx.lineWidth=0.6/T.k
          ctx.stroke()
        }
      }

      S.current.raf=requestAnimationFrame(frame)
    }
    S.current.raf=requestAnimationFrame(frame)

    return ()=>{
      cancelAnimationFrame(S.current.raf)
      svg.selectAll('*').remove(); svg.on('.zoom',null)
      S.current.pos.clear(); S.current.arcData=[]; S.current.particles=[]
    }
  },[]) // eslint-disable-line

  // ── Hover highlight — dot, ring, label, fill ──────────────────────────
  useEffect(()=>{
    const svg=d3.select(svgRef.current!)
    const pos=S.current.pos

    // BA borders — dim at rest, vivid on hover
    svg.selectAll<SVGPathElement,(typeof BA_DEFS)[number]>('.ba-border')
      .each(function(){
        const baId=d3.select(this).attr('data-ba')
        const isHovered=baId===hoveredBA
        const {r,g,b}=hexToRgb(BA_COLORS[baId]??'#ffffff')
        d3.select(this)
          .transition().duration(220)
          .attr('stroke', isHovered ? `rgba(${r},${g},${b},0.78)` : `rgba(${r},${g},${b},0.16)`)
          .attr('stroke-width', isHovered ? 1.4 : 0.6)
      })

    // Rings — hidden at rest, appear on hover
    svg.selectAll<SVGCircleElement,(typeof BA_DEFS)[number]>('circle.ba-ring')
      .transition().duration(220)
      .attr('r', ([id])=>id===hoveredBA ? 17 : 10)
      .style('opacity', ([id])=>id===hoveredBA ? 0.65 : 0)

    // Dots — subtle at rest, enlarged on hover
    svg.selectAll<SVGCircleElement,(typeof BA_DEFS)[number]>('circle.ba-dot')
      .transition().duration(220)
      .attr('r', ([id])=>id===hoveredBA ? 8 : 5)
      .attr('fill', ([id])=>{
        const {r,g,b}=hexToRgb(BA_COLORS[id]??'#fff')
        return id===hoveredBA ? `rgba(${r},${g},${b},1)` : `rgba(${r},${g},${b},0.7)`
      })
      .attr('stroke-width', ([id])=>id===hoveredBA ? 2 : 1.2)

    // Labels — ghost at rest, full color on hover
    svg.selectAll<SVGTextElement,(typeof BA_DEFS)[number]>('text.ba-label')
      .transition().duration(220)
      .attr('font-size', ([id])=>id===hoveredBA ? 11 : 7)
      .attr('font-weight', ([id])=>id===hoveredBA ? '500' : '400')
      .attr('letter-spacing', ([id])=>id===hoveredBA ? '0.14em' : '0.1em')
      .attr('y', ([id])=>{ const p=pos.get(id); return p ? p[1]-(id===hoveredBA?20:14) : 0 })
      .attr('fill', ([id])=>{
        if(id!==hoveredBA) return 'rgba(255,255,255,0.18)'
        const {r,g,b}=hexToRgb(BA_COLORS[id]??'#fff')
        return `rgba(${r},${g},${b},1)`
      })
  },[hoveredBA])

  // ── Rebuild arcs on new data ──────────────────────────────────────────
  useEffect(()=>{
    if(!data) return
    const pos=S.current.pos
    if(!pos.size) return
    const maxMW=d3.max(data.links,d=>Math.abs(d.value))??1
    S.current.particles=[]
    S.current.arcData=data.links.flatMap(l=>{
      const src=pos.get(l.source), tgt=pos.get(l.target)
      if(!src||!tgt) return []
      return [{src,cp:controlPoint(src,tgt),tgt,norm:Math.abs(l.value)/maxMW,fwd:l.value>0}]
    })
  },[data])

  // ── Sync mode + layer flags into render stateRef ──────────────────────
  useEffect(()=>{
    S.current.mode=mode
    S.current.layerArcs=layers.has('arcs')
    S.current.layerParticles=layers.has('particles')
    if(mode!=='flow') S.current.particles=[]
  },[mode,layers])

  // ── Sync generation data into render stateRef ─────────────────────────
  useEffect(()=>{
    const m=new Map<string,BaGenData>()
    if(genData) genData.forEach(d=>m.set(d.ba,d))
    S.current.genMap=m
  },[genData])

  return (
    <div style={{position:'absolute',inset:0}}>
      <svg ref={svgRef} style={{position:'absolute',inset:0,width:'100%',height:'100%'}} />
      <canvas ref={canvasRef} style={{position:'absolute',inset:0,pointerEvents:'none'}} />
    </div>
  )
}
