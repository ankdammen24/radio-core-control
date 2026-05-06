FROM python:3.12-slim

LABEL org.opencontainers.image.title="radio-core-runner" \
      org.opencontainers.image.description="Pulls Radio Core station config and drives Liquidsoap + Icecast"

RUN apt-get update && apt-get install -y --no-install-recommends \
        ca-certificates curl tini \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY runner.py .

ENV PYTHONUNBUFFERED=1
ENTRYPOINT ["tini", "--"]
CMD ["python", "/app/runner.py"]
