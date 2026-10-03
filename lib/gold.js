export function ugToGoldMg(ug){
  return Number(ug||0)/1000
}
export function formatGold(ug, digits=2){
  return ugToGoldMg(ug).toLocaleString('de-DE',{
    minimumFractionDigits:0,
    maximumFractionDigits:digits
  })+' mg'
}
export function goldToUg(g){
  return Math.max(0,Math.round(Number(g||0)*1_000_000))
}
