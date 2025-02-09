<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\PostsController;

Route::get('/', [PostsController::class, 'new']);
Route::post('/', [PostsController::class, 'create']);
Route::redirect('/new', '/');
Route::get('/all', [PostsController::class, 'index'])
    ->middleware(\App\Http\Middleware\BasicAuthMiddleware::class);
Route::get('/{slug}', [PostsController::class, 'show']);
