<textarea name="{{ $name }}" id="{{ $name }}" autofocus
    style="position: fixed; width: 10px; height: 10px; opacity: 0; ">{{ $value }}</textarea>

<div id="{{ $id }}" data-codemirror="true" data-for="{{ $name }}" data-autofocus="{{ $autofocus }}"
    class="w-full min-h-full font-mono">
</div>

@once('codemirror')
    @push('styles')
        @vite(['resources/css/codemirror.css'])
    @endpush

    @push('scripts')
        @vite(['resources/js/codemirror.js'])
    @endpush
@endonce
