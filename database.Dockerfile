FROM postgres:17.5

RUN apt-get update \
    && apt-get install -y postgresql-17-cron \
    && rm -rf /var/lib/apt/lists/*
