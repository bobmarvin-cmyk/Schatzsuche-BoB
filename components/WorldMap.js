'use client'
import {useEffect,useRef,useState} from 'react'

const R=6378137
const STYLE='https://tiles.openfreemap.org/styles/liberty'

function lngLatToMercator(lng,lat){
  const clamped=Math.max(-85.05112878,Math.min(85.05112878,Number(lat)))
  const x=R*Number(lng)*Math.PI/180
  const y=R*Math.log(Math.tan(Math.PI/4+(clamped*Math.PI/180)/2))
  return [x,y]
}
function mercatorToLngLat(x,y){
  const lng=(Number(x)/R)*180/Math.PI
  const lat=(2*Math.atan(Math.exp(Number(y)/R))-Math.PI/2)*180/Math.PI
  return [lng,lat]
}
function gridFor(lng,lat,size){
  const [x,y]=lngLatToMercator(lng,lat)
  return [Math.floor(x/size),Math.floor(y/size)]
}
function polygonFor(gx,gy,size){
  const x0=Number(gx)*size,y0=Number(gy)*size
  const x1=x0+size,y1=y0+size
  const a=mercatorToLngLat(x0,y0),b=mercatorToLngLat(x1,y0),c=mercatorToLngLat(x1,y1),d=mercatorToLngLat(x0,y1)
  return [[[a[0],a[1]],[b[0],b[1]],[c[0],c[1]],[d[0],d[1]],[a[0],a[1]]]]
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
  if(has('water','ocean','lake','river','pond','dock'))return 'water'
  if(has('wetland','swamp','bog','marsh','reedbed','saltmarsh','tidalflat'))return 'wetland'
  if(has('wood','forest'))return 'forest'
  if(has('industrial'))return 'industrial'
  if(has('commercial','retail'))return 'commercial'
  if(has('residential','suburb','quarter','neighbourhood'))return 'residential'
  if(has('park','garden','recreation_ground','playground'))return 'park'
  if(has('farmland','farm','orchard','vineyard','allotments'))return 'farmland'
  if(has('sand','beach','dune'))return 'sand'
  if(has('rock','bare_rock','scree','quarry'))return 'rock'
  if(has('grass','grassland','meadow','heath','scrub'))return 'grass'
  if(has('transportation','road','street','highway'))return 'road'
  return 'open'
}
function parcelFC(parcels,size){
  return {
    type:'FeatureCollection',
    features:(parcels||[]).map(p=>({
      type:'Feature',
      properties:{
        id:p.id,
        owner_name:p.owner_name||'Spieler',
        terrain_type:p.terrain_type,
        is_mine:!!p.is_mine,
        level:Number(p.level||0)
      },
      geometry:{type:'Polygon',coordinates:polygonFor(p.gx,p.gy,size)}
    }))
  }
}
function selectionFC(sel,size){
  if(!sel)return {type:'FeatureCollection',features:[]}
  return {type:'FeatureCollection',features:[{
    type:'Feature',
    properties:{},
    geometry:{type:'Polygon',coordinates:polygonFor(sel.gx,sel.gy,size)}
  }]}
}

export default function WorldMap({parcelSize=10,parcels=[],selected,onSelect,onViewport}){
  const holder=useRef(null)
  const mapRef=useRef(null)
  const onSelectRef=useRef(onSelect)
  const onViewportRef=useRef(onViewport)
  const parcelsRef=useRef(parcels)
  const selectedRef=useRef(selected)
  const sizeRef=useRef(parcelSize)
  const [ready,setReady]=useState(false)

  useEffect(()=>{onSelectRef.current=onSelect},[onSelect])
  useEffect(()=>{onViewportRef.current=onViewport},[onViewport])
  useEffect(()=>{parcelsRef.current=parcels;updateSources()},[parcels])
  useEffect(()=>{selectedRef.current=selected;updateSources()},[selected])
  useEffect(()=>{sizeRef.current=parcelSize;updateSources()},[parcelSize])

  function updateSources(){
    const map=mapRef.current
    if(!map||!map.isStyleLoaded())return
    const owned=map.getSource('world-parcels')
    if(owned)owned.setData(parcelFC(parcelsRef.current,sizeRef.current))
    const sel=map.getSource('world-selection')
    if(sel)sel.setData(selectionFC(selectedRef.current,sizeRef.current))
  }

  function publishViewport(map){
    const b=map.getBounds()
    const a=gridFor(b.getWest(),b.getSouth(),sizeRef.current)
    const c=gridFor(b.getEast(),b.getNorth(),sizeRef.current)
    onViewportRef.current?.({
      minGx:Math.min(a[0],c[0]),maxGx:Math.max(a[0],c[0]),
      minGy:Math.min(a[1],c[1]),maxGy:Math.max(a[1],c[1])
    })
  }

  useEffect(()=>{
    let cancelled=false
    let map
    ;(async()=>{
      const mod=await import('maplibre-gl')
      if(cancelled||!holder.current)return
      const maplibregl=mod.default||mod
      map=new maplibregl.Map({
        container:holder.current,
        style:STYLE,
        center:[10,50],
        zoom:16,
        maxZoom:21,
        minZoom:2
      })
      mapRef.current=map
      map.addControl(new maplibregl.NavigationControl({showCompass:false}),'top-right')

      map.on('load',()=>{
        map.addSource('world-parcels',{type:'geojson',data:parcelFC(parcelsRef.current,sizeRef.current)})
        map.addLayer({
          id:'world-parcels-fill',type:'fill',source:'world-parcels',
          paint:{
            'fill-color':['case',['boolean',['get','is_mine'],false],'#22c55e','#f59e0b'],
            'fill-opacity':['case',['boolean',['get','is_mine'],false],0.48,0.34]
          }
        })
        map.addLayer({
          id:'world-parcels-line',type:'line',source:'world-parcels',
          paint:{'line-color':['case',['boolean',['get','is_mine'],false],'#a7f3d0','#fde68a'],'line-width':1.4}
        })
        map.addSource('world-selection',{type:'geojson',data:selectionFC(selectedRef.current,sizeRef.current)})
        map.addLayer({
          id:'world-selection-fill',type:'fill',source:'world-selection',
          paint:{'fill-color':'#38bdf8','fill-opacity':0.20}
        })
        map.addLayer({
          id:'world-selection-line',type:'line',source:'world-selection',
          paint:{'line-color':'#7dd3fc','line-width':2.4}
        })
        setReady(true)
        publishViewport(map)
      })

      map.on('moveend',()=>publishViewport(map))
      map.on('click',e=>{
        const [gx,gy]=gridFor(e.lngLat.lng,e.lngLat.lat,sizeRef.current)
        let features=[]
        try{features=map.queryRenderedFeatures(e.point)||[]}catch{}
        const terrain=terrainFromFeatures(features)
        const occupied=(parcelsRef.current||[]).find(p=>Number(p.gx)===gx&&Number(p.gy)===gy)||null
        onSelectRef.current?.({
          gx,gy,terrain,lat:e.lngLat.lat,lng:e.lngLat.lng,occupied
        })
      })
    })()
    return()=>{
      cancelled=true
      try{map?.remove()}catch{}
      mapRef.current=null
    }
  },[])

  return <div className="worldMapWrap">
    <div ref={holder} className="worldMap"/>
    {!ready&&<div className="worldMapLoading">Weltkarte wird geladen…</div>}
    <div className="worldMapLegend">
      <span><i className="worldLegendMine"/> deine Grundstücke</span>
      <span><i className="worldLegendOther"/> andere Besitzer</span>
    </div>
  </div>
}
