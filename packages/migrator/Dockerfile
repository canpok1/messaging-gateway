FROM migrate/migrate:latest

COPY ./packages/migrator/ /workspace/
RUN apk add make

WORKDIR /workspace
ENTRYPOINT ["make"]
CMD ["migrate-version"]
