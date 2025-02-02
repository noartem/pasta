<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}">

<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">

    <title>
        @if (isset($title))
            {{ $title }}
        @else
            Pasta
        @endif
    </title>

    <link rel="preconnect" href="https://fonts.bunny.net">
    <link href="https://fonts.bunny.net/css?family=figtree:400,500,600&display=swap" rel="stylesheet" />

    @vite(['resources/css/app.css', 'resources/js/app.js'])
    @stack('styles')
    @stack('scripts')
</head>

<body class="font-sans antialiased dark:bg-black">
    <div class=" dark:bg-black">
        <div class="relative flex flex-col max-h-screen min-h-screen overflow-auto">
            @yield('content')
        </div>
    </div>
</body>

</html>
