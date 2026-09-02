import { createServiceHubRepository, httpError } from './repository.mjs';

export async function handleServiceHubApi(request, env, context) {
  const url = new URL(request.url);
  if (!url.pathname.startsWith('/api/service-hub')) return null;
  try {
    const ctx = normalizeContext(context);
    const repo = createServiceHubRepository(env?.DB);
    const sub = url.pathname.slice('/api/service-hub'.length) || '/';

    if (request.method === 'GET' && sub === '/health') {
      requirePermission(ctx, 'service_hub:read');
      await env.DB.prepare('SELECT 1 AS ok').first();
      return json({ok:true,service:'valkiria-service-hub',tenantId:ctx.tenantId});
    }

    if (sub === '/systems' && request.method === 'GET') {
      requirePermission(ctx, 'service_hub:read');
      return json({items:await repo.listSystems(ctx,{projectId:url.searchParams.get('projectId')||undefined})});
    }
    if (sub === '/systems' && request.method === 'POST') {
      requirePermission(ctx, 'service_hub:configure');
      return json(await repo.createSystem(ctx,await body(request)),201);
    }

    if (sub === '/channels' && request.method === 'GET') {
      requirePermission(ctx, 'service_hub:read');
      return json({items:await repo.listChannels(ctx,{projectId:url.searchParams.get('projectId')||undefined,systemId:url.searchParams.get('systemId')||undefined})});
    }
    if (sub === '/channels' && request.method === 'POST') {
      requirePermission(ctx, 'service_hub:configure');
      return json(await repo.createChannel(ctx,await body(request)),201);
    }

    if (sub === '/sla-policies' && request.method === 'GET') {
      requirePermission(ctx, 'service_hub:read');
      return json({items:await repo.listSlaPolicies(ctx,{projectId:url.searchParams.get('projectId')||undefined})});
    }
    if (sub === '/sla-policies' && request.method === 'POST') {
      requirePermission(ctx, 'service_hub:configure');
      return json(await repo.createSlaPolicy(ctx,await body(request)),201);
    }

    if (sub === '/tickets' && request.method === 'GET') {
      requirePermission(ctx, 'service_hub:read');
      return json({items:await repo.listTickets(ctx,{
        projectId:url.searchParams.get('projectId')||undefined,
        status:url.searchParams.get('status')||undefined,
        priority:url.searchParams.get('priority')||undefined,
        limit:url.searchParams.get('limit')||undefined
      })});
    }
    if (sub === '/tickets' && request.method === 'POST') {
      requirePermission(ctx, 'service_hub:write');
      return json(await repo.createTicket(ctx,await body(request)),201);
    }

    const ticket = sub.match(/^\/tickets\/([^/]+)$/);
    if (ticket && request.method === 'GET') {
      requirePermission(ctx, 'service_hub:read');
      return json(await repo.getTicket(ctx,decodeURIComponent(ticket[1])));
    }
    const events = sub.match(/^\/tickets\/([^/]+)\/events$/);
    if (events && request.method === 'GET') {
      requirePermission(ctx, 'service_hub:read');
      return json({items:await repo.listTicketEvents(ctx,decodeURIComponent(events[1]))});
    }
    const status = sub.match(/^\/tickets\/([^/]+)\/status$/);
    if (status && request.method === 'POST') {
      requirePermission(ctx, 'service_hub:write');
      return json(await repo.updateTicketStatus(ctx,decodeURIComponent(status[1]),await body(request)));
    }

    return json({error:'not_found'},404);
  } catch (error) {
    const status = Number(error?.status)||500;
    if (status >= 500) console.error(JSON.stringify({event:'service_hub_api_error',error:String(error?.stack||error)}));
    return json({error:String(error?.message||'internal_error')},status);
  }
}

export function normalizeContext(context={}) {
  const tenantId=String(context.tenantId??'').trim().slice(0,120);
  if(!tenantId)throw httpError(401,'tenant_required');
  const permissions=Array.isArray(context.permissions)?context.permissions.map(String):[];
  return {
    tenantId,
    permissions,
    actorType:String(context.actorType??'user').trim().slice(0,40)||'user',
    actorRef:String(context.actorRef??'').trim().slice(0,180)||null
  };
}

export function requirePermission(ctx, permission) {
  const p=new Set(ctx.permissions??[]);
  if(p.has('*')||p.has('service_hub:*')||p.has(permission))return;
  throw httpError(403,'forbidden');
}

async function body(request){
  const type=(request.headers.get('content-type')||'').toLowerCase();
  if(!type.includes('application/json'))throw httpError(415,'json_required');
  try{return await request.json();}catch{throw httpError(400,'invalid_json');}
}
function json(data,status=200){return new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'}});}
