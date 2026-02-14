echo "extracting home"
echo `pwd`
docker compose up openclaw-bash -d

echo "Waiting for openclaw-bash container to be ready..."
retries=0
max_retries=30
until docker compose exec openclaw-bash test -d /home/pn; do
  retries=$((retries + 1))
  if [ "$retries" -ge "$max_retries" ]; then
    echo "ERROR: Container failed to become ready after ${max_retries}s"
    docker compose down openclaw-bash
    exit 1
  fi
  sleep 1
done
echo "Container ready."

docker compose cp openclaw-bash:/home/pn home.orig
docker compose down openclaw-bash
