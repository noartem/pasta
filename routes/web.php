<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\PostsController;

Route::get('/', [PostsController::class, 'index']);
Route::get('/posts', [PostsController::class, 'list']);
Route::post('/posts', [PostsController::class, 'create']);
Route::get('/{slug}', [PostsController::class, 'show']);
