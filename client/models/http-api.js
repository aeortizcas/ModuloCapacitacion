export function createHttpApi(onUnauthorized=()=>{}) {
async function api(path,method='GET',data){const res=await fetch('/api'+path,{method,headers:method==='GET'?{}:{'Content-Type':'application/json'},body:data===undefined?undefined:JSON.stringify(data)});const value=await res.json();if(!res.ok){if(res.status===401)onUnauthorized();throw Error(value.error||'No se pudo completar la solicitud.');}return value;}
return api;
}
