import {onRequest as proxy} from '../../inquiry-studio/[[path]].js';
export async function onRequestPost({request}){const url=new URL(request.url);url.pathname='/inquiry-studio/api/whatsapp-suggest';url.search='';return proxy({request:new Request(url,request)});}
