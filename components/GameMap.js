'use client'
import {useEffect,useRef,useState} from 'react'

const METERS_PER_DEG_LAT=111320
const TARGET_VISIBLE_BUCKETS=1000
const MAP_STYLE='https://tiles.openfreemap.org/styles/liberty'
const SATELLITE_STYLE={
  version:8,
  sources:{
    satellite:{
      type:'raster',
      tiles:['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
      tileSize:256,
      attribution:'Esri, Maxar, Earthstar Geographics, and the GIS User Community'
    }
  },
  layers:[{id:'satellite-base',type:'raster',source:'satellite'}]
}
const FALLBACK_STYLE={
  version:8,
  sources:{osm:{type:'raster',tiles:['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],tileSize:256,attribution:'© OpenStreetMap contributors'}},
  layers:[{id:'osm',type:'raster',source:'osm'}]
}

function geometry(game){
  const lat=Number(game.center_lat||0)
  const lon=Number(game.center_lon||0)
  const cell=Number(game.cell_size_m||100)
  const width=Number(game.width||100)
  const height=Number(game.height||100)
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

function playerColors(players){
  const colors={}
  ;(players||[]).forEach((p,i)=>{
    colors[p.user_id]=p.player_color||['#3b82f6','#22c55e','#a855f7','#ef4444'][i%4]
  })
  return colors
}

function cellCollection(game,fields,players){
  if(!game)return {type:'FeatureCollection',features:[]}
  const g=geometry(game)
  const colors=playerColors(players)
  return {
    type:'FeatureCollection',
    features:(fields||[]).map(f=>{
      const [w,s,e,n]=cellBounds(g,Number(f.x),Number(f.y),1)
      return {
        type:'Feature',
        properties:{
          color:f.is_treasure?'#f4c542':(colors[f.discovered_by]||'#3b82f6')
        },
        geometry:{type:'Polygon',coordinates:[[[w,s],[e,s],[e,n],[w,n],[w,s]]]}
      }
    })
  }
}

function chunkCollection(game,chunks,players){
  if(!game)return {type:'FeatureCollection',features:[]}
  const g=geometry(game)
  const colors=playerColors(players)
  return {
    type:'FeatureCollection',
    features:(chunks||[]).map(c=>{
      const wCells=Math.max(1,Number(c.w||c.chunk_size||32))
      const hCells=Math.max(1,Number(c.h||c.chunk_size||32))
      const west=g.west+Number(c.x)*g.cell/g.metersLon
      const east=g.west+(Number(c.x)+wCells)*g.cell/g.metersLon
      const north=g.north-Number(c.y)*g.cell/METERS_PER_DEG_LAT
      const south=g.north-(Number(c.y)+hCells)*g.cell/METERS_PER_DEG_LAT
      return {
        type:'Feature',
        properties:{
          color:colors[c.discovered_by]||'#3b82f6',
          coverage:Math.max(0,Math.min(1,Number(c.coverage||0))),
          explored_count:Number(c.explored_count||0)
        },
        geometry:{type:'Polygon',coordinates:[[[west,south],[east,south],[east,north],[west,north],[west,south]]]}
      }
    })
  }
}

function trapCollection(game,traps){
  if(!game)return {type:'FeatureCollection',features:[]}
  const g=geometry(game)
  return {type:'FeatureCollection',features:(traps||[]).map(t=>{
    const [w,s,e,n]=cellBounds(g,Number(t.x),Number(t.y),1)
    return {type:'Feature',properties:{label:'🪤',trap_type:t.trap_type},
      geometry:{type:'Polygon',coordinates:[[[w,s],[e,s],[e,n],[w,n],[w,s]]]}}
  })}
}

function analysisCollection(h){
  if(!h?.lat||!h?.lon||!h?.radius_m)return {type:'FeatureCollection',features:[]}
  const steps=48,coords=[]
  const lat=Number(h.lat),lon=Number(h.lon),radius=Number(h.radius_m)
  const metersLon=Math.max(1000,METERS_PER_DEG_LAT*Math.cos(lat*Math.PI/180))
  for(let i=0;i<=steps;i++){
    const a=(i/steps)*Math.PI*2
    coords.push([lon+Math.cos(a)*radius/metersLon,lat+Math.sin(a)*radius/METERS_PER_DEG_LAT])
  }
  return {type:'FeatureCollection',features:[{type:'Feature',properties:{},geometry:{type:'Polygon',coordinates:[coords]}}]}
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

export default function GameMap({game,fields,chunks=[],mapRenderMode='overview',players,onReveal,onTerrainReveal,onTerrainBatch,terrainScanPower=1,onTrapPlace,trapMode,ownTraps=[],analysisHint,onViewportChange,analysisFocusToken,onAnalysisFeatures,mobileHud}){
  const holder=useRef(null)
  const mapRef=useRef(null)
  const gameRef=useRef(game)
  const fieldsRef=useRef(fields)
  const chunksRef=useRef(chunks)
  const playersRef=useRef(players)
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
  const mapModeRef=useRef('map')
  const renderModeRef=useRef(mapRenderMode)
  const [status,setStatus]=useState('Karte wird geladen…')
  const [mapMode,setMapMode]=useState('map')
  const [renderMode,setRenderMode]=useState(mapRenderMode)

  gameRef.current=game
  fieldsRef.current=fields
  chunksRef.current=chunks
  playersRef.current=players
  onRevealRef.current=onReveal
  onTerrainRevealRef.current=onTerrainReveal
  onTerrainBatchRef.current=onTerrainBatch
  terrainScanPowerRef.current=terrainScanPower
  onTrapPlaceRef.current=onTrapPlace
  trapModeRef.current=trapMode
  ownTrapsRef.current=ownTraps
  analysisRef.current=analysisHint
  viewportRef.current=onViewportChange
  analysisFeaturesRef.current=onAnalysisFeatures
  mapModeRef.current=mapMode
  renderModeRef.current=mapRenderMode
  const playerColorKey=players.map(p=>`${p.user_id}:${p.player_color||''}`).join('|')

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
          style:MAP_STYLE,
          center:[g.lon,g.lat],
          zoom:10,
          attributionControl:true,
          maxPitch:0
        })

        mapRef.current=map
        map.addControl(new maplibregl.NavigationControl({showCompass:false}),'top-right')

        let fitted=false
        function setupGameLayers(){
          if(cancelled)return
          clearTimeout(slowTimer)
          setStatus('')
          if(!fitted){
            map.fitBounds([[g.west,g.south],[g.east,g.north]],{padding:35,duration:0,maxZoom:17})
            fitted=true
          }
          if(!map.getSource('explored-cells')){
            map.addSource('explored-cells',{type:'geojson',data:cellCollection(gameRef.current,fieldsRef.current,playersRef.current)})
            map.addLayer({id:'explored-fill',type:'fill',source:'explored-cells',paint:{'fill-color':['get','color'],'fill-opacity':0.62}})
            map.addLayer({id:'explored-outline',type:'line',source:'explored-cells',paint:{'line-color':'#ffffff','line-opacity':0.22,'line-width':0.55}})
          }
          if(!map.getSource('explored-chunks')){
            map.addSource('explored-chunks',{type:'geojson',data:chunkCollection(gameRef.current,chunksRef.current,playersRef.current)})
            map.addLayer({
              id:'coverage-fill',type:'fill',source:'explored-chunks',
              paint:{
                'fill-color':['get','color'],
                'fill-opacity':['interpolate',['linear'],['get','coverage'],0,0,0.05,0.10,0.35,0.28,0.7,0.46,1,0.62]
              }
            })
            map.addLayer({
              id:'coverage-outline',type:'line',source:'explored-chunks',
              paint:{'line-color':['get','color'],'line-opacity':0.12,'line-width':0.35}
            })
          }
          if(!map.getSource('grid')){
            map.addSource('grid',{type:'geojson',data:{type:'FeatureCollection',features:[]}})
            map.addLayer({id:'grid-lines',type:'line',source:'grid',paint:{'line-color':'#132238','line-opacity':0.68,'line-width':0.65}})
          }
          if(!map.getSource('analysis-zone')){
            map.addSource('analysis-zone',{type:'geojson',data:analysisCollection(analysisRef.current)})
            map.addLayer({id:'analysis-zone-fill',type:'fill',source:'analysis-zone',paint:{'fill-color':'#f3c54b','fill-opacity':0}})
            map.addLayer({id:'analysis-zone-line',type:'line',source:'analysis-zone',paint:{'line-color':'#f3c54b','line-opacity':0,'line-width':0}})
          }
          if(!map.getSource('my-traps')){
            map.addSource('my-traps',{type:'geojson',data:trapCollection(gameRef.current,ownTrapsRef.current)})
            map.addLayer({id:'my-traps-fill',type:'fill',source:'my-traps',paint:{'fill-color':'#e05275','fill-opacity':0.45}})
            map.addLayer({id:'my-traps-line',type:'line',source:'my-traps',paint:{'line-color':'#ff87a4','line-width':2}})
          }
          updateGridAndViewport()
        }

        map.on('load',setupGameLayers)
        map.on('style.load',()=>{
          if(!map.getSource('explored-cells'))setupGameLayers()
        })

        slowTimer=setTimeout(()=>{
          if(cancelled)return
          if(!map.isStyleLoaded?.()){
            setStatus('Kartenserver langsam – wechsle auf Ersatzkarte…')
            try{map.setStyle(FALLBACK_STYLE)}catch{}
          }
        },7000)

        map.on('moveend',updateGridAndViewport)

        map.on('click',async(e)=>{
          const cg=geometry(gameRef.current)
          const x=Math.floor((e.lngLat.lng-cg.west)*cg.metersLon/cg.cell)
          const y=Math.floor((cg.north-e.lngLat.lat)*METERS_PER_DEG_LAT/cg.cell)
          if(x<0||y<0||x>=cg.width||y>=cg.height)return
          if(trapModeRef.current){onTrapPlaceRef.current?.(x,y);return}

          const ignored=['explored-fill','explored-outline','coverage-fill','coverage-outline','grid-lines','analysis-zone-fill','analysis-zone-line','my-traps-fill','my-traps-line']
          const classifyCell=(cx,cy)=>{
            try{
              const [w,so,ea,n]=cellBounds(cg,cx,cy,1)
              const center=map.project([(w+ea)/2,(so+n)/2])
              const features=map.queryRenderedFeatures(center)||[]
              return terrainFromFeatures(features.filter(f=>!ignored.includes(f.layer?.id)))
            }catch{
              return {type:'unknown',label:'❓ Unbekannt'}
            }
          }

          const terrain=classifyCell(x,y)

          // Vor einem großen Suchzug werden die nächstgelegenen Felder vermessen.
          // Der Server deckt anschließend nur vermessene + erlaubte Terrainfelder auf.
          const target=Math.min(1500,Math.max(1,Number(terrainScanPowerRef.current||1)))
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
          if(onTerrainRevealRef.current)await onTerrainRevealRef.current(x,y,terrain)
          else onRevealRef.current?.(x,y)
        })

        function collectAnalysisFeatures(){
          const h=analysisRef.current
          if(!h?.lat||!h?.lon||!map.isStyleLoaded?.())return
          try{
            const center=map.project([Number(h.lon),Number(h.lat)])
            const metersLon=Math.max(1000,METERS_PER_DEG_LAT*Math.cos(Number(h.lat)*Math.PI/180))
            const east=map.project([Number(h.lon)+Number(h.radius_m||500)/metersLon,Number(h.lat)])
            const px=Math.max(35,Math.min(220,Math.abs(east.x-center.x)))
            const features=map.queryRenderedFeatures([
              [center.x-px,center.y-px],
              [center.x+px,center.y+px]
            ])||[]
            const seen=new Set(),items=[]
            for(const f of features){
              if(['explored-fill','explored-outline','coverage-fill','coverage-outline','grid-lines','analysis-zone-fill','analysis-zone-line'].includes(f.layer?.id))continue
              const p=f.properties||{}
              const name=p.name_de||p.name||p['name:de']||p.ref
              if(!name)continue
              const kind=p.class||p.type||p.subclass||f.sourceLayer||'Kartenmerkmal'
              const key=String(name).toLowerCase()
              if(seen.has(key))continue
              seen.add(key)
              items.push({name:String(name),kind:String(kind)})
              if(items.length>=10)break
            }
            analysisFeaturesRef.current?.(items)
          }catch{
            analysisFeaturesRef.current?.([])
          }
        }

        function updateGridAndViewport(){
          if(!map.getSource('grid'))return
          const cg=geometry(gameRef.current)
          const b=map.getBounds()
          const zoom=map.getZoom()

          // Stabile Hysterese. Der Modus ändert sich nicht während eines Zoom-Gestures.
          let mode=renderModeRef.current
          if(mode==='overview'&&zoom>=12.25)mode='detail'
          else if(mode==='detail'&&zoom<11.25)mode='overview'

          if(mode!==renderModeRef.current){
            renderModeRef.current=mode
            setRenderMode(mode)
          }

          let x0=Math.max(0,Math.floor((b.getWest()-cg.west)*cg.metersLon/cg.cell))
          let x1=Math.min(cg.width-1,Math.ceil((b.getEast()-cg.west)*cg.metersLon/cg.cell))
          let y0=Math.max(0,Math.floor((cg.north-b.getNorth())*METERS_PER_DEG_LAT/cg.cell))
          let y1=Math.min(cg.height-1,Math.ceil((cg.north-b.getSouth())*METERS_PER_DEG_LAT/cg.cell))

          if(x1<x0||y1<y0)return

          if(mode==='detail'){
            // 64er Kacheln stabilisieren den Cache beim kleinen Verschieben.
            const tile=64
            x0=Math.max(0,Math.floor(x0/tile)*tile)
            y0=Math.max(0,Math.floor(y0/tile)*tile)
            x1=Math.min(cg.width-1,Math.ceil((x1+1)/tile)*tile-1)
            y1=Math.min(cg.height-1,Math.ceil((y1+1)/tile)*tile-1)
          }else{
            // Übersicht wird als kompakte Coverage für das ganze Spiel gehalten.
            x0=0;y0=0;x1=cg.width-1;y1=cg.height-1
          }

          viewportRef.current?.({x0,x1,y0,y1,mode,zoom})

          const gridFeatures=[]
          if(mode==='detail'){
            // Raster ist rein clientseitig – null DB-/Netzwerktraffic.
            for(let x=x0;x<=x1+1;x++){
              const lon=cg.west+x*cg.cell/cg.metersLon
              gridFeatures.push({type:'Feature',properties:{},geometry:{type:'LineString',coordinates:[[lon,cg.south],[lon,cg.north]]}})
            }
            for(let y=y0;y<=y1+1;y++){
              const lat=cg.north-y*cg.cell/METERS_PER_DEG_LAT
              gridFeatures.push({type:'Feature',properties:{},geometry:{type:'LineString',coordinates:[[cg.west,lat],[cg.east,lat]]}})
            }
          }
          map.getSource('grid').setData({type:'FeatureCollection',features:gridFeatures})

          // Layer statt Geometrie austauschen: kein "Feldgrößen-Springen".
          const detailVisible=mode==='detail'?'visible':'none'
          const overviewVisible=mode==='overview'?'visible':'none'
          for(const id of ['explored-fill','explored-outline','grid-lines']){
            if(map.getLayer(id))map.setLayoutProperty(id,'visibility',detailVisible)
          }
          for(const id of ['coverage-fill','coverage-outline']){
            if(map.getLayer(id))map.setLayoutProperty(id,'visibility',overviewVisible)
          }
        }
      }catch(err){
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
    const map=mapRef.current
    if(!map)return
    renderModeRef.current=mapRenderMode
    setRenderMode(mapRenderMode)
    const detailVisible=mapRenderMode==='detail'?'visible':'none'
    const overviewVisible=mapRenderMode==='overview'?'visible':'none'
    const apply=()=>{
      for(const id of ['explored-fill','explored-outline','grid-lines']){
        if(map.getLayer(id))map.setLayoutProperty(id,'visibility',detailVisible)
      }
      for(const id of ['coverage-fill','coverage-outline']){
        if(map.getLayer(id))map.setLayoutProperty(id,'visibility',overviewVisible)
      }
    }
    if(map.loaded())apply();else map.once('load',apply)
  },[mapRenderMode])

  useEffect(()=>{
    const map=mapRef.current
    if(!map)return
    const apply=()=>{
      const cellSrc=map.getSource('explored-cells')
      if(cellSrc)cellSrc.setData(cellCollection(gameRef.current,fieldsRef.current,playersRef.current))
      const chunkSrc=map.getSource('explored-chunks')
      if(chunkSrc)chunkSrc.setData(chunkCollection(gameRef.current,chunksRef.current,playersRef.current))
    }
    if(map.loaded())apply();else map.once('load',apply)
  },[fields,chunks,playerColorKey,game?.id])

  useEffect(()=>{
    const map=mapRef.current
    if(!map)return
    const apply=()=>{
      const src=map.getSource('analysis-zone')
      if(src)src.setData(analysisCollection(analysisRef.current))
    }
    if(map.loaded())apply();else map.once('load',apply)
  },[analysisHint])

  function centerOnGame(){
    const map=mapRef.current
    const cg=gameRef.current
    if(!map||!cg)return
    const g=geometry(cg)
    try{
      map.fitBounds([[g.west,g.south],[g.east,g.north]],{
        padding:36,
        maxZoom:15,
        duration:650
      })
    }catch{}
  }

  function switchMapMode(mode){
    const map=mapRef.current
    if(!map||mode===mapMode)return
    setMapMode(mode)
    mapModeRef.current=mode
    setStatus(mode==='satellite'?'Satellitenkarte wird geladen…':'Karte wird geladen…')
    try{
      map.setStyle(mode==='satellite'?SATELLITE_STYLE:MAP_STYLE)
      if(mode==='satellite'){
        setTimeout(()=>{
          if(mapModeRef.current==='satellite'&&!map.isStyleLoaded?.()){
            setStatus('Satellitenquelle langsam – zurück zur Karte…')
            setMapMode('map');mapModeRef.current='map'
            try{map.setStyle(MAP_STYLE)}catch{}
          }
        },8000)
      }
    }catch{
      setStatus('Kartenstil konnte nicht gewechselt werden.')
    }
  }

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
        const lat=Number(h.lat),lon=Number(h.lon),radius=Math.max(100,Number(h.radius_m||500))
        const metersLon=Math.max(1000,METERS_PER_DEG_LAT*Math.cos(lat*Math.PI/180))
        const dLat=radius/METERS_PER_DEG_LAT
        const dLon=radius/metersLon
        map.fitBounds([[lon-dLon,lat-dLat],[lon+dLon,lat+dLat]],{padding:55,duration:650,maxZoom:17})
        const oldCenter=map.getCenter(),oldZoom=map.getZoom()
        map.once('idle',()=>{
          try{
            const center=map.project([lon,lat])
            const east=map.project([lon+dLon,lat])
            const px=Math.max(35,Math.min(220,Math.abs(east.x-center.x)))
            const features=map.queryRenderedFeatures([[center.x-px,center.y-px],[center.x+px,center.y+px]])||[]
            const seen=new Set(),items=[]
            for(const f of features){
              if(['explored-fill','explored-outline','coverage-fill','coverage-outline','grid-lines','analysis-zone-fill','analysis-zone-line'].includes(f.layer?.id))continue
              const p=f.properties||{}
              const name=p.name_de||p.name||p['name:de']||p.ref
              if(!name)continue
              const key=String(name).toLowerCase()
              if(seen.has(key))continue
              seen.add(key)
              items.push({name:String(name),kind:String(p.class||p.type||p.subclass||f.sourceLayer||'Kartenmerkmal')})
              if(items.length>=10)break
            }
            analysisFeaturesRef.current?.(items)
          }catch{analysisFeaturesRef.current?.([])}
          finally{
            try{map.jumpTo({center:oldCenter,zoom:oldZoom})}catch{}
          }
        })
      }catch{}
    }
    if(map.loaded())focus();else map.once('load',focus)
  },[analysisFocusToken])

  return <div className="worldMapShell">
    <div ref={holder} className="worldMap"/>
    {mobileHud}
    <div className="mapModeSwitch">
      <button type="button" className={'miniBtn '+(mapMode==='map'?'active':'')} onClick={()=>switchMapMode('map')}>🗺️ Karte</button>
      <button type="button" className={'miniBtn '+(mapMode==='satellite'?'active':'')} onClick={()=>switchMapMode('satellite')}>🛰️ Satellit</button>
    </div>
    <button type="button" className="mapCenterBtn" onClick={centerOnGame}>◎ Zum Spielfeld</button>
    <div className="mapRenderModeBadge">
      {renderMode==='detail'?'▦ Einzelzellen':'▧ Flächenübersicht'}
    </div>
    {status&&<div className="mapLoadingOverlay">{status}</div>}
  </div>
}
