@extends('layouts.app')

@section('content')
    <div class="flex flex-col items-start flex-1 w-full gap-6 p-4">
        <div class="flex gap-4 align-center">
            <h1 class="text-2xl font-bold">
                🍝 Pastas
            </h1>

            <a href="/new" class="px-4 py-1 border-2 border-gray-500 w-fit-content">
                Create New Pasta
            </a>
        </div>

        <ul class="flex flex-col gap-4 list-disc list-inside">
            @foreach ($posts as $post)
                <li class="flex flex-col gap-1">
                    <div class="flex gap-2">
                        <a href="/{{ $post->slug }}" class="text-gray-800 underline transition-all">
                            {{ $post->slug }}
                        </a>
                        <abbr class="text-gray-400 no-underline" title="{{ $post->created_at }}">
                            {{ $post->created_at->diffForHumans() }}
                        </abbr>
                    </div>

                    <p class="ml-6 text-gray-400">
                        @if (strlen($post->content) > 100)
                            {{ substr($post->content, 0, 100) }}...
                        @else
                            {{ $post->content }}
                        @endif
                    </p>
                </li>
            @endforeach
        </ul>
    </div>
@endsection
