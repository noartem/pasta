@extends('layouts.app')

@section('content')
    <form action="/new" method="post" class="flex flex-1 w-full">
        @csrf

        <x-forms.codemirror name="content" autofocus>
            <pre class="hidden">{{ $post->content }}</pre>
        </x-forms.codemirror>
    </form>
@endsection
