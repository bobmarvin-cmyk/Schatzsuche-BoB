'use client'
import {useEffect,useRef,useState} from 'react'

const METERS_PER_DEG_LAT=111320
const CHUNK=64
const MAP_STYLE='https://tiles.openfreemap.org/styles/liberty'
const SATELLITE_STYLE={
  version:8,
  sources:{
    satellite:{
      type:'raster',
      tiles:['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
      tileSize:256,
      attribution:'Esri, Maxar, Earthstar Geographics, and the GIS User Community'
    },
    transport:{
      type:'raster',
      tiles:['https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}'],
      tileSize:256
    },
    places:{
      type:'raster',
      tiles:['https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}'],
      tileSize:256
    }
  },
  layers:[
    {id:'satellite-base',type:'raster',source:'satellite'},
    {id:'satellite-roads',type:'raster',source:'transport'},
    {id:'satellite-labels',type:'raster',source:'places'}
  ]
}
const FALLBACK_STYLE={
  version:8,
  sources:{
    osm:{
      type:'raster',
      tiles:['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize:256,
      attribution:'© OpenStreetMap contributors'
    }
  },
  layers:[{id:'osm',type:'raster',source:'osm'}]
}

function geometry(game){
  const lat=Number(game?.center_lat||0)
  const lon=Number(game?.center_lon||0)
  const cell=Number(game?.cell_size_m||100)
  const width=Number(game?.width||100)
  const height=Number(game?.height||100)
  const metersLon=Math.max(1000,METERS_PER_DEG_LAT*Math.cos(lat*Math.PI/180))
  const halfW=width*cell/2
  const halfH=height*cell/2
  return {
    lat,lon,cell,width,height,metersLon,
    west:lon-halfW/metersLon,
    east:lon+halfW/metersLon,
    south:lat-halfH/METERS_PER_DEG_LAT,
    north:lat+halfH/METERS_PER_DEG_LAT
  }
}

function cellBounds(g,x,y,size=1){
  const actualW=Math.max(1,Math.min(Number(size)||1,g.width-x))
  const actualH=Math.max(1,Math.min(Number(size)||1,g.height-y))
  const west=g.west+x*g.cell/g.metersLon
  const east=g.west+(x+actualW)*g.cell/g.metersLon
  const north=g.north-y*g.cell/METERS_PER_DEG_LAT
  const south=g.north-(y+actualH)*g.cell/METERS_PER_DEG_LAT
  return [west,south,east,north]
}

function trapCollection(game,traps){
  if(!game)return {type:'FeatureCollection',features:[]}
  const g=geometry(game)
  return {type:'FeatureCollection',features:(traps||[]).map(t=>{
    const [w,s,e,n]=cellBounds(g,Number(t.x),Number(t.y),1)
    return {
      type:'Feature',
      properties:{label:'🪤',trap_type:t.trap_type},
      geometry:{type:'Polygon',coordinates:[[[w,s],[e,s],[e,n],[w,n],[w,s]]]}
    }
  })}
}

function analysisCollection(h){
  if(!h?.lat||!h?.lon||!h?.radius_m)return {type:'FeatureCollection',features:[]}
  const steps=48,coords=[]
  const lat=Number(h.lat),lon=Number(h.lon),radius=Number(h.radius_m)
  const metersLon=Math.max(1000,METERS_PER_DEG_LAT*Math.cos(lat*Math.PI/180))
  for(let i=0;i<=steps;i++){
    const a=(i/steps)*Math.PI*2
    coords.push([
      lon+Math.cos(a)*radius/metersLon,
      lat+Math.sin(a)*radius/METERS_PER_DEG_LAT
    ])
  }
  return {
    type:'FeatureCollection',
    features:[{
      type:'Feature',
      properties:{},
      geometry:{type:'Polygon',coordinates:[coords]}
    }]
  }
}

function terrainFromFeatures(features){
  const rows=(features||[]).map(f=>({
    sourceLayer:String(f.sourceLayer||'').toLowerCase(),
    cls:String(f.properties?.class||'').toLowerCase(),
    sub:String(f.properties?.subclass||'').toLowerCase(),
    layer:String(f.layer?.id||'').toLowerCase()
  }))
  const has=(...words)=>rows.some(r=>words.some(w=>
    r.sourceLayer.includes(w)||r.cls===w||r.sub===w||r.layer.includes(w)
  ))

  if(has('water','ocean','lake','river','pond','dock'))return {type:'water',label:'🌊 Wasser'}
  if(has('wetland','swamp','bog','marsh','reedbed','saltmarsh','tidalflat'))return {type:'wetland',label:'🟫 Feuchtgebiet'}
  if(has('wood','forest'))return {type:'forest',label:'🌲 Wald'}
  if(has('industrial'))return {type:'industrial',label:'🏭 Industrie'}
  if(has('military','quarry'))return {type:'restricted',label:'⚠️ Sondergebiet'}
  if(has('commercial','retail'))return {type:'commercial',label:'🏬 Gewerbe'}
  if(has('residential','suburb','quarter','neighbourhood'))return {type:'residential',label:'🏙 Wohngebiet'}
  if(has('park','garden','recreation_ground','playground'))return {type:'park',label:'🌳 Park'}
  if(has('farmland','farm','orchard','vineyard','allotments'))return {type:'farmland',label:'🚜 Landwirtschaft'}
  if(has('sand','beach','dune'))return {type:'sand',label:'🏖 Sand'}
  if(has('rock','bare_rock','scree'))return {type:'rock',label:'🪨 Fels'}
  if(has('grass','grassland','meadow','heath','scrub'))return {type:'grass',label:'🌾 Grünland'}
  if(has('transportation','road','street','highway'))return {type:'road',label:'🛣 Verkehrsfläche'}
  return {type:'open',label:'🧭 Offenes Gelände'}
}

function playerColorMap(players){
  const map={}
  ;(players||[]).forEach((p,i)=>{
    map[p.user_id]=p.player_color||['#3b82f6','#22c55e','#a855f7','#ef4444'][i%4]
  })
  return map
}

function hexToRgba(hex,alpha){
  const v=String(hex||'#3b82f6').replace('#','')
  const full=v.length===3?v.split('').map(x=>x+x).join(''):v.padEnd(6,'0').slice(0,6)
  const n=parseInt(full,16)
  if(!Number.isFinite(n))return `rgba(59,130,246,${alpha})`
  return `rgba(${(n>>16)&255},${(n>>8)&255},${n&255},${alpha})`
}

export default function GameMap({
  game,
  mapChunks=[],
  mapRenderMode='overview',
  players,
  onReveal,
  onTerrainReveal,
  onTerrainBatch,
  terrainScanPower=1,
  onTrapPlace,
  trapMode,
  ownTraps=[],
  analysisHint,
  onViewportChange,
  analysisFocusToken,
  onAnalysisFeatures,
  mobileHud,
  mapInfo,
  waypointMode=false,
  onWaypoint,
  assistantWaypoints=[],
  assistantPosition=null,
  assistantTarget=null,
  onAssistantStepDone
}){
  const holder=useRef(null)
  const canvasRef=useRef(null)
  const mapRef=useRef(null)
  const gameRef=useRef(game)
  const chunksRef=useRef(mapChunks)
  const playersRef=useRef(players)
  const renderModeRef=useRef(mapRenderMode)
  const onTerrainRevealRef=useRef(onTerrainReveal)
  const onTerrainBatchRef=useRef(onTerrainBatch)
  const terrainScanPowerRef=useRef(terrainScanPower)
  const onRevealRef=useRef(onReveal)
  const onTrapPlaceRef=useRef(onTrapPlace)
  const trapModeRef=useRef(trapMode)
  const ownTrapsRef=useRef(ownTraps)
  const analysisRef=useRef(analysisHint)
  const viewportRef=useRef(onViewportChange)
  const analysisFeaturesRef=useRef(onAnalysisFeatures)
  const waypointModeRef=useRef(waypointMode)
  const onWaypointRef=useRef(onWaypoint)
  const assistantWaypointsRef=useRef(assistantWaypoints)
  const assistantPositionRef=useRef(assistantPosition)
  const assistantTargetRef=useRef(assistantTarget)
  const onAssistantStepDoneRef=useRef(onAssistantStepDone)
  const lastAssistantTokenRef=useRef(null)
  const mapModeRef=useRef('satellite')
  const terrainCacheRef=useRef(new Map())
  const drawPendingRef=useRef(false)
  const gridStrideRef=useRef(1)
  const [status,setStatus]=useState('Karte wird geladen…')
  const [mapMode,setMapMode]=useState('satellite')
  const [renderMode,setRenderMode]=useState(mapRenderMode)
  const [gridStride,setGridStride]=useState(1)

  gameRef.current=game
  chunksRef.current=mapChunks
  playersRef.current=players
  renderModeRef.current=mapRenderMode
  onTerrainRevealRef.current=onTerrainReveal
  onTerrainBatchRef.current=onTerrainBatch
  terrainScanPowerRef.current=terrainScanPower
  onRevealRef.current=onReveal
  onTrapPlaceRef.current=onTrapPlace
  trapModeRef.current=trapMode
  ownTrapsRef.current=ownTraps
  analysisRef.current=analysisHint
  viewportRef.current=onViewportChange
  analysisFeaturesRef.current=onAnalysisFeatures
  waypointModeRef.current=waypointMode
  onWaypointRef.current=onWaypoint
  assistantWaypointsRef.current=assistantWaypoints
  assistantPositionRef.current=assistantPosition
  assistantTargetRef.current=assistantTarget
  onAssistantStepDoneRef.current=onAssistantStepDone
  mapModeRef.current=mapMode

  function scheduleCanvasDraw(){
    if(drawPendingRef.current)return
    drawPendingRef.current=true
    requestAnimationFrame(()=>{
      drawPendingRef.current=false
      drawCanvas()
    })
  }

  function resizeCanvas(){
    const canvas=canvasRef.current
    const shell=holder.current
    if(!canvas||!shell)return
    const rect=shell.getBoundingClientRect()
    const dpr=Math.min(2,window.devicePixelRatio||1)
    const w=Math.max(1,Math.round(rect.width*dpr))
    const h=Math.max(1,Math.round(rect.height*dpr))
    if(canvas.width!==w||canvas.height!==h){
      canvas.width=w
      canvas.height=h
      canvas.style.width=rect.width+'px'
      canvas.style.height=rect.height+'px'
    }
  }

  function drawCanvas(){
    const canvas=canvasRef.current
    const map=mapRef.current
    const g0=gameRef.current
    if(!canvas||!map||!g0)return

    resizeCanvas()
    const ctx=canvas.getContext('2d',{alpha:true})
    if(!ctx)return

    // Canvas bleibt vollständig transparent; nur Raster/Belegung werden darübergelegt.
    ctx.globalCompositeOperation='source-over'
    ctx.globalAlpha=1

    const dpr=Math.min(2,window.devicePixelRatio||1)
    const width=canvas.width/dpr
    const height=canvas.height/dpr
    ctx.setTransform(dpr,0,0,dpr,0,0)
    ctx.clearRect(0,0,width,height)

    const g=geometry(g0)
    let nw,se
    try{
      nw=map.project([g.west,g.north])
      se=map.project([g.east,g.south])
    }catch{return}

    const cellPxX=(se.x-nw.x)/Math.max(1,g.width)
    const cellPxY=(se.y-nw.y)/Math.max(1,g.height)
    if(!Number.isFinite(cellPxX)||!Number.isFinite(cellPxY))return

    const bounds=map.getBounds()
    const vx0=Math.max(0,Math.floor((bounds.getWest()-g.west)*g.metersLon/g.cell)-2)
    const vx1=Math.min(g.width-1,Math.ceil((bounds.getEast()-g.west)*g.metersLon/g.cell)+2)
    const vy0=Math.max(0,Math.floor((g.north-bounds.getNorth())*METERS_PER_DEG_LAT/g.cell)-2)
    const vy1=Math.min(g.height-1,Math.ceil((g.north-bounds.getSouth())*METERS_PER_DEG_LAT/g.cell)+2)

    const xFor=x=>nw.x+x*cellPxX
    const yFor=y=>nw.y+y*cellPxY
    const colors=playerColorMap(playersRef.current)

    ctx.save()
    ctx.beginPath()
    ctx.rect(
      Math.max(0,Math.min(nw.x,se.x)),
      Math.max(0,Math.min(nw.y,se.y)),
      Math.abs(se.x-nw.x),
      Math.abs(se.y-nw.y)
    )
    ctx.clip()

    if(renderModeRef.current==='overview'){
      const minCx=Math.floor(vx0/CHUNK),maxCx=Math.floor(vx1/CHUNK)
      const minCy=Math.floor(vy0/CHUNK),maxCy=Math.floor(vy1/CHUNK)
      for(const c of chunksRef.current||[]){
        const cx=Number(c.cx),cy=Number(c.cy)
        if(cx<minCx||cx>maxCx||cy<minCy||cy>maxCy)continue
        const coverage=Math.max(0,Math.min(1,Number(c.coverage||0)))
        if(coverage<=0)continue
        const x=cx*CHUNK
        const y=cy*CHUNK
        const wCells=Math.max(1,Number(c.w||Math.min(CHUNK,g.width-x)))
        const hCells=Math.max(1,Number(c.h||Math.min(CHUNK,g.height-y)))
        const px=xFor(x),py=yFor(y)
        const pw=wCells*cellPxX,ph=hCells*cellPxY
        const color=colors[c.dominant_user_id]||'#3b82f6'
        ctx.fillStyle=hexToRgba(color,0.025+coverage*0.20)
        ctx.fillRect(px,py,pw,ph)
      }
    }else{
      for(const c of chunksRef.current||[]){
        const cx=Number(c.cx),cy=Number(c.cy)
        const chunkX=cx*CHUNK,chunkY=cy*CHUNK
        if(chunkX>vx1||chunkX+CHUNK<vx0||chunkY>vy1||chunkY+CHUNK<vy0)continue

        for(const group of c.groups||[]){
          ctx.fillStyle=hexToRgba(colors[group.user_id]||'#3b82f6',0.34)
          for(const run of group.runs||[]){
            let idx=Number(run?.[0]||0)
            let left=Number(run?.[1]||0)
            while(left>0){
              const row=Math.floor(idx/CHUNK)
              const col=idx%CHUNK
              const take=Math.min(left,CHUNK-col)
              const gx=chunkX+col
              const gy=chunkY+row
              ctx.fillRect(
                xFor(gx),
                yFor(gy),
                Math.max(0.6,take*cellPxX),
                Math.max(0.6,cellPxY)
              )
              idx+=take
              left-=take
            }
          }
        }

        if(c.treasure_runs?.length){
          ctx.fillStyle='rgba(244,197,66,.72)'
          for(const run of c.treasure_runs){
            let idx=Number(run?.[0]||0)
            let left=Number(run?.[1]||0)
            while(left>0){
              const row=Math.floor(idx/CHUNK)
              const col=idx%CHUNK
              const take=Math.min(left,CHUNK-col)
              ctx.fillRect(
                xFor(chunkX+col),
                yFor(chunkY+row),
                Math.max(1,take*cellPxX),
                Math.max(1,cellPxY)
              )
              idx+=take
              left-=take
            }
          }
        }
      }
    }

    // Das Raster bleibt immer sichtbar. Wenn echte Zellen unter Pixelgröße fallen,
    // zeigen wir nur jede 2./4./8... Linie als Hauptraster – die Feldgeometrie selbst
    // bleibt dabei unverändert.
    const basePx=Math.max(.01,Math.min(Math.abs(cellPxX),Math.abs(cellPxY)))
    let stride=1
    while(basePx*stride<15&&stride<4096)stride*=2
    if(stride!==gridStrideRef.current){gridStrideRef.current=stride;setGridStride(stride)}

    const startX=Math.max(0,Math.floor(vx0/stride)*stride)
    const endX=Math.min(g.width,Math.ceil((vx1+1)/stride)*stride)
    const startY=Math.max(0,Math.floor(vy0/stride)*stride)
    const endY=Math.min(g.height,Math.ceil((vy1+1)/stride)*stride)

    ctx.beginPath()
    for(let x=startX;x<=endX;x+=stride){
      const px=xFor(x)
      ctx.moveTo(px,yFor(startY))
      ctx.lineTo(px,yFor(endY))
    }
    for(let y=startY;y<=endY;y+=stride){
      const py=yFor(y)
      ctx.moveTo(xFor(startX),py)
      ctx.lineTo(xFor(endX),py)
    }
    ctx.strokeStyle=renderModeRef.current==='detail'?'rgba(235,242,250,.42)':'rgba(235,242,250,.30)'
    ctx.lineWidth=basePx>=8?0.85:0.65
    ctx.stroke()

    // Spielgebietsrand: immer klar erkennbar, unabhängig vom Zoom.
    const bx=Math.min(nw.x,se.x)
    const by=Math.min(nw.y,se.y)
    const bw=Math.abs(se.x-nw.x)
    const bh=Math.abs(se.y-nw.y)

    // dunkler Schatten/Kontrast unter der hellen Linie
    ctx.strokeStyle='rgba(4,10,18,.78)'
    ctx.lineWidth=4
    ctx.strokeRect(bx,by,bw,bh)

    // eigentliche deutlich sichtbare Spielfeldkante
    ctx.strokeStyle='rgba(248,250,252,.94)'
    ctx.lineWidth=1.8
    ctx.strokeRect(bx,by,bw,bh)

    // V6.29: Assistentenroute nur lokal zeichnen – kein Netzwerkverkehr.
    const route=assistantWaypointsRef.current||[]
    const pos=assistantPositionRef.current
    if(route.length){
      ctx.save()
      ctx.strokeStyle='rgba(255,214,82,.95)'
      ctx.fillStyle='rgba(255,214,82,.95)'
      ctx.lineWidth=2.2
      ctx.setLineDash([6,5])
      ctx.beginPath()
      route.forEach((p,i)=>{
        const px=xFor(Number(p.x)+0.5)
        const py=yFor(Number(p.y)+0.5)
        if(i===0)ctx.moveTo(px,py);else ctx.lineTo(px,py)
      })
      ctx.stroke()
      ctx.setLineDash([])
      route.forEach((p,i)=>{
        const px=xFor(Number(p.x)+0.5)
        const py=yFor(Number(p.y)+0.5)
        ctx.beginPath()
        ctx.arc(px,py,5,0,Math.PI*2)
        ctx.fill()
        ctx.fillStyle='rgba(10,18,28,.95)'
        ctx.font='10px sans-serif'
        ctx.textAlign='center'
        ctx.textBaseline='middle'
        ctx.fillText(String(i+1),px,py)
        ctx.fillStyle='rgba(255,214,82,.95)'
      })
      ctx.restore()
    }
    if(pos){
      const px=xFor(Number(pos.x)+0.5)
      const py=yFor(Number(pos.y)+0.5)
      ctx.save()
      ctx.fillStyle='rgba(255,255,255,.98)'
      ctx.strokeStyle='rgba(12,20,30,.95)'
      ctx.lineWidth=2
      ctx.beginPath()
      ctx.arc(px,py,7,0,Math.PI*2)
      ctx.fill();ctx.stroke()
      ctx.fillStyle='rgba(12,20,30,.95)'
      ctx.font='11px sans-serif'
      ctx.textAlign='center';ctx.textBaseline='middle'
      ctx.fillText('A',px,py)
      ctx.restore()
    }

    ctx.restore()
  }

  async function performExploreAt(x,y){
    const map=mapRef.current
    const cg=geometry(gameRef.current)
    if(!map||!cg)return {success:false,reason:'map_not_ready'}
    if(x<0||y<0||x>=cg.width||y>=cg.height)return {success:false,reason:'outside'}

    const ignored=['analysis-zone-fill','analysis-zone-line','my-traps-fill','my-traps-line']
    const classifyCell=(cx,cy)=>{
      const key=`${cx}:${cy}:${mapModeRef.current}`
      const cached=terrainCacheRef.current.get(key)
      if(cached)return cached
      try{
        const [w,so,ea,n]=cellBounds(cg,cx,cy,1)
        const center=map.project([(w+ea)/2,(so+n)/2])
        const features=map.queryRenderedFeatures(center)||[]
        const result=terrainFromFeatures(
          features.filter(f=>!ignored.includes(f.layer?.id))
        )
        if(terrainCacheRef.current.size>6000)terrainCacheRef.current.clear()
        terrainCacheRef.current.set(key,result)
        return result
      }catch{
        return {type:'unknown',label:'❓ Unbekannt'}
      }
    }

    const terrain=classifyCell(x,y)
    const nominal=Math.max(1,Number(terrainScanPowerRef.current||1))
    const target=Math.min(2400,Math.max(nominal,Math.ceil(nominal*2.25)))
    const cells=[]
    let r=0
    while(cells.length<target&&r<Math.max(cg.width,cg.height)){
      for(let dy=-r;dy<=r&&cells.length<target;dy++){
        for(let dx=-r;dx<=r&&cells.length<target;dx++){
          if(r>0&&Math.max(Math.abs(dx),Math.abs(dy))!==r)continue
          const cx=x+dx,cy=y+dy
          if(cx<0||cy<0||cx>=cg.width||cy>=cg.height)continue
          const t=classifyCell(cx,cy)
          cells.push({x:cx,y:cy,terrain_type:t.type,terrain_label:t.label})
        }
      }
      r++
    }

    try{await onTerrainBatchRef.current?.(cells)}catch{}
    if(onTerrainRevealRef.current){
      const result=await onTerrainRevealRef.current(x,y,terrain)
      return result||{success:true}
    }
    const result=await onRevealRef.current?.(x,y)
    return result||{success:true}
  }

  useEffect(()=>{
    if(!game||!holder.current||mapRef.current)return
    let cancelled=false
    let slowTimer=null

    ;(async()=>{
      try{
        const maplibregl=await import('maplibre-gl')
        if(cancelled)return

        const g=geometry(game)
        const map=new maplibregl.Map({
          container:holder.current,
          style:SATELLITE_STYLE,
          center:[g.lon,g.lat],
          zoom:10,
          attributionControl:true,
          maxPitch:0
        })

        mapRef.current=map
        map.addControl(new maplibregl.NavigationControl({showCompass:false}),'top-right')

        let fitted=false
        function setupMapLayers(){
          if(cancelled)return
          clearTimeout(slowTimer)
          setStatus('')
          if(!fitted){
            map.fitBounds([[g.west,g.south],[g.east,g.north]],{
              padding:35,duration:0,maxZoom:17
            })
            fitted=true
          }
          if(!map.getSource('analysis-zone')){
            map.addSource('analysis-zone',{
              type:'geojson',
              data:analysisCollection(analysisRef.current)
            })
            map.addLayer({
              id:'analysis-zone-fill',type:'fill',source:'analysis-zone',
              paint:{'fill-color':'#f3c54b','fill-opacity':0}
            })
            map.addLayer({
              id:'analysis-zone-line',type:'line',source:'analysis-zone',
              paint:{'line-color':'#f3c54b','line-opacity':0,'line-width':0}
            })
          }
          if(!map.getSource('my-traps')){
            map.addSource('my-traps',{
              type:'geojson',
              data:trapCollection(gameRef.current,ownTrapsRef.current)
            })
            map.addLayer({
              id:'my-traps-fill',type:'fill',source:'my-traps',
              paint:{'fill-color':'#e05275','fill-opacity':0.45}
            })
            map.addLayer({
              id:'my-traps-line',type:'line',source:'my-traps',
              paint:{'line-color':'#ff87a4','line-width':2}
            })
          }
          updateViewport()
          scheduleCanvasDraw()
        }

        map.on('load',setupMapLayers)
        map.on('style.load',()=>{
          if(!map.getSource('analysis-zone'))setupMapLayers()
        })

        slowTimer=setTimeout(()=>{
          if(cancelled)return
          if(!map.isStyleLoaded?.()){
            setStatus('Kartenserver langsam – wechsle auf Ersatzkarte…')
            try{map.setStyle(FALLBACK_STYLE)}catch{}
          }
        },7000)

        map.on('render',scheduleCanvasDraw)
        map.on('moveend',updateViewport)
        map.on('resize',()=>{resizeCanvas();scheduleCanvasDraw()})

        map.on('click',async e=>{
          const cg=geometry(gameRef.current)
          const x=Math.floor((e.lngLat.lng-cg.west)*cg.metersLon/cg.cell)
          const y=Math.floor((cg.north-e.lngLat.lat)*METERS_PER_DEG_LAT/cg.cell)
          if(x<0||y<0||x>=cg.width||y>=cg.height)return

          if(waypointModeRef.current){
            onWaypointRef.current?.(x,y)
            return
          }

          if(trapModeRef.current){
            onTrapPlaceRef.current?.(x,y)
            return
          }

          await performExploreAt(x,y)
        })

        function updateViewport(){
          const cg=geometry(gameRef.current)
          const b=map.getBounds()
          const zoom=map.getZoom()
          let cellScreenPx=0
          try{
            const p0=map.project([cg.west,cg.north])
            const px=map.project([cg.west+cg.cell/cg.metersLon,cg.north])
            const py=map.project([cg.west,cg.north-cg.cell/METERS_PER_DEG_LAT])
            cellScreenPx=Math.min(Math.abs(px.x-p0.x),Math.abs(py.y-p0.y))
          }catch{}

          // Nicht die Zoomnummer entscheidet, sondern wie groß ein echtes Spielfeld
          // auf diesem Gerät tatsächlich ist. So bleiben auch 10-m- und 500-m-Karten performant.
          let mode=renderModeRef.current
          if(mode==='overview'&&cellScreenPx>=3.5)mode='detail'
          else if(mode==='detail'&&cellScreenPx<2.25)mode='overview'

          if(mode!==renderModeRef.current){
            renderModeRef.current=mode
            setRenderMode(mode)
          }

          const x0=Math.max(0,Math.floor((b.getWest()-cg.west)*cg.metersLon/cg.cell))
          const x1=Math.min(cg.width-1,Math.ceil((b.getEast()-cg.west)*cg.metersLon/cg.cell))
          const y0=Math.max(0,Math.floor((cg.north-b.getNorth())*METERS_PER_DEG_LAT/cg.cell))
          const y1=Math.min(cg.height-1,Math.ceil((cg.north-b.getSouth())*METERS_PER_DEG_LAT/cg.cell))

          if(x1>=x0&&y1>=y0){
            viewportRef.current?.({x0,x1,y0,y1,mode,zoom})
          }
          scheduleCanvasDraw()
        }
      }catch{
        if(!cancelled)setStatus('Karte konnte nicht gestartet werden. Bitte Seite neu laden.')
      }
    })()

    return()=>{
      cancelled=true
      clearTimeout(slowTimer)
      mapRef.current?.remove()
      mapRef.current=null
    }
  },[game?.id])

  useEffect(()=>{
    const target=assistantTarget
    if(!target?.token)return
    if(lastAssistantTokenRef.current===target.token)return
    lastAssistantTokenRef.current=target.token
    let cancelled=false
    ;(async()=>{
      const result=await performExploreAt(Number(target.x),Number(target.y))
      if(!cancelled)onAssistantStepDoneRef.current?.(result||{success:false})
    })()
    return()=>{cancelled=true}
  },[assistantTarget?.token])

  useEffect(()=>{
    scheduleCanvasDraw()
  },[assistantWaypoints,assistantPosition])

  useEffect(()=>{
    renderModeRef.current=mapRenderMode
    setRenderMode(mapRenderMode)
    scheduleCanvasDraw()
  },[mapRenderMode])

  useEffect(()=>{
    scheduleCanvasDraw()
  },[mapChunks,players,game?.id])

  useEffect(()=>{
    const map=mapRef.current
    if(!map)return
    const apply=()=>{
      const src=map.getSource('analysis-zone')
      if(src)src.setData(analysisCollection(analysisRef.current))
    }
    if(map.loaded())apply();else map.once('load',apply)
  },[analysisHint])

  useEffect(()=>{
    const map=mapRef.current
    const src=map?.getSource?.('my-traps')
    if(src)src.setData(trapCollection(gameRef.current,ownTraps))
  },[ownTraps])

  useEffect(()=>{
    const map=mapRef.current
    const h=analysisHint
    if(!map||!h?.lat||!h?.lon||!analysisFocusToken)return
    const focus=()=>{
      try{
        const lat=Number(h.lat)
        const lon=Number(h.lon)
        const radius=Math.max(100,Number(h.radius_m||500))
        const metersLon=Math.max(1000,METERS_PER_DEG_LAT*Math.cos(lat*Math.PI/180))
        const dLat=radius/METERS_PER_DEG_LAT
        const dLon=radius/metersLon
        const oldCenter=map.getCenter()
        const oldZoom=map.getZoom()

        map.fitBounds([[lon-dLon,lat-dLat],[lon+dLon,lat+dLat]],{
          padding:55,duration:650,maxZoom:17
        })
        map.once('idle',()=>{
          try{
            const center=map.project([lon,lat])
            const east=map.project([lon+dLon,lat])
            const px=Math.max(35,Math.min(220,Math.abs(east.x-center.x)))
            const features=map.queryRenderedFeatures([
              [center.x-px,center.y-px],
              [center.x+px,center.y+px]
            ])||[]
            const seen=new Set(),items=[]
            for(const f of features){
              if(['analysis-zone-fill','analysis-zone-line'].includes(f.layer?.id))continue
              const pp=f.properties||{}
              const name=pp.name_de||pp.name||pp['name:de']||pp.ref
              if(!name)continue
              const key=String(name).toLowerCase()
              if(seen.has(key))continue
              seen.add(key)
              items.push({
                name:String(name),
                kind:String(pp.class||pp.type||pp.subclass||f.sourceLayer||'Kartenmerkmal')
              })
              if(items.length>=10)break
            }
            analysisFeaturesRef.current?.(items)
          }catch{
            analysisFeaturesRef.current?.([])
          }finally{
            try{map.jumpTo({center:oldCenter,zoom:oldZoom})}catch{}
          }
        })
      }catch{}
    }
    if(map.loaded())focus();else map.once('load',focus)
  },[analysisFocusToken])

  function centerOnGame(){
    const map=mapRef.current
    const cg=gameRef.current
    if(!map||!cg)return
    const g=geometry(cg)
    try{
      map.fitBounds([[g.west,g.south],[g.east,g.north]],{
        padding:36,maxZoom:15,duration:650
      })
    }catch{}
  }

  function switchMapMode(mode){
    const map=mapRef.current
    if(!map||mode===mapMode)return
    setMapMode(mode)
    mapModeRef.current=mode
    terrainCacheRef.current.clear()
    setStatus(mode==='satellite'?'Satellitenkarte wird geladen…':'Karte wird geladen…')
    try{
      map.setStyle(mode==='satellite'?SATELLITE_STYLE:MAP_STYLE)
      if(mode==='satellite'){
        setTimeout(()=>{
          if(mapModeRef.current==='satellite'&&!map.isStyleLoaded?.()){
            setStatus('Satellitenquelle langsam – zurück zur Karte…')
            setMapMode('map')
            mapModeRef.current='map'
            try{map.setStyle(MAP_STYLE)}catch{}
          }
        },8000)
      }
    }catch{
      setStatus('Kartenstil konnte nicht gewechselt werden.')
    }
  }

  return <div className="worldMapShell">
    <div ref={holder} className="worldMap"/>
    <canvas ref={canvasRef} className="gameCanvasOverlay" aria-hidden="true"/>
    {mobileHud}
    <div className="mapModeSwitch">
      <button type="button" className="mapModeIconBtn" title={mapMode==='map'?'Satellitenansicht':'Kartenansicht'}
       aria-label={mapMode==='map'?'Satellitenansicht':'Kartenansicht'}
       onClick={()=>switchMapMode(mapMode==='map'?'satellite':'map')}>
       {mapMode==='map'?'🛰️':'🗺️'}
      </button>
    </div>
    <button type="button" className="mapCenterBtn" onClick={centerOnGame}>◎ Zum Spielfeld</button>
    {mapInfo&&<div className="mapInfoDock">{mapInfo}</div>}
    {status&&<div className="mapLoadingOverlay">{status}</div>}
  </div>
}
