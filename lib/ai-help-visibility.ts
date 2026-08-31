export function shouldShowAIHelp(pathname:string|null|undefined){
  if(!pathname)return true
  return !pathname.startsWith('/login')
}
