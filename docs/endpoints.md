---
title: Endpoint Coverage
group: Guides
---

# Endpoint Coverage

`kong-api-client` accounts for all **141** Admin API endpoints recorded on Kong 3.9: **125** are served through **308** typed operations (**267** across **89** regular resource endpoints and **41** across **36** special endpoints — all **125** also present on Kong Gateway 3.14), and **16** are excluded.

## Resources

### `kong.services` (`/services`)

| Endpoint                                          | Method   | Call                                                     | Notes |
| ------------------------------------------------- | -------- | -------------------------------------------------------- | ----- |
| `/services`                                       | `GET`    | `kong.services.list()`                                   | —     |
| `/services`                                       | `POST`   | `kong.services.create(input)`                            | —     |
| `/services/{service}`                             | `GET`    | `kong.services.get(key)`                                 | —     |
| `/services/{service}`                             | `PATCH`  | `kong.services.update(key, patch)`                       | —     |
| `/services/{service}`                             | `PUT`    | `kong.services.upsert(key, input)`                       | —     |
| `/services/{service}`                             | `DELETE` | `kong.services.delete(key)`                              | —     |
| `/services/{service}/routes`                      | `GET`    | `kong.services.routes(service).list()`                   | —     |
| `/services/{service}/routes`                      | `POST`   | `kong.services.routes(service).create(input)`            | —     |
| `/services/{service}/routes/{route}`              | `GET`    | `kong.services.routes(service).get(key)`                 | —     |
| `/services/{service}/routes/{route}`              | `PATCH`  | `kong.services.routes(service).update(key, patch)`       | —     |
| `/services/{service}/routes/{route}`              | `PUT`    | `kong.services.routes(service).upsert(key, input)`       | —     |
| `/services/{service}/routes/{route}`              | `DELETE` | `kong.services.routes(service).delete(key)`              | —     |
| `/services/{service}/plugins`                     | `GET`    | `kong.services.plugins(service).list()`                  | —     |
| `/services/{service}/plugins`                     | `POST`   | `kong.services.plugins(service).create(input)`           | —     |
| `/services/{service}/plugins/{plugin}`            | `GET`    | `kong.services.plugins(service).get(key)`                | —     |
| `/services/{service}/plugins/{plugin}`            | `PATCH`  | `kong.services.plugins(service).update(key, patch)`      | —     |
| `/services/{service}/plugins/{plugin}`            | `PUT`    | `kong.services.plugins(service).upsert(key, input)`      | —     |
| `/services/{service}/plugins/{plugin}`            | `DELETE` | `kong.services.plugins(service).delete(key)`             | —     |
| `/services/{service}/oauth2_tokens`               | `GET`    | `kong.services.oauth2Tokens(service).list()`             | —     |
| `/services/{service}/oauth2_tokens`               | `POST`   | `kong.services.oauth2Tokens(service).create(input)`      | —     |
| `/services/{service}/oauth2_tokens/{oAuth2Token}` | `GET`    | `kong.services.oauth2Tokens(service).get(key)`           | —     |
| `/services/{service}/oauth2_tokens/{oAuth2Token}` | `PATCH`  | `kong.services.oauth2Tokens(service).update(key, patch)` | —     |
| `/services/{service}/oauth2_tokens/{oAuth2Token}` | `PUT`    | `kong.services.oauth2Tokens(service).upsert(key, input)` | —     |
| `/services/{service}/oauth2_tokens/{oAuth2Token}` | `DELETE` | `kong.services.oauth2Tokens(service).delete(key)`        | —     |
| `/services/{service}/client_certificate`          | `GET`    | `kong.services.clientCertificate(service).get()`         | —     |
| `/services/{service}/client_certificate`          | `PATCH`  | `kong.services.clientCertificate(service).update(patch)` | —     |
| `/services/{service}/client_certificate`          | `PUT`    | `kong.services.clientCertificate(service).upsert(input)` | —     |

### `kong.routes` (`/routes`)

| Endpoint                           | Method   | Call                                            | Notes |
| ---------------------------------- | -------- | ----------------------------------------------- | ----- |
| `/routes`                          | `GET`    | `kong.routes.list()`                            | —     |
| `/routes`                          | `POST`   | `kong.routes.create(input)`                     | —     |
| `/routes/{route}`                  | `GET`    | `kong.routes.get(key)`                          | —     |
| `/routes/{route}`                  | `PATCH`  | `kong.routes.update(key, patch)`                | —     |
| `/routes/{route}`                  | `PUT`    | `kong.routes.upsert(key, input)`                | —     |
| `/routes/{route}`                  | `DELETE` | `kong.routes.delete(key)`                       | —     |
| `/routes/{route}/plugins`          | `GET`    | `kong.routes.plugins(route).list()`             | —     |
| `/routes/{route}/plugins`          | `POST`   | `kong.routes.plugins(route).create(input)`      | —     |
| `/routes/{route}/plugins/{plugin}` | `GET`    | `kong.routes.plugins(route).get(key)`           | —     |
| `/routes/{route}/plugins/{plugin}` | `PATCH`  | `kong.routes.plugins(route).update(key, patch)` | —     |
| `/routes/{route}/plugins/{plugin}` | `PUT`    | `kong.routes.plugins(route).upsert(key, input)` | —     |
| `/routes/{route}/plugins/{plugin}` | `DELETE` | `kong.routes.plugins(route).delete(key)`        | —     |
| `/routes/{route}/service`          | `GET`    | `kong.routes.service(route).get()`              | —     |
| `/routes/{route}/service`          | `PATCH`  | `kong.routes.service(route).update(patch)`      | —     |
| `/routes/{route}/service`          | `PUT`    | `kong.routes.service(route).upsert(input)`      | —     |

### `kong.consumers` (`/consumers`)

| Endpoint                                                 | Method   | Call                                                    | Notes |
| -------------------------------------------------------- | -------- | ------------------------------------------------------- | ----- |
| `/consumers`                                             | `GET`    | `kong.consumers.list()`                                 | —     |
| `/consumers`                                             | `POST`   | `kong.consumers.create(input)`                          | —     |
| `/consumers/{consumer}`                                  | `GET`    | `kong.consumers.get(key)`                               | —     |
| `/consumers/{consumer}`                                  | `PATCH`  | `kong.consumers.update(key, patch)`                     | —     |
| `/consumers/{consumer}`                                  | `PUT`    | `kong.consumers.upsert(key, input)`                     | —     |
| `/consumers/{consumer}`                                  | `DELETE` | `kong.consumers.delete(key)`                            | —     |
| `/consumers/{consumer}/acls`                             | `GET`    | `kong.consumers.acls(consumer).list()`                  | —     |
| `/consumers/{consumer}/acls`                             | `POST`   | `kong.consumers.acls(consumer).create(input)`           | —     |
| `/consumers/{consumer}/acls/{acl}`                       | `GET`    | `kong.consumers.acls(consumer).get(key)`                | —     |
| `/consumers/{consumer}/acls/{acl}`                       | `PATCH`  | `kong.consumers.acls(consumer).update(key, patch)`      | —     |
| `/consumers/{consumer}/acls/{acl}`                       | `PUT`    | `kong.consumers.acls(consumer).upsert(key, input)`      | —     |
| `/consumers/{consumer}/acls/{acl}`                       | `DELETE` | `kong.consumers.acls(consumer).delete(key)`             | —     |
| `/consumers/{consumer}/basic-auth`                       | `GET`    | `kong.consumers.basicAuth(consumer).list()`             | —     |
| `/consumers/{consumer}/basic-auth`                       | `POST`   | `kong.consumers.basicAuth(consumer).create(input)`      | —     |
| `/consumers/{consumer}/basic-auth/{basicAuthCredential}` | `GET`    | `kong.consumers.basicAuth(consumer).get(key)`           | —     |
| `/consumers/{consumer}/basic-auth/{basicAuthCredential}` | `PATCH`  | `kong.consumers.basicAuth(consumer).update(key, patch)` | —     |
| `/consumers/{consumer}/basic-auth/{basicAuthCredential}` | `PUT`    | `kong.consumers.basicAuth(consumer).upsert(key, input)` | —     |
| `/consumers/{consumer}/basic-auth/{basicAuthCredential}` | `DELETE` | `kong.consumers.basicAuth(consumer).delete(key)`        | —     |
| `/consumers/{consumer}/hmac-auth`                        | `GET`    | `kong.consumers.hmacAuth(consumer).list()`              | —     |
| `/consumers/{consumer}/hmac-auth`                        | `POST`   | `kong.consumers.hmacAuth(consumer).create(input)`       | —     |
| `/consumers/{consumer}/hmac-auth/{hmacAuthCredential}`   | `GET`    | `kong.consumers.hmacAuth(consumer).get(key)`            | —     |
| `/consumers/{consumer}/hmac-auth/{hmacAuthCredential}`   | `PATCH`  | `kong.consumers.hmacAuth(consumer).update(key, patch)`  | —     |
| `/consumers/{consumer}/hmac-auth/{hmacAuthCredential}`   | `PUT`    | `kong.consumers.hmacAuth(consumer).upsert(key, input)`  | —     |
| `/consumers/{consumer}/hmac-auth/{hmacAuthCredential}`   | `DELETE` | `kong.consumers.hmacAuth(consumer).delete(key)`         | —     |
| `/consumers/{consumer}/jwt`                              | `GET`    | `kong.consumers.jwt(consumer).list()`                   | —     |
| `/consumers/{consumer}/jwt`                              | `POST`   | `kong.consumers.jwt(consumer).create(input)`            | —     |
| `/consumers/{consumer}/jwt/{jwtSecret}`                  | `GET`    | `kong.consumers.jwt(consumer).get(key)`                 | —     |
| `/consumers/{consumer}/jwt/{jwtSecret}`                  | `PATCH`  | `kong.consumers.jwt(consumer).update(key, patch)`       | —     |
| `/consumers/{consumer}/jwt/{jwtSecret}`                  | `PUT`    | `kong.consumers.jwt(consumer).upsert(key, input)`       | —     |
| `/consumers/{consumer}/jwt/{jwtSecret}`                  | `DELETE` | `kong.consumers.jwt(consumer).delete(key)`              | —     |
| `/consumers/{consumer}/key-auth`                         | `GET`    | `kong.consumers.keyAuth(consumer).list()`               | —     |
| `/consumers/{consumer}/key-auth`                         | `POST`   | `kong.consumers.keyAuth(consumer).create(input)`        | —     |
| `/consumers/{consumer}/key-auth/{keyAuthCredential}`     | `GET`    | `kong.consumers.keyAuth(consumer).get(key)`             | —     |
| `/consumers/{consumer}/key-auth/{keyAuthCredential}`     | `PATCH`  | `kong.consumers.keyAuth(consumer).update(key, patch)`   | —     |
| `/consumers/{consumer}/key-auth/{keyAuthCredential}`     | `PUT`    | `kong.consumers.keyAuth(consumer).upsert(key, input)`   | —     |
| `/consumers/{consumer}/key-auth/{keyAuthCredential}`     | `DELETE` | `kong.consumers.keyAuth(consumer).delete(key)`          | —     |
| `/consumers/{consumer}/oauth2`                           | `GET`    | `kong.consumers.oauth2(consumer).list()`                | —     |
| `/consumers/{consumer}/oauth2`                           | `POST`   | `kong.consumers.oauth2(consumer).create(input)`         | —     |
| `/consumers/{consumer}/oauth2/{oAuth2Credential}`        | `GET`    | `kong.consumers.oauth2(consumer).get(key)`              | —     |
| `/consumers/{consumer}/oauth2/{oAuth2Credential}`        | `PATCH`  | `kong.consumers.oauth2(consumer).update(key, patch)`    | —     |
| `/consumers/{consumer}/oauth2/{oAuth2Credential}`        | `PUT`    | `kong.consumers.oauth2(consumer).upsert(key, input)`    | —     |
| `/consumers/{consumer}/oauth2/{oAuth2Credential}`        | `DELETE` | `kong.consumers.oauth2(consumer).delete(key)`           | —     |
| `/consumers/{consumer}/plugins`                          | `GET`    | `kong.consumers.plugins(consumer).list()`               | —     |
| `/consumers/{consumer}/plugins`                          | `POST`   | `kong.consumers.plugins(consumer).create(input)`        | —     |
| `/consumers/{consumer}/plugins/{plugin}`                 | `GET`    | `kong.consumers.plugins(consumer).get(key)`             | —     |
| `/consumers/{consumer}/plugins/{plugin}`                 | `PATCH`  | `kong.consumers.plugins(consumer).update(key, patch)`   | —     |
| `/consumers/{consumer}/plugins/{plugin}`                 | `PUT`    | `kong.consumers.plugins(consumer).upsert(key, input)`   | —     |
| `/consumers/{consumer}/plugins/{plugin}`                 | `DELETE` | `kong.consumers.plugins(consumer).delete(key)`          | —     |

### `kong.plugins` (`/plugins`)

| Endpoint                     | Method   | Call                                          | Notes |
| ---------------------------- | -------- | --------------------------------------------- | ----- |
| `/plugins`                   | `GET`    | `kong.plugins.list()`                         | —     |
| `/plugins`                   | `POST`   | `kong.plugins.create(input)`                  | —     |
| `/plugins/{plugin}`          | `GET`    | `kong.plugins.get(key)`                       | —     |
| `/plugins/{plugin}`          | `PATCH`  | `kong.plugins.update(key, patch)`             | —     |
| `/plugins/{plugin}`          | `PUT`    | `kong.plugins.upsert(key, input)`             | —     |
| `/plugins/{plugin}`          | `DELETE` | `kong.plugins.delete(key)`                    | —     |
| `/plugins/{plugin}/consumer` | `GET`    | `kong.plugins.consumer(plugin).get()`         | —     |
| `/plugins/{plugin}/consumer` | `PATCH`  | `kong.plugins.consumer(plugin).update(patch)` | —     |
| `/plugins/{plugin}/consumer` | `PUT`    | `kong.plugins.consumer(plugin).upsert(input)` | —     |
| `/plugins/{plugin}/route`    | `GET`    | `kong.plugins.route(plugin).get()`            | —     |
| `/plugins/{plugin}/route`    | `PATCH`  | `kong.plugins.route(plugin).update(patch)`    | —     |
| `/plugins/{plugin}/route`    | `PUT`    | `kong.plugins.route(plugin).upsert(input)`    | —     |
| `/plugins/{plugin}/service`  | `GET`    | `kong.plugins.service(plugin).get()`          | —     |
| `/plugins/{plugin}/service`  | `PATCH`  | `kong.plugins.service(plugin).update(patch)`  | —     |
| `/plugins/{plugin}/service`  | `PUT`    | `kong.plugins.service(plugin).upsert(input)`  | —     |

### `kong.upstreams` (`/upstreams`)

| Endpoint                                   | Method   | Call                                                       | Notes                                                                                    |
| ------------------------------------------ | -------- | ---------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `/upstreams`                               | `GET`    | `kong.upstreams.list()`                                    | —                                                                                        |
| `/upstreams`                               | `POST`   | `kong.upstreams.create(input)`                             | —                                                                                        |
| `/upstreams/{upstream}`                    | `GET`    | `kong.upstreams.get(key)`                                  | —                                                                                        |
| `/upstreams/{upstream}`                    | `PATCH`  | `kong.upstreams.update(key, patch)`                        | —                                                                                        |
| `/upstreams/{upstream}`                    | `PUT`    | `kong.upstreams.upsert(key, input)`                        | —                                                                                        |
| `/upstreams/{upstream}`                    | `DELETE` | `kong.upstreams.delete(key)`                               | —                                                                                        |
| `/upstreams/{upstream}/targets`            | `GET`    | `kong.upstreams.targets(upstream).list()`                  | —                                                                                        |
| `/upstreams/{upstream}/targets`            | `POST`   | `kong.upstreams.targets(upstream).create(input)`           | —                                                                                        |
| `/upstreams/{upstream}/targets/{target}`   | `GET`    | `kong.upstreams.targets(upstream).get(key)`                | —                                                                                        |
| `/upstreams/{upstream}/targets/{target}`   | `PATCH`  | `kong.upstreams.targets(upstream).update(key, patch)`      | —                                                                                        |
| `/upstreams/{upstream}/targets/{target}`   | `PUT`    | `kong.upstreams.targets(upstream).upsert(key, input)`      | Kong does not create missing targets (answers 404) and merges omitted fields like PATCH. |
| `/upstreams/{upstream}/targets/{target}`   | `DELETE` | `kong.upstreams.targets(upstream).delete(key)`             | —                                                                                        |
| `/upstreams/{upstream}/client_certificate` | `GET`    | `kong.upstreams.clientCertificate(upstream).get()`         | —                                                                                        |
| `/upstreams/{upstream}/client_certificate` | `PATCH`  | `kong.upstreams.clientCertificate(upstream).update(patch)` | —                                                                                        |
| `/upstreams/{upstream}/client_certificate` | `PUT`    | `kong.upstreams.clientCertificate(upstream).upsert(input)` | —                                                                                        |

### `kong.certificates` (`/certificates`)

| Endpoint                                           | Method   | Call                                                          | Notes |
| -------------------------------------------------- | -------- | ------------------------------------------------------------- | ----- |
| `/certificates`                                    | `GET`    | `kong.certificates.list()`                                    | —     |
| `/certificates`                                    | `POST`   | `kong.certificates.create(input)`                             | —     |
| `/certificates/{certificate}`                      | `GET`    | `kong.certificates.get(key)`                                  | —     |
| `/certificates/{certificate}`                      | `PATCH`  | `kong.certificates.update(key, patch)`                        | —     |
| `/certificates/{certificate}`                      | `PUT`    | `kong.certificates.upsert(key, input)`                        | —     |
| `/certificates/{certificate}`                      | `DELETE` | `kong.certificates.delete(key)`                               | —     |
| `/certificates/{certificate}/services`             | `GET`    | `kong.certificates.services(certificate).list()`              | —     |
| `/certificates/{certificate}/services`             | `POST`   | `kong.certificates.services(certificate).create(input)`       | —     |
| `/certificates/{certificate}/services/{service}`   | `GET`    | `kong.certificates.services(certificate).get(key)`            | —     |
| `/certificates/{certificate}/services/{service}`   | `PATCH`  | `kong.certificates.services(certificate).update(key, patch)`  | —     |
| `/certificates/{certificate}/services/{service}`   | `PUT`    | `kong.certificates.services(certificate).upsert(key, input)`  | —     |
| `/certificates/{certificate}/services/{service}`   | `DELETE` | `kong.certificates.services(certificate).delete(key)`         | —     |
| `/certificates/{certificate}/snis`                 | `GET`    | `kong.certificates.snis(certificate).list()`                  | —     |
| `/certificates/{certificate}/snis`                 | `POST`   | `kong.certificates.snis(certificate).create(input)`           | —     |
| `/certificates/{certificate}/snis/{sni}`           | `GET`    | `kong.certificates.snis(certificate).get(key)`                | —     |
| `/certificates/{certificate}/snis/{sni}`           | `PATCH`  | `kong.certificates.snis(certificate).update(key, patch)`      | —     |
| `/certificates/{certificate}/snis/{sni}`           | `PUT`    | `kong.certificates.snis(certificate).upsert(key, input)`      | —     |
| `/certificates/{certificate}/snis/{sni}`           | `DELETE` | `kong.certificates.snis(certificate).delete(key)`             | —     |
| `/certificates/{certificate}/upstreams`            | `GET`    | `kong.certificates.upstreams(certificate).list()`             | —     |
| `/certificates/{certificate}/upstreams`            | `POST`   | `kong.certificates.upstreams(certificate).create(input)`      | —     |
| `/certificates/{certificate}/upstreams/{upstream}` | `GET`    | `kong.certificates.upstreams(certificate).get(key)`           | —     |
| `/certificates/{certificate}/upstreams/{upstream}` | `PATCH`  | `kong.certificates.upstreams(certificate).update(key, patch)` | —     |
| `/certificates/{certificate}/upstreams/{upstream}` | `PUT`    | `kong.certificates.upstreams(certificate).upsert(key, input)` | —     |
| `/certificates/{certificate}/upstreams/{upstream}` | `DELETE` | `kong.certificates.upstreams(certificate).delete(key)`        | —     |

### `kong.snis` (`/snis`)

| Endpoint      | Method   | Call                           | Notes |
| ------------- | -------- | ------------------------------ | ----- |
| `/snis`       | `GET`    | `kong.snis.list()`             | —     |
| `/snis`       | `POST`   | `kong.snis.create(input)`      | —     |
| `/snis/{sni}` | `GET`    | `kong.snis.get(key)`           | —     |
| `/snis/{sni}` | `PATCH`  | `kong.snis.update(key, patch)` | —     |
| `/snis/{sni}` | `PUT`    | `kong.snis.upsert(key, input)` | —     |
| `/snis/{sni}` | `DELETE` | `kong.snis.delete(key)`        | —     |

### `kong.caCertificates` (`/ca_certificates`)

| Endpoint                           | Method   | Call                                     | Notes |
| ---------------------------------- | -------- | ---------------------------------------- | ----- |
| `/ca_certificates`                 | `GET`    | `kong.caCertificates.list()`             | —     |
| `/ca_certificates`                 | `POST`   | `kong.caCertificates.create(input)`      | —     |
| `/ca_certificates/{caCertificate}` | `GET`    | `kong.caCertificates.get(key)`           | —     |
| `/ca_certificates/{caCertificate}` | `PATCH`  | `kong.caCertificates.update(key, patch)` | —     |
| `/ca_certificates/{caCertificate}` | `PUT`    | `kong.caCertificates.upsert(key, input)` | —     |
| `/ca_certificates/{caCertificate}` | `DELETE` | `kong.caCertificates.delete(key)`        | —     |

### `kong.vaults` (`/vaults`)

| Endpoint          | Method   | Call                             | Notes |
| ----------------- | -------- | -------------------------------- | ----- |
| `/vaults`         | `GET`    | `kong.vaults.list()`             | —     |
| `/vaults`         | `POST`   | `kong.vaults.create(input)`      | —     |
| `/vaults/{vault}` | `GET`    | `kong.vaults.get(key)`           | —     |
| `/vaults/{vault}` | `PATCH`  | `kong.vaults.update(key, patch)` | —     |
| `/vaults/{vault}` | `PUT`    | `kong.vaults.upsert(key, input)` | —     |
| `/vaults/{vault}` | `DELETE` | `kong.vaults.delete(key)`        | —     |

### `kong.keys` (`/keys`)

| Endpoint          | Method   | Call                               | Notes                                              |
| ----------------- | -------- | ---------------------------------- | -------------------------------------------------- |
| `/keys`           | `GET`    | `kong.keys.list()`                 | —                                                  |
| `/keys`           | `POST`   | `kong.keys.create(input)`          | —                                                  |
| `/keys/{key}`     | `GET`    | `kong.keys.get(key)`               | —                                                  |
| `/keys/{key}`     | `PATCH`  | `kong.keys.update(key, patch)`     | —                                                  |
| `/keys/{key}`     | `PUT`    | `kong.keys.upsert(key, input)`     | Kong answers 500 when called by name; works by id. |
| `/keys/{key}`     | `DELETE` | `kong.keys.delete(key)`            | —                                                  |
| `/keys/{key}/set` | `GET`    | `kong.keys.set(key).get()`         | —                                                  |
| `/keys/{key}/set` | `PATCH`  | `kong.keys.set(key).update(patch)` | —                                                  |
| `/keys/{key}/set` | `PUT`    | `kong.keys.set(key).upsert(input)` | —                                                  |

### `kong.keySets` (`/key-sets`)

| Endpoint                        | Method   | Call                                           | Notes                                                      |
| ------------------------------- | -------- | ---------------------------------------------- | ---------------------------------------------------------- |
| `/key-sets`                     | `GET`    | `kong.keySets.list()`                          | —                                                          |
| `/key-sets`                     | `POST`   | `kong.keySets.create(input)`                   | —                                                          |
| `/key-sets/{keySet}`            | `GET`    | `kong.keySets.get(key)`                        | —                                                          |
| `/key-sets/{keySet}`            | `PATCH`  | `kong.keySets.update(key, patch)`              | —                                                          |
| `/key-sets/{keySet}`            | `PUT`    | `kong.keySets.upsert(key, input)`              | Kong answers 500 when called by name; works by id.         |
| `/key-sets/{keySet}`            | `DELETE` | `kong.keySets.delete(key)`                     | —                                                          |
| `/key-sets/{keySet}/keys`       | `GET`    | `kong.keySets.keys(keySet).list()`             | —                                                          |
| `/key-sets/{keySet}/keys`       | `POST`   | `kong.keySets.keys(keySet).create(input)`      | —                                                          |
| `/key-sets/{keySet}/keys/{key}` | `GET`    | `kong.keySets.keys(keySet).get(key)`           | —                                                          |
| `/key-sets/{keySet}/keys/{key}` | `PATCH`  | `kong.keySets.keys(keySet).update(key, patch)` | —                                                          |
| `/key-sets/{keySet}/keys/{key}` | `PUT`    | `kong.keySets.keys(keySet).upsert(key, input)` | Kong answers 500 when called by key name; works by key id. |
| `/key-sets/{keySet}/keys/{key}` | `DELETE` | `kong.keySets.keys(keySet).delete(key)`        | —                                                          |

### `kong.acls` (`/acls`)

| Endpoint               | Method   | Call                                    | Notes |
| ---------------------- | -------- | --------------------------------------- | ----- |
| `/acls`                | `GET`    | `kong.acls.list()`                      | —     |
| `/acls`                | `POST`   | `kong.acls.create(input)`               | —     |
| `/acls/{acl}`          | `GET`    | `kong.acls.get(key)`                    | —     |
| `/acls/{acl}`          | `PATCH`  | `kong.acls.update(key, patch)`          | —     |
| `/acls/{acl}`          | `PUT`    | `kong.acls.upsert(key, input)`          | —     |
| `/acls/{acl}`          | `DELETE` | `kong.acls.delete(key)`                 | —     |
| `/acls/{acl}/consumer` | `GET`    | `kong.acls.consumer(acl).get()`         | —     |
| `/acls/{acl}/consumer` | `PATCH`  | `kong.acls.consumer(acl).update(patch)` | —     |
| `/acls/{acl}/consumer` | `PUT`    | `kong.acls.consumer(acl).upsert(input)` | —     |

### `kong.basicAuths` (`/basic-auths`)

| Endpoint                                      | Method   | Call                                                          | Notes |
| --------------------------------------------- | -------- | ------------------------------------------------------------- | ----- |
| `/basic-auths`                                | `GET`    | `kong.basicAuths.list()`                                      | —     |
| `/basic-auths`                                | `POST`   | `kong.basicAuths.create(input)`                               | —     |
| `/basic-auths/{basicAuthCredential}`          | `GET`    | `kong.basicAuths.get(key)`                                    | —     |
| `/basic-auths/{basicAuthCredential}`          | `PATCH`  | `kong.basicAuths.update(key, patch)`                          | —     |
| `/basic-auths/{basicAuthCredential}`          | `PUT`    | `kong.basicAuths.upsert(key, input)`                          | —     |
| `/basic-auths/{basicAuthCredential}`          | `DELETE` | `kong.basicAuths.delete(key)`                                 | —     |
| `/basic-auths/{basicAuthCredential}/consumer` | `GET`    | `kong.basicAuths.consumer(basicAuthCredential).get()`         | —     |
| `/basic-auths/{basicAuthCredential}/consumer` | `PATCH`  | `kong.basicAuths.consumer(basicAuthCredential).update(patch)` | —     |
| `/basic-auths/{basicAuthCredential}/consumer` | `PUT`    | `kong.basicAuths.consumer(basicAuthCredential).upsert(input)` | —     |

### `kong.hmacAuths` (`/hmac-auths`)

| Endpoint                                    | Method   | Call                                                        | Notes |
| ------------------------------------------- | -------- | ----------------------------------------------------------- | ----- |
| `/hmac-auths`                               | `GET`    | `kong.hmacAuths.list()`                                     | —     |
| `/hmac-auths`                               | `POST`   | `kong.hmacAuths.create(input)`                              | —     |
| `/hmac-auths/{hmacAuthCredential}`          | `GET`    | `kong.hmacAuths.get(key)`                                   | —     |
| `/hmac-auths/{hmacAuthCredential}`          | `PATCH`  | `kong.hmacAuths.update(key, patch)`                         | —     |
| `/hmac-auths/{hmacAuthCredential}`          | `PUT`    | `kong.hmacAuths.upsert(key, input)`                         | —     |
| `/hmac-auths/{hmacAuthCredential}`          | `DELETE` | `kong.hmacAuths.delete(key)`                                | —     |
| `/hmac-auths/{hmacAuthCredential}/consumer` | `GET`    | `kong.hmacAuths.consumer(hmacAuthCredential).get()`         | —     |
| `/hmac-auths/{hmacAuthCredential}/consumer` | `PATCH`  | `kong.hmacAuths.consumer(hmacAuthCredential).update(patch)` | —     |
| `/hmac-auths/{hmacAuthCredential}/consumer` | `PUT`    | `kong.hmacAuths.consumer(hmacAuthCredential).upsert(input)` | —     |

### `kong.jwts` (`/jwts`)

| Endpoint                     | Method   | Call                                          | Notes |
| ---------------------------- | -------- | --------------------------------------------- | ----- |
| `/jwts`                      | `GET`    | `kong.jwts.list()`                            | —     |
| `/jwts`                      | `POST`   | `kong.jwts.create(input)`                     | —     |
| `/jwts/{jwtSecret}`          | `GET`    | `kong.jwts.get(key)`                          | —     |
| `/jwts/{jwtSecret}`          | `PATCH`  | `kong.jwts.update(key, patch)`                | —     |
| `/jwts/{jwtSecret}`          | `PUT`    | `kong.jwts.upsert(key, input)`                | —     |
| `/jwts/{jwtSecret}`          | `DELETE` | `kong.jwts.delete(key)`                       | —     |
| `/jwts/{jwtSecret}/consumer` | `GET`    | `kong.jwts.consumer(jwtSecret).get()`         | —     |
| `/jwts/{jwtSecret}/consumer` | `PATCH`  | `kong.jwts.consumer(jwtSecret).update(patch)` | —     |
| `/jwts/{jwtSecret}/consumer` | `PUT`    | `kong.jwts.consumer(jwtSecret).upsert(input)` | —     |

### `kong.keyAuths` (`/key-auths`)

| Endpoint                                  | Method   | Call                                                      | Notes |
| ----------------------------------------- | -------- | --------------------------------------------------------- | ----- |
| `/key-auths`                              | `GET`    | `kong.keyAuths.list()`                                    | —     |
| `/key-auths`                              | `POST`   | `kong.keyAuths.create(input)`                             | —     |
| `/key-auths/{keyAuthCredential}`          | `GET`    | `kong.keyAuths.get(key)`                                  | —     |
| `/key-auths/{keyAuthCredential}`          | `PATCH`  | `kong.keyAuths.update(key, patch)`                        | —     |
| `/key-auths/{keyAuthCredential}`          | `PUT`    | `kong.keyAuths.upsert(key, input)`                        | —     |
| `/key-auths/{keyAuthCredential}`          | `DELETE` | `kong.keyAuths.delete(key)`                               | —     |
| `/key-auths/{keyAuthCredential}/consumer` | `GET`    | `kong.keyAuths.consumer(keyAuthCredential).get()`         | —     |
| `/key-auths/{keyAuthCredential}/consumer` | `PATCH`  | `kong.keyAuths.consumer(keyAuthCredential).update(patch)` | —     |
| `/key-auths/{keyAuthCredential}/consumer` | `PUT`    | `kong.keyAuths.consumer(keyAuthCredential).upsert(input)` | —     |

### `kong.oauth2` (`/oauth2`)

| Endpoint                                                 | Method   | Call                                                            | Notes |
| -------------------------------------------------------- | -------- | --------------------------------------------------------------- | ----- |
| `/oauth2`                                                | `GET`    | `kong.oauth2.list()`                                            | —     |
| `/oauth2`                                                | `POST`   | `kong.oauth2.create(input)`                                     | —     |
| `/oauth2/{oAuth2Credential}`                             | `GET`    | `kong.oauth2.get(key)`                                          | —     |
| `/oauth2/{oAuth2Credential}`                             | `PATCH`  | `kong.oauth2.update(key, patch)`                                | —     |
| `/oauth2/{oAuth2Credential}`                             | `PUT`    | `kong.oauth2.upsert(key, input)`                                | —     |
| `/oauth2/{oAuth2Credential}`                             | `DELETE` | `kong.oauth2.delete(key)`                                       | —     |
| `/oauth2/{oAuth2Credential}/oauth2_tokens`               | `GET`    | `kong.oauth2.oauth2Tokens(oAuth2Credential).list()`             | —     |
| `/oauth2/{oAuth2Credential}/oauth2_tokens`               | `POST`   | `kong.oauth2.oauth2Tokens(oAuth2Credential).create(input)`      | —     |
| `/oauth2/{oAuth2Credential}/oauth2_tokens/{oAuth2Token}` | `GET`    | `kong.oauth2.oauth2Tokens(oAuth2Credential).get(key)`           | —     |
| `/oauth2/{oAuth2Credential}/oauth2_tokens/{oAuth2Token}` | `PATCH`  | `kong.oauth2.oauth2Tokens(oAuth2Credential).update(key, patch)` | —     |
| `/oauth2/{oAuth2Credential}/oauth2_tokens/{oAuth2Token}` | `PUT`    | `kong.oauth2.oauth2Tokens(oAuth2Credential).upsert(key, input)` | —     |
| `/oauth2/{oAuth2Credential}/oauth2_tokens/{oAuth2Token}` | `DELETE` | `kong.oauth2.oauth2Tokens(oAuth2Credential).delete(key)`        | —     |
| `/oauth2/{oAuth2Credential}/consumer`                    | `GET`    | `kong.oauth2.consumer(oAuth2Credential).get()`                  | —     |
| `/oauth2/{oAuth2Credential}/consumer`                    | `PATCH`  | `kong.oauth2.consumer(oAuth2Credential).update(patch)`          | —     |
| `/oauth2/{oAuth2Credential}/consumer`                    | `PUT`    | `kong.oauth2.consumer(oAuth2Credential).upsert(input)`          | —     |

### `kong.oauth2Tokens` (`/oauth2_tokens`)

| Endpoint                                  | Method   | Call                                                      | Notes |
| ----------------------------------------- | -------- | --------------------------------------------------------- | ----- |
| `/oauth2_tokens`                          | `GET`    | `kong.oauth2Tokens.list()`                                | —     |
| `/oauth2_tokens`                          | `POST`   | `kong.oauth2Tokens.create(input)`                         | —     |
| `/oauth2_tokens/{oAuth2Token}`            | `GET`    | `kong.oauth2Tokens.get(key)`                              | —     |
| `/oauth2_tokens/{oAuth2Token}`            | `PATCH`  | `kong.oauth2Tokens.update(key, patch)`                    | —     |
| `/oauth2_tokens/{oAuth2Token}`            | `PUT`    | `kong.oauth2Tokens.upsert(key, input)`                    | —     |
| `/oauth2_tokens/{oAuth2Token}`            | `DELETE` | `kong.oauth2Tokens.delete(key)`                           | —     |
| `/oauth2_tokens/{oAuth2Token}/credential` | `GET`    | `kong.oauth2Tokens.credential(oAuth2Token).get()`         | —     |
| `/oauth2_tokens/{oAuth2Token}/credential` | `PATCH`  | `kong.oauth2Tokens.credential(oAuth2Token).update(patch)` | —     |
| `/oauth2_tokens/{oAuth2Token}/credential` | `PUT`    | `kong.oauth2Tokens.credential(oAuth2Token).upsert(input)` | —     |
| `/oauth2_tokens/{oAuth2Token}/service`    | `GET`    | `kong.oauth2Tokens.service(oAuth2Token).get()`            | —     |
| `/oauth2_tokens/{oAuth2Token}/service`    | `PATCH`  | `kong.oauth2Tokens.service(oAuth2Token).update(patch)`    | —     |
| `/oauth2_tokens/{oAuth2Token}/service`    | `PUT`    | `kong.oauth2Tokens.service(oAuth2Token).upsert(input)`    | —     |

### `kong.sessions` (`/sessions`)

| Endpoint              | Method   | Call                               | Notes |
| --------------------- | -------- | ---------------------------------- | ----- |
| `/sessions`           | `GET`    | `kong.sessions.list()`             | —     |
| `/sessions`           | `POST`   | `kong.sessions.create(input)`      | —     |
| `/sessions/{session}` | `GET`    | `kong.sessions.get(key)`           | —     |
| `/sessions/{session}` | `PATCH`  | `kong.sessions.update(key, patch)` | —     |
| `/sessions/{session}` | `PUT`    | `kong.sessions.upsert(key, input)` | —     |
| `/sessions/{session}` | `DELETE` | `kong.sessions.delete(key)`        | —     |

### `kong.acmeStorage` (`/acme_storage`)

| Endpoint                      | Method   | Call                                  | Notes |
| ----------------------------- | -------- | ------------------------------------- | ----- |
| `/acme_storage`               | `GET`    | `kong.acmeStorage.list()`             | —     |
| `/acme_storage`               | `POST`   | `kong.acmeStorage.create(input)`      | —     |
| `/acme_storage/{acmeStorage}` | `GET`    | `kong.acmeStorage.get(key)`           | —     |
| `/acme_storage/{acmeStorage}` | `PATCH`  | `kong.acmeStorage.update(key, patch)` | —     |
| `/acme_storage/{acmeStorage}` | `PUT`    | `kong.acmeStorage.upsert(key, input)` | —     |
| `/acme_storage/{acmeStorage}` | `DELETE` | `kong.acmeStorage.delete(key)`        | —     |

## Special endpoints

| Endpoint                                                       | Method   | Call                                                                     | Notes                                                                           |
| -------------------------------------------------------------- | -------- | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------- |
| `/`                                                            | `GET`    | `kong.node.info()`                                                       | —                                                                               |
| `/status`                                                      | `GET`    | `kong.node.status()`                                                     | —                                                                               |
| `/status/dns`                                                  | `GET`    | `kong.node.dnsStatus()`                                                  | Answers 501 when Kong uses the legacy DNS client.                               |
| `/endpoints`                                                   | `GET`    | `kong.node.endpoints()`                                                  | —                                                                               |
| `/timers`                                                      | `GET`    | `kong.node.timers()`                                                     | —                                                                               |
| `/metrics`                                                     | `GET`    | `kong.node.metrics()`                                                    | —                                                                               |
| `/tags`                                                        | `GET`    | `kong.tags.list()`                                                       | —                                                                               |
| `/tags/{tags}`                                                 | `GET`    | `kong.tags.entities(tag)`                                                | —                                                                               |
| `/cache`                                                       | `DELETE` | `kong.cache.purge()`                                                     | —                                                                               |
| `/cache/{key}`                                                 | `GET`    | `kong.cache.get(key)`                                                    | —                                                                               |
| `/cache/{key}`                                                 | `DELETE` | `kong.cache.delete(key)`                                                 | —                                                                               |
| `/config`                                                      | `GET`    | `kong.config.get()`                                                      | DB-less mode only (answers 400 in database mode).                               |
| `/config`                                                      | `POST`   | `kong.config.load(config)`                                               | DB-less mode only (answers 400 in database mode).                               |
| `/clustering/data-planes`                                      | `GET`    | `kong.clustering.dataPlanes()`                                           | Hybrid-mode Control Plane only (answers 400 in traditional mode).               |
| `/clustering/status`                                           | `GET`    | `kong.clustering.status()`                                               | Hybrid-mode Control Plane only (answers 400 in traditional mode).               |
| `/debug/node/log-level`                                        | `GET`    | `kong.debug.getLogLevel()`                                               | —                                                                               |
| `/debug/node/log-level/{log_level}`                            | `PUT`    | `kong.debug.setLogLevel(level)`                                          | —                                                                               |
| `/debug/cluster/log-level/{log_level}`                         | `PUT`    | `kong.debug.setClusterLogLevel(level)`                                   | —                                                                               |
| `/schemas/{name}`                                              | `GET`    | `kong.schemas.entity(name)`                                              | —                                                                               |
| `/schemas/{db_entity_name}/validate`                           | `POST`   | `kong.schemas.validateEntity(name, body)`                                | —                                                                               |
| `/schemas/plugins/{name}`                                      | `GET`    | `kong.schemas.plugin(name)`                                              | —                                                                               |
| `/schemas/plugins/validate`                                    | `POST`   | `kong.schemas.validatePlugin(body)`                                      | —                                                                               |
| `/schemas/vaults/{name}`                                       | `GET`    | `kong.schemas.vault(name)`                                               | —                                                                               |
| `/schemas/vaults/validate`                                     | `POST`   | `kong.schemas.validateVault(body)`                                       | —                                                                               |
| `/plugins/enabled`                                             | `GET`    | `kong.plugins.enabledNames()`                                            | —                                                                               |
| `/plugins/schema/{name}`                                       | `GET`    | `kong.plugins.schema(name)`                                              | —                                                                               |
| `/upstreams/{upstreams}/health`                                | `GET`    | `kong.upstreams.health(upstream)`                                        | —                                                                               |
| `/upstreams/{upstreams}/targets/all`                           | `GET`    | `kong.upstreams.allTargets(upstream)`                                    | —                                                                               |
| `/upstreams/{upstreams}/targets/{targets}/healthy`             | `PUT`    | `kong.upstreams.setTargetHealth(upstream, target, 'healthy')`            | —                                                                               |
| `/upstreams/{upstreams}/targets/{targets}/unhealthy`           | `PUT`    | `kong.upstreams.setTargetHealth(upstream, target, 'unhealthy')`          | —                                                                               |
| `/upstreams/{upstreams}/targets/{targets}/{address}/healthy`   | `PUT`    | `kong.upstreams.setTargetHealth(upstream, target, 'healthy', address)`   | —                                                                               |
| `/upstreams/{upstreams}/targets/{targets}/{address}/unhealthy` | `PUT`    | `kong.upstreams.setTargetHealth(upstream, target, 'unhealthy', address)` | —                                                                               |
| `/acme`                                                        | `POST`   | `kong.acme.createCertificate(host)`                                      | Requires the `acme` plugin configured and a reachable HTTP-01 challenge domain. |
| `/acme`                                                        | `PATCH`  | `kong.acme.renew()`                                                      | Requires the `acme` plugin configured.                                          |
| `/acme/certificates`                                           | `GET`    | `kong.acme.certificates()`                                               | Requires the `acme` plugin configured (answers 404 otherwise).                  |
| `/acme/certificates/{certificates}`                            | `GET`    | `kong.acme.certificate(host)`                                            | Requires the `acme` plugin configured.                                          |
| `/proxy-cache`                                                 | `DELETE` | `kong.proxyCache.purge()`                                                | —                                                                               |
| `/proxy-cache/{cache_key}`                                     | `GET`    | `kong.proxyCache.get(cacheKey)`                                          | —                                                                               |
| `/proxy-cache/{cache_key}`                                     | `DELETE` | `kong.proxyCache.delete(cacheKey)`                                       | —                                                                               |
| `/proxy-cache/{plugin_id}/caches/{cache_key}`                  | `GET`    | `kong.proxyCache.get(cacheKey, pluginId)`                                | —                                                                               |
| `/proxy-cache/{plugin_id}/caches/{cache_key}`                  | `DELETE` | `kong.proxyCache.delete(cacheKey, pluginId)`                             | —                                                                               |

## Excluded endpoints

| Endpoint                                             | Reason                                                                                                                                                   |
| ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/filter-chains`                                     | WebAssembly filter chains need Wasm enabled and filters installed, and are absent from Kong Gateway 3.14                                                 |
| `/filter-chains/{filter_chains}`                     | WebAssembly filter chains                                                                                                                                |
| `/filter-chains/{filter_chains}/route`               | WebAssembly filter chains                                                                                                                                |
| `/filter-chains/{filter_chains}/service`             | WebAssembly filter chains                                                                                                                                |
| `/routes/{routes}/filter-chains`                     | WebAssembly filter chains                                                                                                                                |
| `/routes/{routes}/filter-chains/{filter_chains}`     | WebAssembly filter chains                                                                                                                                |
| `/routes/{routes}/filters/all`                       | WebAssembly filter chains                                                                                                                                |
| `/routes/{routes}/filters/disabled`                  | WebAssembly filter chains                                                                                                                                |
| `/routes/{routes}/filters/enabled`                   | WebAssembly filter chains                                                                                                                                |
| `/services/{services}/filter-chains`                 | WebAssembly filter chains                                                                                                                                |
| `/services/{services}/filter-chains/{filter_chains}` | WebAssembly filter chains                                                                                                                                |
| `/schemas/filters/{name}`                            | WebAssembly filter chains                                                                                                                                |
| `/targets`                                           | Kong lists this path but answers every request on it with 404; targets are served below an upstream                                                      |
| `/targets/{targets}`                                 | Kong lists this path but answers every request on it with 404; targets are served below an upstream                                                      |
| `/targets/{targets}/upstream`                        | Kong lists this path but answers every request on it with 404; targets are served below an upstream                                                      |
| `/snis/{snis}/certificate`                           | Kong lists this path but answers every request on it with 404; the certificate of an SNI is read from the SNI itself or through /certificates/{sni name} |
