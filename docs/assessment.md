# Four Pizza menu management

## The shop owner's problem

The kitchen has sold out of 14-inch Beef Pepperoni. Staff need to change that size immediately while keeping the 8-inch and 10-inch sizes visible. A family browsing the menu wants to see which sizes they can buy and how much each costs. The customer menu and the staff editor both use the same Express API and MongoDB database.

The six pizzas, descriptions, SGD prices and availability values in the seed file are fictional assessment examples.

## Database design

| Collection | One document represents | Attributes and relationship |
|---|---|---|
| `pizzas` | One pizza on the menu | `_id` identifies the pizza. `name`, `description` and `category` describe it. `sizes` embeds its size options. |
| `users` | One registered account | Each has an email, a password hash and a role. A customer can browse. A staff account can change the menu. |

**One pizza has one or more size options.** Each embedded size belongs to that pizza and has its own diameter, slice count, price and availability. Embedding lets the menu retrieve a pizza and its size options together. Prices are in Singapore dollars.

This extract from Beef Pepperoni shows why availability belongs to each size.

```json
"sizes": [
  { "inches": 8, "slices": 4, "price": 12, "available": true },
  { "inches": 10, "slices": 6, "price": 17.5, "available": true },
  { "inches": 14, "slices": 8, "price": 26, "available": false }
]
```

## How the mock records were generated

ChatGPT generated the six records in [the seed file](../data/pizzas.json) as part of building this assignment. The following excerpt records the data-generation instruction.

> 6 realistic AI generated illustrative pizzas, name/description/category exactly Classic Signature Veggie, sizes array {inches:8|10|14,slices:4|6|8,price:number SGD,available:boolean}, include Pepperoni and Margherita, show sold-out 14-inch example and <$20 examples

The allowed categories are Classic, Signature and Veggie. The allowed diameter and slice-count pairs are 8 inches with 4 slices, 10 inches with 6 slices, and 14 inches with 8 slices. To demonstrate the import, follow the root README, run `npm run seed`, then open the `pizzas` collection in MongoDB Compass. Expand the Beef Pepperoni document's `sizes` array and compare it with the source JSON.

## How to explain the two search routes

| Search | Example | What happens |
|---|---|---|
| Keyword | `GET /api/pizzas?q=pepperoni` | Express searches menu text and returns the Beef Pepperoni document with its size options. |
| Natural language | `POST /api/pizzas/search` with the question “Which 10-inch pizzas are available for under S$20?” | The server sends the question and a schema instruction to the LLM. It checks the structured reply, builds a MongoDB filter, then returns matching pizzas and sizes. |

In the original sample data, the expected matches for the second question are Margherita (S$14), Roasted Mushroom (S$16), Beef Pepperoni (S$17.50) and Smoky Chicken (S$19). Garden Pesto has an available 8-inch size, but its 10-inch size is sold out. Sambal Prawn costs exactly S$20 for 10 inches and falls outside “under S$20”. Size, availability and price must all apply to the **same size option**.

A second demonstration question is “Which 14-inch pizzas are sold out?” The sample data gives one result, Beef Pepperoni.

## Fifteen-minute oral walkthrough

| Time | What to do | What to explain |
|---|---|---|
| 0–2 min | Open the customer menu. Compare the sizes for Beef Pepperoni. | Identify the stakeholder and the decision a customer can make. |
| 2–4 min | Open that pizza in Compass and expand its sizes. Show the mock-data instruction and seed JSON. | Explain one pizza per document and its one-to-many relationship with size options. |
| 4–7 min | Use Postman to list all pizzas, search for pepperoni, register and sign in. Show the two failed write attempts. | A password is stored as a hash. The login returns a JWT. A valid customer token permits fewer actions than a staff token. |
| 7–11 min | As staff, create the temporary pizza in Postman. Read it, change its price, delete it and request it again. | Relate each HTTP method to a change or lookup in MongoDB. The final 404 proves that the record was removed. |
| 11–14 min | Send the natural-language question. Show the system prompt in `src/ai.js`, the response filter and one matching size. | Compare Garden Pesto and Sambal Prawn against the question. Explain how the server limits the LLM output to supported menu criteria. |
| 14–15 min | Show the cloud API URL, GitHub repository and evidence files. | Explain how someone else can open the demo and reproduce the tests. |

## Evidence to capture for the LMS

Import the [Postman collection and environment](../postman/README.md) and run them against the assessment deployment. Include the request method, URL, response code and the relevant response fields in each screenshot. Use a fictional test account. Keep passwords, bearer tokens, database connection strings and provider keys out of screenshots and the ZIP.

| Capture | Evidence |
|---|---|
| 1. Mock data and schema | Capture the generation instruction and seed JSON, then the Compass document with its embedded sizes expanded. |
| 2. Public reads | Capture the list and keyword-search responses. Include the matching pizza name. |
| 3. Signup and login | Capture the first successful signup (201), login status and returned role. Cover the token value. If showing the stored hash, display only the field name and a masked value. |
| 4. Permission checks | Capture the unsigned write (401) and the write using a customer token (403). |
| 5. Staff CRUD | Capture create (201), read (200), update (200), delete (204) and the final lookup (404). Show the same temporary record ID across the sequence. |
| 6. Live AI search | Capture the natural-language question and successful response containing the structured filter and matching size options. Include the system prompt or schema in the code. |
| 7. Deployment | Include the cloud API URL and successful cloud response. Submit the GitHub repository link plus a ZIP of source and deployment assets through the LMS. |

Keep the original unedited seed file for comparison if you change the demo menu during practice.
