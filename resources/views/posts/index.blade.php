@extends('layouts.app')

@section('content')
    <form action="/posts" method="post" class="flex flex-1 w-full">
        @csrf
        <textarea name="content" id="content" class="hidden"></textarea>
        <div id="editor" class="w-full min-h-full"></div>
    </form>
@endsection

@push('scripts')
    @vite(['resources/js/codemirror.js'])
@endpush
