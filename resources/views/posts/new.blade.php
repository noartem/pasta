@extends('layouts.app')

@section('content')
    <form action="/" method="post" class="flex flex-1 w-full">
        @csrf

        <x-forms.codemirror name="content" autofocus />
    </form>
@endsection
