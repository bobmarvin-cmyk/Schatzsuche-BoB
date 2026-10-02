'use client'
import {useEffect,useRef} from 'react'

const METERS_PER_DEG_LAT=111320
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

function fc(game,fields,players){
  const g=geometry(game)
  const colors={}
  ;(players||[]).forEach((p,i)=>{
    colors[p.user_id]=p.player_color||['#3b82f6','#22c55e','#a855f7','#ef4444'][i%4]
  })
  return {
    type:'FeatureCollection',
    features:(fields||[]).map(f=>{
      const [w,s,e,n]=cellBounds(g,Number(f.x),Number(f.y),Number(f.size||1))
      return {
        type:'Feature',
        properties:{color:f.is_treasure?'#f4c542':(colors[f.discovered_by]||'#3b82f6')},
        geometry:{type:'Polygon',coordinates:[[[w,s],[e,s],[e,n],[w,n],[w,s]]]}
      }
    })
  }
}

export default function ArchiveMap({archive,fields}){
  const holder=useRef(null)
  const mapRef=useRef(null)

  useEffect(()=>{
    if(!archive||!holder.current||mapRef.current)return
    let cancelled=false
    ;(async()=>{
      try{
        const maplibregl=await import('maplibre-gl')
        if(cancelled)return
        const g=geometry(archive)
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
        map.on('load',()=>{
          if(cancelled)return
          map.fitBounds([[g.west,g.south],[g.east,g.north]],{padding:28,duration:0,maxZoom:17})
          map.addSource('archive-fields',{type:'geojson',data:fc(archive,fields,archive.players)})
          map.addLayer({id:'archive-fill',type:'fill',source:'archive-fields',paint:{'fill-color':['get','color'],'fill-opacity':0.68}})
          map.addLayer({id:'archive-line',type:'line',source:'archive-fields',paint:{'line-color':'#ffffff','line-opacity':0.24,'line-width':0.6}})
        })
        setTimeout(()=>{
          if(cancelled)return
          if(!map.isStyleLoaded?.()){
            try{map.setStyle(FALLBACK_STYLE)}catch{}
          }
        },7000)
      }catch{}
    })()
    return()=>{
      cancelled=true
      mapRef.current?.remove()
      mapRef.current=null
    }
  },[archive?.game_id])

  return <div className="worldMapShell archiveMapShell">
    <div ref={holder} className="worldMap"/>
  </div>
}
