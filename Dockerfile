FROM php:8.4-fpm

RUN apt-get update && apt-get install -y \
    unzip \
    git \
    curl \
    libpng-dev \
    libonig-dev \
    libxml2-dev \
    sqlite3 \
    npm \
    && docker-php-ext-install pdo mbstring exif pcntl bcmath gd

COPY --from=composer:2.2 /usr/bin/composer /usr/bin/composer

WORKDIR /var/www/html

COPY . .

RUN composer install --no-dev --optimize-autoloader

RUN npm install && npm run build

RUN chmod -R 777 storage bootstrap/cache

RUN mkdir -p /var/www/html/database/sqlite && chmod -R 777 /var/www/html/database/sqlite

COPY docker-start.sh /usr/local/bin/start.sh
RUN chmod +x /usr/local/bin/start.sh

EXPOSE 8000

ENTRYPOINT ["/usr/local/bin/start.sh"]
