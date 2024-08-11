# messaging-gateway

## usage

```
# db migration
npm run migrate:version
npm run migrate:up:all
npm run migrate:up:one
npm run migrate:down:one
npm run migrate:force -v={version}

# create new ddl
npm run migrate:create -name="{ddl name}"

# generate schema doc
npm run tbls:doc

# db check
npm run tbls:lint
npm run tbls:diff
```

## tools

```
# send line message
npm -w tools run send-line-message {userID} {message}

# encrypt text
npm -w tools run encrypt {text}
```
