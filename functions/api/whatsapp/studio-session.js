import {onRequest as proxy} from '../../inquiry-studio/[[path]].js';
export async function onRequestGet({request}){const url=new URL(request.url);url.pathname='/inquiry-studio/api/session';url.search='';return proxy({request:new Request(url,request)});}
