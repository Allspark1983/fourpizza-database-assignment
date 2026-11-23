# Four Pizza Menu Management

A family looking for dinner can check which pizzas are available in the size they want. A staff member can update the price or availability of a single size without taking the other sizes off the menu. The website and menu editor both read from the same Express API and MongoDB database.

This is an assessment project with six fictional menu records and illustrative SGD prices. It reuses the Four Pizza badge and pizza photograph from the earlier website project. It runs as a separate application, so you can practise changes on the sample menu.

## Start on Windows, macOS or Linux

1. Extract the ZIP. In VS Code, choose **File → Open Folder**, select the `fourpizza` folder containing `package.json`, and choose **Terminal → New Terminal**.
2. Use Node.js 24 LTS (minimum supported version 22.9) and a running MongoDB server. If you already have MongoDB Community running on your computer, use its normal connection on port 27017. If you use Docker Desktop, open it and run `docker compose up -d` in the project folder to start the supplied MongoDB service. Atlas also works.
3. In the terminal, run these two commands. Setup creates a private `.env` file and a random JWT signing secret.

   ```sh
   npm ci
   npm run setup
   ```

4. For local MongoDB, the database settings are already filled in. For Atlas, put your database user's connection string in `MONGODB_URI` and allow your computer's IP in Atlas. Use the dedicated database named `fourpizza_assignment`. To use **Ask the menu**, add your DeepSeek API key to `DEEPSEEK_API_KEY` in `.env`. Keyword search and all menu editing work as soon as the database is connected.
5. Load the six example pizzas and start the app.

   ```sh
   npm run seed
   npm start
   ```

6. Open the customer menu at [localhost:3000](http://localhost:3000). Search for **pepperoni**. The sample 8-inch and 10-inch sizes are available and the 14-inch size is sold out. Keep the terminal running. Press **Ctrl+C** to stop the website. If using the supplied Docker database, `docker compose stop` stops MongoDB and keeps the data.

**First staff login.** Open **Staff access**, register a test account and open a second terminal in the project folder. Replace the sample address below with the address you registered.

```sh
npm run promote -- staff@example.test
```

Sign in on the staff page. To practise a complete change, add a seasonal pizza, update its 10-inch price, refresh the customer menu to see the change, then delete your practice pizza. Accounts start with the customer role; only the operator's terminal can grant staff access.

**View the database in Compass.** Open MongoDB Compass, choose **New Connection**, paste the same URI used in `.env` and connect. Open `fourpizza_assignment → pizzas`, find **Beef Pepperoni**, then expand `sizes`. Your account document appears in `users` after signup. For local setup, Compass connects to the MongoDB service running on your computer or in Docker.

## Demonstrate AI search

Choose **Ask the menu** and enter **Which 10-inch pizzas are available for under S$20?** The model should return the filter below. Express validates it, asks MongoDB to match all three conditions on the same size option, and returns only the matching sizes.

```json
{"inches": 10, "available": true, "priceUnder": 20}
```

The original sample menu returns Beef Pepperoni, Margherita, Roasted Mushroom and Smoky Chicken. In this example Garden Pesto is sold out at 10 inches, and a 10-inch Sambal Prawn is exactly S$20.

The deployed configuration targets the DeepSeek chat-completions API using JSON output. The model is configurable with `DEEPSEEK_MODEL`. For a local demonstration, the same code can call a genuine OpenAI-compatible local model server: set `AI_LOCAL_URL` to its full loopback chat-completions URL (for example `http://127.0.0.1:8080/v1/chat/completions`) and set `AI_LOCAL_MODEL` to the model name it serves. Restart Express after changing settings. Only the menu question and schema instructions are sent to the model. [DeepSeek JSON output documentation](https://api-docs.deepseek.com/guides/json_mode/)

## Project map

| File or folder | What to look for |
| --- | --- |
| `public/` | Customer menu and staff pages using HTML, CSS, JavaScript and the browser's fetch API |
| `src/menu.js` | Pizza validation, keyword search and MongoDB CRUD |
| `src/auth.js` | Signup, salted password hashing, JWT login and staff access |
| `src/ai.js` | System prompt, provider request, JSON validation and MongoDB query construction |
| `src/db.js` | MongoDB connection and uniqueness rules for pizza names and email addresses |
| `data/pizzas.json` | Six AI-generated mock pizzas with embedded sizes |
| [Postman setup](postman/README.md) | Collection and blank environment for testing all 13 requests |
| [Assessment guide](docs/assessment.md) | Schema, mock-data prompt, demonstration script and LMS evidence checklist |
| [Test evidence](docs/evidence/README.md) | Screenshots of actual HTTP results from the local integration test |

## REST endpoints

| Method | Path | Access and purpose |
| --- | --- | --- |
| GET | `/api/health` | Public. Checks MongoDB connectivity. |
| GET | `/api/pizzas` | Public. Lists the menu. Use `?q=pepperoni` for keyword search. |
| GET | `/api/pizzas/:id` | Public. Gets one pizza by its MongoDB ID. |
| POST | `/api/pizzas/search` | Public. Accepts a JSON object with a `question` and calls the configured LLM. |
| POST | `/api/auth/register` | Public. Accepts an email and password and creates a customer. |
| POST | `/api/auth/login` | Public. Returns a signed, one-hour JWT and the user's role. |
| POST | `/api/pizzas` | Staff. Adds a pizza and returns 201. |
| PUT | `/api/pizzas/:id` | Staff. Replaces editable fields and keeps the same ID. |
| DELETE | `/api/pizzas/:id` | Staff. Deletes one pizza and returns 204. |

Postman sends staff tokens as `Authorization: Bearer <token>`. Bodies that contain JSON use `Content-Type: application/json`.

## Publish for assessment

1. Create a GitHub repository for this assignment. Put the contents of the `fourpizza` folder at the repository root, including `.env.example`, `package-lock.json` and the deployment assets. Keep your private `.env`, `node_modules`, personal data and active tokens off GitHub. If your repository is private, give your assessor the access your course requires.
2. On Render, create a **Web Service**, connect this repository, choose the Node runtime, and enter `npm ci` for the build command and `npm start` for the start command. Use `/api/health` for the health check. Review the hosting plan before creating a paid service. [Render Express setup](https://render.com/docs/deploy-node-express-app)
3. Set `MONGODB_URI`, `MONGODB_DB`, `JWT_SECRET`, `DEEPSEEK_API_KEY` and `DEEPSEEK_MODEL` in the service's environment. Use a new random signing secret for this deployment. Omit `AI_LOCAL_URL` on the cloud host. Render supplies the `PORT` value.
4. Connect the service to a dedicated MongoDB Atlas assessment database. Give its database user read/write access to that database. Allow the service's outbound IP ranges in Atlas. If seeding from your laptop, allow your own IP too. [Render and Atlas connection guide](https://render.com/docs/connect-to-mongodb-atlas)
5. Seed the Atlas database once using `npm run seed` with the same database settings, either from your laptop or in the hosting service's shell. Open the deployed URL and verify `/api/health`. Create a test account on the deployed site and promote that account against the same Atlas database.
6. Change Postman's `baseUrl` to the deployed address. Run the collection and capture your own evidence of the deployed API and cloud AI call. Submit the GitHub link, deployment URL, evidence and source ZIP through the LMS.

**Connect to the existing Four Pizza website.** Once your assessment deployment is live, add a **View pizza menu** link on your Four Pizza website pointing to the deployed menu URL. The provided customer and staff pages use the same origin as the API. This keeps the assessment menu easy to demonstrate independently of live prices, orders and delivery operations.
