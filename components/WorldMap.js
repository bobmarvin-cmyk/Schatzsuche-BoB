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
  return [(Number(x)/R)*180/Math.PI,(2*Math.atan(Math.exp(Number(y)/R))-Math.PI/2)*180/Math.PI]
}
function gridFor(lng,lat,size){
  const [x,y]=lngLatToMercator(lng,lat)
  return [Math.floor(x/size),Math.floor(y/size)]
}
function polygonFor(gx,gy,size){
  const x0=Number(gx)*size,y0=Number(gy)*size,x1=x0+size,y1=y0+size
  const a=mercatorToLngLat(x0,y0),b=mercatorToLngLat(x1,y0),c=mercatorToLngLat(x1,y1),d=mercatorToLngLat(x0,y1)
  return [[[a[0],a[1]],[b[0],b[1]],[c[0],c[1]],[d[0],d[1]],[a[0],a[1]]]]
}
function centerFor(gx,gy,size){
  return mercatorToLngLat((Number(gx)+.5)*size,(Number(gy)+.5)*size)
}
function terrainFromFeatures(features){
  const rows=(features||[]).map(f=>({
    sourceLayer:String(f.sourceLayer||'').toLowerCase(),
    cls:String(f.properties?.class||'').toLowerCase(),
    sub:String(f.properties?.subclass||'').toLowerCase(),
    layer:String(f.layer?.id||'').toLowerCase()
  }))
  const has=(...words)=>rows.some(r=>words.some(w=>r.sourceLayer.includes(w)||r.cls===w||r.sub===w||r.layer.includes(w)))
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

function enableSatelliteTerrainComposite(map){
  try{
    if(!map.getSource('world-satellite')){
      map.addSource('world-satellite',{
        type:'raster',
        tiles:['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
        tileSize:256,
        attribution:'Esri, Maxar, Earthstar Geographics, and the GIS User Community'
      })
    }
    if(!map.getLayer('world-satellite')){
      const layers=map.getStyle()?.layers||[]
      const before=(layers.find(l=>l.type!=='background')||{}).id
      map.addLayer({id:'world-satellite',type:'raster',source:'world-satellite',paint:{'raster-opacity':1}},before)
    }
    for(const layer of map.getStyle()?.layers||[]){
      if(layer.id==='world-satellite')continue
      try{
        if(layer.type==='background')map.setPaintProperty(layer.id,'background-opacity',0)
        else if(layer.type==='fill')map.setPaintProperty(layer.id,'fill-opacity',0.015)
        else if(layer.type==='fill-extrusion')map.setPaintProperty(layer.id,'fill-extrusion-opacity',0.02)
        else if(layer.type==='circle')map.setPaintProperty(layer.id,'circle-opacity',0.15)
        else if(layer.type==='line')map.setPaintProperty(layer.id,'line-opacity',0.34)
        else if(layer.type==='symbol'){
          map.setPaintProperty(layer.id,'text-opacity',0.82)
          map.setPaintProperty(layer.id,'icon-opacity',0.68)
        }
      }catch{}
    }
  }catch{}
}

function parcelFC(parcels,size){
  return {
    type:'FeatureCollection',
    features:(parcels||[]).map(p=>({
      type:'Feature',
      properties:{
        id:String(p.id),owner_name:p.owner_name||'Spieler',terrain_type:p.terrain_type,
        is_mine:!!p.is_mine,level:Number(p.level||0),color_hex:p.color_hex||'#22c55e'
      },
      geometry:{type:'Polygon',coordinates:polygonFor(p.gx,p.gy,size)}
    }))
  }
}
function selectionFC(selected,size){
  return {
    type:'FeatureCollection',
    features:(selected||[]).map(s=>({
      type:'Feature',
      properties:{occupied:!!s.occupied},
      geometry:{type:'Polygon',coordinates:polygonFor(s.gx,s.gy,size)}
    }))
  }
}
function imagePointsFC(parcels,size,imageIds){
  return {
    type:'FeatureCollection',
    features:(parcels||[]).filter(p=>p.image_url&&imageIds[p.id]).map(p=>{
      const [lng,lat]=centerFor(p.gx,p.gy,size)
      return {
        type:'Feature',
        properties:{image_id:imageIds[p.id],id:String(p.id)},
        geometry:{type:'Point',coordinates:[lng,lat]}
      }
    })
  }
}

export default function WorldMap({parcelSize=10,parcels=[],selected=[],onSelect,onViewport}){
  const holder=useRef(null),mapRef=useRef(null)
  const onSelectRef=useRef(onSelect),onViewportRef=useRef(onViewport)
  const parcelsRef=useRef(parcels),selectedRef=useRef(selected),sizeRef=useRef(parcelSize)
  const imageIdsRef=useRef({})
  const [ready,setReady]=useState(false)

  useEffect(()=>{onSelectRef.current=onSelect},[onSelect])
  useEffect(()=>{onViewportRef.current=onViewport},[onViewport])
  useEffect(()=>{parcelsRef.current=parcels;updateSources();syncImages()},[parcels])
  useEffect(()=>{selectedRef.current=selected;updateSources()},[selected])
  useEffect(()=>{sizeRef.current=parcelSize;updateSources()},[parcelSize])

  function updateSources(){
    const map=mapRef.current
    if(!map||!map.isStyleLoaded())return
    map.getSource('world-parcels')?.setData(parcelFC(parcelsRef.current,sizeRef.current))
    map.getSource('world-selection')?.setData(selectionFC(selectedRef.current,sizeRef.current))
    map.getSource('world-images')?.setData(imagePointsFC(parcelsRef.current,sizeRef.current,imageIdsRef.current))
  }

  async function syncImages(){
    const map=mapRef.current
    if(!map||!map.isStyleLoaded())return
    for(const p of parcelsRef.current||[]){
      if(!p.image_url||imageIdsRef.current[p.id])continue
      const imageId='world-art-'+String(p.id)
      try{
        const result=await map.loadImage(p.image_url)
        if(!map.hasImage(imageId))map.addImage(imageId,result.data)
        imageIdsRef.current[p.id]=imageId
      }catch{}
    }
    updateSources()
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
    let cancelled=false,map
    ;(async()=>{
      const mod=await import('maplibre-gl')
      if(cancelled||!holder.current)return
      const maplibregl=mod.default||mod
      map=new maplibregl.Map({
        container:holder.current,style:STYLE,center:[10,50],zoom:16,maxZoom:21,minZoom:2
      })
      mapRef.current=map
      map.addControl(new maplibregl.NavigationControl({showCompass:false}),'top-right')

      map.on('load',()=>{
        enableSatelliteTerrainComposite(map)
        map.addSource('world-parcels',{type:'geojson',data:parcelFC(parcelsRef.current,sizeRef.current)})
        map.addLayer({
          id:'world-parcels-fill',type:'fill',source:'world-parcels',
          paint:{'fill-color':['get','color_hex'],'fill-opacity':0.44}
        })
        map.addLayer({
          id:'world-parcels-line',type:'line',source:'world-parcels',
          paint:{'line-color':['case',['boolean',['get','is_mine'],false],'#f8fafc','#fbbf24'],'line-width':1.25}
        })

        map.addSource('world-selection',{type:'geojson',data:selectionFC(selectedRef.current,sizeRef.current)})
        map.addLayer({
          id:'world-selection-fill',type:'fill',source:'world-selection',
          paint:{'fill-color':['case',['boolean',['get','occupied'],false],'#ef4444','#38bdf8'],'fill-opacity':0.28}
        })
        map.addLayer({
          id:'world-selection-line',type:'line',source:'world-selection',
          paint:{'line-color':['case',['boolean',['get','occupied'],false],'#fca5a5','#7dd3fc'],'line-width':2.6}
        })

        map.addSource('world-images',{type:'geojson',data:imagePointsFC(parcelsRef.current,sizeRef.current,imageIdsRef.current)})
        map.addLayer({
          id:'world-images-symbol',type:'symbol',source:'world-images',
          layout:{
            'icon-image':['get','image_id'],
            'icon-size':0.22,
            'icon-allow-overlap':true,
            'icon-ignore-placement':true
          },
          paint:{'icon-opacity':0.95}
        })

        setReady(true);publishViewport(map);syncImages()
      })

      map.on('moveend',()=>publishViewport(map))
      map.on('click',e=>{
        const [gx,gy]=gridFor(e.lngLat.lng,e.lngLat.lat,sizeRef.current)
        let features=[]
        try{
          features=map.queryRenderedFeatures(e.point)?.filter(f=>
            f.layer?.id!=='world-parcels-fill' &&
            f.layer?.id!=='world-parcels-line' &&
            f.layer?.id!=='world-selection-fill' &&
            f.layer?.id!=='world-selection-line' &&
            f.layer?.id!=='world-images-symbol' &&
            f.layer?.id!=='world-satellite'
          )||[]
        }catch{}
        const terrain=terrainFromFeatures(features)
        const occupied=(parcelsRef.current||[]).find(p=>Number(p.gx)===gx&&Number(p.gy)===gy)||null
        onSelectRef.current?.({gx,gy,terrain,lat:e.lngLat.lat,lng:e.lngLat.lng,occupied})
      })
    })()
    return()=>{cancelled=true;try{map?.remove()}catch{};mapRef.current=null}
  },[])

  return <div className="worldMapWrap">
    <div ref={holder} className="worldMap"/>
    {!ready&&<div className="worldMapLoading">Satelliten-Weltkarte wird geladen…</div>}
    <div className="worldMapLegend">
      <span><i className="worldLegendMine"/> Grundstücksfarbe</span>
      <span><i className="worldLegendSelected"/> Auswahl</span>
      <span>🛰 Satellit + Terrainwerte im Hintergrund</span>
    </div>
  </div>
}
