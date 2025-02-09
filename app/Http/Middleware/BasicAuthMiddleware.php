<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class BasicAuthMiddleware
{
    public function handle(Request $request, Closure $next): Response
    {
        abort_if(empty(env('ADMIN_PASSWORD')), 500, 'Admin password is not set');
        abort_if(env('ADMIN_LOGIN') !== $request->getUser(), 401, 'Unauthorized', ['WWW-Authenticate' => 'Basic']);
        abort_if(env('ADMIN_PASSWORD') !== $request->getPassword(), 401, 'Unauthorized', ['WWW-Authenticate' => 'Basic']);

        return $next($request);
    }
}
