# Local API test evidence

These five screenshots show HTTP responses from the included Postman collection, executed with Newman 6.2.3 against the running Express application and a seeded MongoDB database. All 13 requests passed. The AI request used Qwen2.5-1.5B-Instruct, served locally through the project's configurable chat-completions connection. Credentials in the rendered reports are redacted.

| Screenshot | What it shows |
|---|---|
| [Public menu and keyword search](01-public-menu.png) | The menu list and search for Beef Pepperoni both returned 200. |
| [Accounts and permissions](02-access-control.png) | Signup returned 201. Customer and staff logins succeeded. Menu writes received 401 without a token and 403 with a customer token. |
| [Create and read](03-create-and-read.png) | A staff member created a temporary pizza (201) and read the saved document using its ID (200). |
| [Update and delete](04-update-and-delete.png) | A staff member changed that pizza's price and availability (200), removed it (204) and verified the following lookup returned 404. |
| [Natural-language search](05-ai-menu-query.png) | The model interpreted a 10-inch size, an availability condition and a strict price limit of S$20. The database returned four pizzas with matching size options. |

For the cloud assessment, set the Postman environment's `baseUrl` to your deployed HTTPS address and repeat the collection with your configured provider. Include the deployed URL and capture the cloud results. The [assessment guide](../assessment.md) lists the supporting Compass, mock-data and submission evidence.
