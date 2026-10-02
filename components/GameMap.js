'use client'
import {useEffect,useRef} from 'react'

const METERS_PER_DEG_LAT=111320

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

function cellBounds(g,x,y){
  const west=g.west+x*g.cell/g.metersLon
  const east=g.west+(x+1)*g.cell/g.metersLon
  const north=g.north-y*g.cell/METERS_PER_DEG_LAT
  const south=g.north-(y+1)*g.cell/METERS_PER_DEG_LAT
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
      const [w,s,e,n]=cellBounds(g,Number(f.x),Number(f.y))
      return {
        type:'Feature',
        properties:{color:f.is_treasure?'#f4c542':(colors[f.discovered_by]||'#3b82f6')},
        geometry:{type:'Polygon',coordinates:[[[w,s],[e,s],[e,n],[w,n],[w,s]]]}
      }
    })
  }
}

export default function GameMap({game,fields,players,onReveal}){
  const holder=useRef(null)
  const mapRef=useRef(null)
  const gameRef=useRef(game)
  const fieldsRef=useRef(fields)
  const playersRef=useRef(players)
  const onRevealRef=useRef(onReveal)

  gameRef.current=game
  fieldsRef.current=fields
  playersRef.current=players
  onRevealRef.current=onReveal

  useEffect(()=>{
    if(!game||!holder.current||mapRef.current)return
    let cancelled=false

    ;(async()=>{
      const maplibregl=await import('maplibre-gl')
      if(cancelled)return

      const g=geometry(game)

      const map=new maplibregl.Map({
        container:holder.current,
        style:'https://tiles.openfreemap.org/styles/liberty',
        center:[g.lon,g.lat],
        zoom:10,
        attributionControl:true
      })

      mapRef.current=map
      map.addControl(new maplibregl.NavigationControl({showCompass:false}),'top-right')

      map.on('load',()=>{
        map.fitBounds([[g.west,g.south],[g.east,g.north]],{
          padding:35,
          duration:0,
          maxZoom:17
        })

        map.addSource('explored',{
          type:'geojson',
          data:featureCollection(gameRef.current,fieldsRef.current,playersRef.current)
        })

        map.addLayer({
          id:'explored-fill',
          type:'fill',
          source:'explored',
          paint:{
            'fill-color':['get','color'],
            'fill-opacity':0.62
          }
        })

        map.addLayer({
          id:'explored-outline',
          type:'line',
          source:'explored',
          paint:{
            'line-color':'#ffffff',
            'line-opacity':0.32,
            'line-width':0.8
          }
        })

        map.addSource('grid',{
          type:'geojson',
          data:{type:'FeatureCollection',features:[]}
        })

        map.addLayer({
          id:'grid-lines',
          type:'line',
          source:'grid',
          paint:{
            'line-color':'#132238',
            'line-opacity':0.72,
            'line-width':0.7
          }
        })

        updateGrid()
      })

      map.on('moveend',updateGrid)
      map.on('zoomend',updateGrid)

      map.on('click',(e)=>{
        const cg=geometry(gameRef.current)
        const x=Math.floor((e.lngLat.lng-cg.west)*cg.metersLon/cg.cell)
        const y=Math.floor((cg.north-e.lngLat.lat)*METERS_PER_DEG_LAT/cg.cell)

        if(x>=0&&y>=0&&x<cg.width&&y<cg.height){
          onRevealRef.current?.(x,y)
        }
      })

      function updateGrid(){
        if(!map.getSource('grid'))return

        const cg=geometry(gameRef.current)
        const b=map.getBounds()

        let x0=Math.max(0,Math.floor((b.getWest()-cg.west)*cg.metersLon/cg.cell))
        let x1=Math.min(cg.width,Math.ceil((b.getEast()-cg.west)*cg.metersLon/cg.cell))
        let y0=Math.max(0,Math.floor((cg.north-b.getNorth())*METERS_PER_DEG_LAT/cg.cell))
        let y1=Math.min(cg.height,Math.ceil((cg.north-b.getSouth())*METERS_PER_DEG_LAT/cg.cell))

        const visible=Math.max(x1-x0,y1-y0,1)
        const step=Math.max(1,Math.ceil(visible/120))

        x0=Math.floor(x0/step)*step
        y0=Math.floor(y0/step)*step

        const features=[]

        for(let x=x0;x<=x1;x+=step){
          const lon=cg.west+x*cg.cell/cg.metersLon
          features.push({
            type:'Feature',
            properties:{},
            geometry:{
              type:'LineString',
              coordinates:[[lon,cg.south],[lon,cg.north]]
            }
          })
        }

        for(let y=y0;y<=y1;y+=step){
          const lat=cg.north-y*cg.cell/METERS_PER_DEG_LAT
          features.push({
            type:'Feature',
            properties:{},
            geometry:{
              type:'LineString',
              coordinates:[[cg.west,lat],[cg.east,lat]]
            }
          })
        }

        map.getSource('grid').setData({
          type:'FeatureCollection',
          features
        })
      }
    })()

    return()=>{
      cancelled=true
      mapRef.current?.remove()
      mapRef.current=null
    }
  },[game?.id])

  // IMPORTANT FIX:
  // Update the actual GeoJSON source whenever fields or player colors change.
  useEffect(()=>{
    const map=mapRef.current
    if(!map)return

    const apply=()=>{
      const src=map.getSource('explored')
      if(src){
        src.setData(featureCollection(gameRef.current,fieldsRef.current,playersRef.current))
      }
    }

    if(map.loaded())apply()
    else map.once('load',apply)
  },[fields,players,game])

  return <div ref={holder} className="worldMap"/>
}
