```
wsl --shutdown
C:\Program Files\Docker\Docker\Docker Desktop.exe
docker run -d --name redis-stack-server -p 6379:6379 redis/redis-stack-server:latest
docker exec -it redis-stack-server redis-cli ping
docker ps

supabase start

pnpm dev
```

1. Get upstash setup for redis (Locally redis stack via docker)
2. Get supabase setup (Locally via `supabase start` which will take for first time. Also ensure that you expose daemon on `tcp://localhost:2375` without TLS)
3. Once redis and supabase are running locally (In production ensure ENV variables) then start via `pnpm dev`.
4. Now setup resend (Or some other SMTP) via supabase UI (For local do it via `.env`, the `config.toml` is already setup) and then you can do the onboarding process (If using `onboarding@resend.dev` only the email you signed in with resend will work)

```shell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
.\sd-dev.ps1 -Mode dev
# Don't specify -Mode dev if you wish to only start Redis and Supabase
# In above it's assumed that you do not have any existing `redis-stack-server` instances running
# If you do then they will be stopped and removed
```