<textarea name="{{ $name }}" id="{{ $name }}" autofocus class="fixed w-10 h-10 opacity-0">{!! htmlspecialchars_decode(e($value)) !!}</textarea>

<div id="{{ $id }}" data-codemirror="true" data-for="{{ $name }}" data-autofocus="{{ $autofocus }}"
    data-indicate-changes-in-page-title="{{ $indicateChangesInPageTitle }}" class="w-full min-h-full font-mono">
</div>

@once('codemirror')
    @push('styles')
        @vite(['resources/css/codemirror.css'])
    @endpush

    @push('scripts')
        @vite(['resources/js/codemirror.js'])
    @endpush
@endonce
