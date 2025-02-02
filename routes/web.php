<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\PostsController;

Route::get('/', [PostsController::class, 'index']);
Route::get('/new', [PostsController::class, 'new']);
Route::post('/new', [PostsController::class, 'create']);
Route::get('/{slug}', [PostsController::class, 'show']);
