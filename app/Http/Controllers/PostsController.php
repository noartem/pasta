<?php

namespace App\Http\Controllers;

use App\Http\Requests\PostCreateRequest;
use App\Models\Post;
use Hidehalo\Nanoid\Client;
use Illuminate\Support\Facades\DB;

class PostsController extends Controller
{
    public function new()
    {
        return view('posts.new');
    }

    public function index()
    {
        $count = Post::count();
        $posts = Post::query()
            ->select('id', 'slug', 'created_at', DB::raw('substr(content, 0, 110) as content'))
            ->orderByDesc('created_at')
            ->limit(100)
            ->get();

        return view('posts.index', [
            'title' => "Pastas ($count)",
            'posts' => $posts,
        ]);
    }

    public function create(PostCreateRequest $request)
    {
        $client = new Client();
        $slug = $client->formattedId(alphabet: '23456789abcdefghjkmnpqrstuvwxyz', size: 16);

        $post = Post::create([
            'slug' => $slug,
            'content' => $request->content,
        ]);

        return redirect("/$post->slug");
    }

    public function show(string $slug)
    {
        $post = Post::where('slug', $slug)->firstOrFail();

        return view('posts.show', [
            'title' => "Pasta #$post->slug",
            'post' => $post
        ]);
    }
}
