



docker run -d --name kong-database -p 5432:5432 -e "POSTGRES_USER=kong" -e "POSTGRES_DB=kong" postgres:9.6
docker run --rm --link kong-database:kong-database -e "KONG_DATABASE=postgres" -e "KONG_PG_HOST=kong-database" -e "KONG_CASSANDRA_CONTACT_POINTS=kong-database" kong kong migrations bootstrap
docker run -d --name kong -e "KONG_DATABASE=postgres" -e "KONG_PG_HOST=kong-database" -e "KONG_LOG_LEVEL=info" -e "KONG_PG_HOST=1.1.1.1" -e "KONG_ADMIN_LISTEN=0.0.0.0:8001, 0.0.0.0:8444 ssl" -p 8000:8000 -p 8443:8443 -p 8001:8001 -p 8444:8444 kong
docker ps -a