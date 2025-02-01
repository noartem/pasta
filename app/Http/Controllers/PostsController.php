<?php

namespace App\Http\Controllers;

use App\Http\Requests\PostCreateRequest;
use App\Models\Post;
use Hidehalo\Nanoid\Client;
use Illuminate\Support\Facades\DB;

class PostsController extends Controller
{
    public function index()
    {
        return view('posts.index');
    }

    public function list()
    {
        $posts = Post::query()
            ->select('id', 'slug', 'created_at', DB::raw('substr(content, 0, 110) as content'))
            ->orderByDesc('created_at')
            ->get();

        return view('posts.list', [
            'title' => "Pastas ({$posts->count()})",
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
