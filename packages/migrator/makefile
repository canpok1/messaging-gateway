DB_URL_FOR_MIGRATE=mysql://${MYSQL_USER}:${MYSQL_PASSWORD}@tcp(${MYSQL_HOST_ON_DOCKER_NETWORK}:${MYSQL_PORT_ON_DOCKER_NETWORK})/${MYSQL_DATABASE}
DB_URL_FOR_TBLS=mariadb://${MYSQL_USER}:${MYSQL_PASSWORD}@${MYSQL_HOST_ON_DOCKER_NETWORK}:${MYSQL_PORT_ON_DOCKER_NETWORK}/${MYSQL_DATABASE}
DB_DDL_DIR=./ddl
DB_DOC_DIR=../../public/database

MIGRATE_COMMAND=migrate -path ${DB_DDL_DIR} -database "${DB_URL_FOR_MIGRATE}"
TBLS_COMMAND=tbls

.PHONY: migrate
migrate:
	@${MIGRATE_COMMAND} ${options}

.PHONY: migrate-help
migrate-help:
	@migrate -help

.PHONY: migrate-version
migrate-version:
	@${MIGRATE_COMMAND} version 

.PHONY: migrate-up
migrate-up:
	@${MIGRATE_COMMAND} up

.PHONY: migrate-up-one
migrate-up-one:
	@${MIGRATE_COMMAND} up 1

.PHONY: migrate-down-one
migrate-down-one:
	@${MIGRATE_COMMAND} down 1

.PHONY: migrate-force-v
migrate-force-v:
	@${MIGRATE_COMMAND} force ${v}

.PHONY: migrate-create
migrate-create:
	@${MIGRATE_COMMAND} create -ext sql -dir "${DB_DDL_DIR}" -seq ${name}

.PHONY: tbls-doc
tbls-doc:
	@${TBLS_COMMAND} doc "${DB_URL_FOR_TBLS}" "${DB_DOC_DIR}" --rm-dist

.PHONY: tbls-lint
tbls-lint:
	@${TBLS_COMMAND} lint "${DB_URL_FOR_TBLS}"

.PHONY: tbls-diff
tbls-diff:
	@${TBLS_COMMAND} diff "${DB_URL_FOR_TBLS}" "${DB_DOC_DIR}"
