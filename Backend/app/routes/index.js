import apiRoutes from "./api/index.js";

// A path whose last segment has a file extension (/favicon.ico, /assets/x.js) is
// a FILE request: if static didn't find it, it is a real 404. Serving index.html
// for it (the old behaviour) made a CDN cache HTML as favicon.ico (Oteracount).
const FILE_PATH = /\/[^/]+\.[a-z0-9]{1,8}$/i;

export default async function routes(fastify) {
    await fastify.register(apiRoutes, { prefix: '/api' });

    fastify.setNotFoundHandler(async (request, reply) => {
        const pathname = (request.raw.url || '').split('?')[0];

        if (pathname === '/api' || pathname.startsWith('/api/')) {
            return reply.code(404).send({ ok: false, message: 'API route not found', code: 'not_found' });
        }

        // Only page navigations fall back to the SPA: GET/HEAD for a path that is
        // not a file. Anything else is a genuine miss.
        const isPageNavigation = (request.method === 'GET' || request.method === 'HEAD') && !FILE_PATH.test(pathname);
        if (!isPageNavigation) {
            return reply.code(404).type('text/plain; charset=utf-8').send('Not found');
        }

        return reply.type('text/html; charset=utf-8').sendFile('index.html');
    });
}
