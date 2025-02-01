<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('posts', function (Blueprint $table) {
            $table->id();
            $table->timestamps();

            $table->string('slug', 32)->unique()->after('updated_at');
            $table->string('content')->after('slug');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('posts');
    }
};
