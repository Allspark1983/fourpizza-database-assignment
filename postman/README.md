# Test the API in Postman

Use a dedicated assessment database with the original six sample pizzas. The full run creates a test customer and makes a live request to your configured AI provider. The menu-editing requests use a temporary pizza created during the same run.

1. Complete the database setup and seed steps in the [project README](../README.md).
2. Open the staff page, register a fictional staff test address and password, and run `npm run promote -- your-staff-address@example.test` on the server against the same database. Register before promoting. Use the address you actually registered.
3. In Postman, select **Import** and import both JSON files from this folder. Select the **Four Pizza | Local assessment** environment.
4. Set `baseUrl` to the address of the running API, with no trailing slash. The default is `http://localhost:3000`. For cloud screenshots use the deployed HTTPS address.
5. Enter your test account's `staffEmail` and `staffPassword` in local environment values. Keep their shared values empty. Leave the generated customer credentials, tokens, pizza ID and test-pizza name empty on the first run.
6. Open **Four Pizza | Menu API assessment** and run the collection in order. You can also send requests 01–13 individually in order for screenshots. Keep the same environment selected throughout.

## What each folder checks

| Folder | Expected outcome |
|---|---|
| A. Public menu and permissions | Lists pizzas, finds Beef Pepperoni and creates a customer (201). The customer logs in successfully. Unsigned and customer-only writes receive 401 and 403 respectively. |
| B. Staff menu editing | Staff login returns a token. The collection creates a temporary pizza, saves its ID, reads and updates it, deletes it and verifies the next read returns 404. |
| C. AI-powered menu search | The configured provider interprets a natural-language question. The test checks that every returned size is 10 inches, available and strictly below S$20. |

The collection generates one fictional test customer per local environment. Later runs can receive 409 on signup because the same customer already exists. Capture the 201 from the first run as signup evidence. To demonstrate a fresh signup, clear **both** local customer credentials and repeat from request 03. Re-running just a later CRUD request requires the record created at step 08 to still exist.

A 403 on staff creation usually means the account still has the customer role. Check the database you promoted it in and repeat staff login. A provider error on request 13 means the live AI search has not passed. Check the server-side provider configuration and retry that request. Keep local environment values private and submit the blank environment template in this folder.
