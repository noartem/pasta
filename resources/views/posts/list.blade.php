@extends('layouts.app')

@section('content')
    <div class="flex flex-1 w-full p-4">
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
