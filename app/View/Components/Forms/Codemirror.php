<?php

namespace App\View\Components\Forms;

use Closure;
use Illuminate\Contracts\View\View;
use Illuminate\View\Component;

class Codemirror extends Component
{
    public readonly string $id;
    public readonly string $name;

    public function __construct(
        ?string $id = null,
        ?string $name = null,
        public readonly string $value = '',
        public readonly bool $autofocus = false,
    ) {
        $this->id = $id ?? uniqid();
        $this->name = $name ?? uniqid();
    }

    public function render(): View|Closure|string
    {
        return view('components.forms.codemirror');
    }
}
