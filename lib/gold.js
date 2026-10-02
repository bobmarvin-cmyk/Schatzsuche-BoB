export function ugToGold(ug){
  return Number(ug||0)/1_000_000
}
export function formatGold(ug, digits=4){
  return ugToGold(ug).toLocaleString('de-DE',{
    minimumFractionDigits:2,
    maximumFractionDigits:digits
  })+' g'
}
export function goldToUg(g){
  return Math.max(0,Math.round(Number(g||0)*1_000_000))
}
