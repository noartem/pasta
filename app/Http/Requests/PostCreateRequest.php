<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class PostCreateRequest extends FormRequest
{
    /**
     * @return array<string, \Illuminate\Contracts\Validation\ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'content' => ['required', 'min:1', 'max:10000000'],
        ];
    }
}
