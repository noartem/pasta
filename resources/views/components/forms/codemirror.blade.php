<textarea name="{{ $name }}" id="{{ $name }}" class="hidden"></textarea>

<div id="{{ $id }}" data-codemirror="true" data-for="{{ $name }}" data-autofocus="{{ $autofocus }}"
    class="w-full min-h-full font-mono">
    {{ $slot }}
</div>

@once('codemirror')
    @push('styles')
        @vite(['resources/css/codemirror.css'])
    @endpush

    @push('scripts')
        @vite(['resources/js/codemirror.js'])
    @endpush
@endonce
