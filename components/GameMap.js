'use client'
import {useEffect,useRef,useState} from 'react'

const METERS_PER_DEG_LAT=111320
const TARGET_VISIBLE_BUCKETS=2600
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

function featureCollection(game,fields,players){
  if(!game)return {type:'FeatureCollection',features:[]}
  const g=geometry(game)
  const colors={}
  players.forEach((p,i)=>{
    colors[p.user_id]=p.player_color||['#3b82f6','#22c55e','#a855f7','#ef4444'][i%4]
  })
  return {
    type:'FeatureCollection',
    features:fields.map(f=>{
      const [w,s,e,n]=cellBounds(g,Number(f.x),Number(f.y),Number(f.size||1))
      return {
        type:'Feature',
        properties:{
          color:f.is_treasure?'#f4c542':(colors[f.discovered_by]||'#3b82f6'),
          aggregated:Number(f.size||1)>1
        },
        geometry:{type:'Polygon',coordinates:[[[w,s],[e,s],[e,n],[w,n],[w,s]]]}
      }
    })
  }
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

export default function GameMap({game,fields,players,onReveal,analysisHint,onViewportChange}){
  const holder=useRef(null)
  const mapRef=useRef(null)
  const gameRef=useRef(game)
  const fieldsRef=useRef(fields)
  const playersRef=useRef(players)
  const onRevealRef=useRef(onReveal)
  const analysisRef=useRef(analysisHint)
  const viewportRef=useRef(onViewportChange)
  const [status,setStatus]=useState('Karte wird geladen…')

  gameRef.current=game
  fieldsRef.current=fields
  playersRef.current=players
  onRevealRef.current=onReveal
  analysisRef.current=analysisHint
  viewportRef.current=onViewportChange

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
          style:'https://tiles.openfreemap.org/styles/liberty',
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
          if(!map.getSource('explored')){
            map.addSource('explored',{type:'geojson',data:featureCollection(gameRef.current,fieldsRef.current,playersRef.current)})
            map.addLayer({id:'explored-fill',type:'fill',source:'explored',paint:{'fill-color':['get','color'],'fill-opacity':0.62}})
            map.addLayer({id:'explored-outline',type:'line',source:'explored',paint:{'line-color':'#ffffff','line-opacity':0.28,'line-width':0.7}})
          }
          if(!map.getSource('grid')){
            map.addSource('grid',{type:'geojson',data:{type:'FeatureCollection',features:[]}})
            map.addLayer({id:'grid-lines',type:'line',source:'grid',paint:{'line-color':'#132238','line-opacity':0.68,'line-width':0.65}})
          }
          if(!map.getSource('analysis-zone')){
            map.addSource('analysis-zone',{type:'geojson',data:analysisCollection(analysisRef.current)})
            map.addLayer({id:'analysis-zone-fill',type:'fill',source:'analysis-zone',paint:{'fill-color':'#f3c54b','fill-opacity':0.12}})
            map.addLayer({id:'analysis-zone-line',type:'line',source:'analysis-zone',paint:{'line-color':'#f3c54b','line-opacity':0.9,'line-width':2,'line-dasharray':[2,2]}})
          }
          updateGridAndViewport()
        }

        map.on('load',setupGameLayers)
        map.on('style.load',()=>{
          if(!map.getSource('explored'))setupGameLayers()
        })

        slowTimer=setTimeout(()=>{
          if(cancelled)return
          if(!map.isStyleLoaded?.()){
            setStatus('Kartenserver langsam – wechsle auf Ersatzkarte…')
            try{map.setStyle(FALLBACK_STYLE)}catch{}
          }
        },7000)

        map.on('moveend',updateGridAndViewport)
        map.on('zoomend',updateGridAndViewport)

        map.on('click',(e)=>{
          const cg=geometry(gameRef.current)
          const x=Math.floor((e.lngLat.lng-cg.west)*cg.metersLon/cg.cell)
          const y=Math.floor((cg.north-e.lngLat.lat)*METERS_PER_DEG_LAT/cg.cell)
          if(x>=0&&y>=0&&x<cg.width&&y<cg.height)onRevealRef.current?.(x,y)
        })

        function updateGridAndViewport(){
          if(!map.getSource('grid'))return
          const cg=geometry(gameRef.current)
          const b=map.getBounds()

          let x0=Math.max(0,Math.floor((b.getWest()-cg.west)*cg.metersLon/cg.cell))
          let x1=Math.min(cg.width-1,Math.ceil((b.getEast()-cg.west)*cg.metersLon/cg.cell))
          let y0=Math.max(0,Math.floor((cg.north-b.getNorth())*METERS_PER_DEG_LAT/cg.cell))
          let y1=Math.min(cg.height-1,Math.ceil((cg.north-b.getSouth())*METERS_PER_DEG_LAT/cg.cell))

          if(x1<x0||y1<y0)return
          const cols=x1-x0+1,rows=y1-y0+1
          const area=Math.max(1,cols*rows)
          const step=Math.max(1,Math.ceil(Math.sqrt(area/TARGET_VISIBLE_BUCKETS)))

          // Kleiner Puffer verhindert eine neue DB-Abfrage bei minimalem Verschieben.
          const pad=Math.max(2,step*2)
          viewportRef.current?.({
            x0:Math.max(0,x0-pad),x1:Math.min(cg.width-1,x1+pad),
            y0:Math.max(0,y0-pad),y1:Math.min(cg.height-1,y1+pad),step
          })

          const visible=Math.max(cols,rows,1)
          const gridStep=Math.max(1,Math.ceil(visible/100))
          x0=Math.floor(x0/gridStep)*gridStep
          y0=Math.floor(y0/gridStep)*gridStep
          const features=[]

          for(let x=x0;x<=x1;x+=gridStep){
            const lon=cg.west+x*cg.cell/cg.metersLon
            features.push({type:'Feature',properties:{},geometry:{type:'LineString',coordinates:[[lon,cg.south],[lon,cg.north]]}})
          }
          for(let y=y0;y<=y1;y+=gridStep){
            const lat=cg.north-y*cg.cell/METERS_PER_DEG_LAT
            features.push({type:'Feature',properties:{},geometry:{type:'LineString',coordinates:[[cg.west,lat],[cg.east,lat]]}})
          }
          map.getSource('grid').setData({type:'FeatureCollection',features})
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
    const apply=()=>{
      const src=map.getSource('explored')
      if(src)src.setData(featureCollection(gameRef.current,fieldsRef.current,playersRef.current))
    }
    if(map.loaded())apply();else map.once('load',apply)
  },[fields,players,game])

  useEffect(()=>{
    const map=mapRef.current
    if(!map)return
    const apply=()=>{
      const src=map.getSource('analysis-zone')
      if(src)src.setData(analysisCollection(analysisRef.current))
    }
    if(map.loaded())apply();else map.once('load',apply)
  },[analysisHint])

  return <div className="worldMapShell">
    <div ref={holder} className="worldMap"/>
    {status&&<div className="mapLoadingOverlay">{status}</div>}
  </div>
}
