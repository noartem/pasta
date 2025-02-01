# 🍝 Pasta

The tastiest note manager on the entire internet

## Build and Run

Build docker image:

```
docker build -t pasta .
```

Run:

```
docker run -d --name pasta -p 8000:8000 -v $(pwd)/database/database.sqlite:/var/www/html/database/sqlite pasta
```
